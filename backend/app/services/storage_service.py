import os
import re
import hashlib
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Tuple
from fastapi import HTTPException, status
from app.core.config import settings


# Magic byte signatures for authorized file types
MAGIC_SIGNATURES = {
    "pdf": [b"%PDF-"],
    "jpeg": [b"\xFF\xD8\xFF"],
    "jpg": [b"\xFF\xD8\xFF"],
    "png": [b"\x89PNG\r\n\x1a\n"],
}

MIME_TO_EXT = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/pjpeg": "jpg",
    "image/png": "png",
}


class BaseStorageBackend(ABC):
    @abstractmethod
    def save_file(self, content: bytes, storage_key: str, mime_type: str) -> None:
        pass

    @abstractmethod
    def get_file(self, storage_key: str) -> bytes:
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        pass

    @abstractmethod
    def file_exists(self, storage_key: str) -> bool:
        pass

    @abstractmethod
    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 300) -> Optional[str]:
        pass


class LocalStorageBackend(BaseStorageBackend):
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or settings.STORAGE_LOCAL_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, storage_key: str) -> Path:
        target = (self.base_dir / storage_key).resolve()
        # Security: Prevent path traversal attacks
        try:
            target.relative_to(self.base_dir)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Invalid storage key path."
            )
        return target

    def save_file(self, content: bytes, storage_key: str, mime_type: str) -> None:
        target_path = self._resolve_path(storage_key)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(content)

    def get_file(self, storage_key: str) -> bytes:
        target_path = self._resolve_path(storage_key)
        if not target_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file not found in storage."
            )
        with open(target_path, "rb") as f:
            return f.read()

    def delete_file(self, storage_key: str) -> bool:
        try:
            target_path = self._resolve_path(storage_key)
            if target_path.is_file():
                target_path.unlink()
                return True
            return False
        except Exception:
            return False

    def file_exists(self, storage_key: str) -> bool:
        try:
            target_path = self._resolve_path(storage_key)
            return target_path.is_file()
        except Exception:
            return False

    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 300) -> Optional[str]:
        # Local backend serves file via direct authenticated streaming endpoint
        return None


class S3StorageBackend(BaseStorageBackend):
    def __init__(self):
        import boto3
        from botocore.config import Config

        endpoint_url = settings.R2_ENDPOINT_URL
        if not endpoint_url and settings.R2_ACCOUNT_ID:
            endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

        if not settings.R2_ACCESS_KEY_ID or not settings.R2_SECRET_ACCESS_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cloudflare R2 storage credentials are not configured on server."
            )

        self.bucket = settings.R2_BUCKET_NAME
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url or None,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name=settings.R2_REGION or "auto",
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )

    def save_file(self, content: bytes, storage_key: str, mime_type: str) -> None:
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=storage_key,
                Body=content,
                ContentType=mime_type,
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to store file in object storage: {str(e)}"
            )

    def get_file(self, storage_key: str) -> bytes:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=storage_key)
            return response["Body"].read()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Failed to retrieve file from object storage: {str(e)}"
            )

    def delete_file(self, storage_key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=storage_key)
            return True
        except Exception:
            return False

    def file_exists(self, storage_key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=storage_key)
            return True
        except Exception:
            return False

    def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 300) -> Optional[str]:
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": storage_key},
                ExpiresIn=expires_in_seconds,
            )
            return url
        except Exception:
            return None


class StorageService:
    def __init__(self):
        backend_type = settings.STORAGE_BACKEND.lower().strip()
        if backend_type in ["r2", "s3"]:
            # If R2 credentials are set, use S3 backend; fallback safely to local if not configured
            if settings.R2_ACCESS_KEY_ID and settings.R2_SECRET_ACCESS_KEY:
                self.backend: BaseStorageBackend = S3StorageBackend()
                self.backend_name = backend_type
            else:
                self.backend = LocalStorageBackend()
                self.backend_name = "local"
        else:
            self.backend = LocalStorageBackend()
            self.backend_name = "local"

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename against path traversal, control chars, and excessive length."""
        if not filename:
            return "document"
        clean = Path(filename).name
        clean = re.sub(r"[^\w\s\.-]", "_", clean).strip()
        if not clean:
            clean = "document"
        return clean[:250]

    @staticmethod
    def validate_file(content: bytes, filename: str, declared_mime: Optional[str] = None) -> Tuple[str, str, str]:
        """
        Thorough security validation:
        1. File size check (empty check and max 10MB limit)
        2. Extension check
        3. Magic byte signature check (prevents spoofed MIME/extensions)
        4. Content hash (SHA-256)
        Returns: (verified_ext, verified_mime, content_hash)
        """
        # 1. Size checks
        file_size = len(content)
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty file uploaded. Document must contain data."
            )
        if file_size > settings.MAX_DOCUMENT_SIZE_BYTES:
            max_mb = settings.MAX_DOCUMENT_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {max_mb} MB."
            )

        # 2. Extension check
        ext = Path(filename).suffix.lower()
        if ext not in settings.ALLOWED_DOCUMENT_EXTENSIONS:
            allowed = ", ".join(settings.ALLOWED_DOCUMENT_EXTENSIONS)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file extension '{ext}'. Allowed extensions: {allowed}"
            )
        clean_ext = ext.lstrip(".")
        if clean_ext == "jpeg":
            clean_ext = "jpg"

        # 3. Magic byte inspection
        signatures = MAGIC_SIGNATURES.get(clean_ext, [])
        is_magic_valid = any(content.startswith(sig) for sig in signatures)
        if not is_magic_valid:
            # Check if declared format doesn't match real bytes
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File header signature does not match declared extension '.{clean_ext}'. File may be corrupted or spoofed."
            )

        # 4. Resolve verified MIME type
        if clean_ext == "pdf":
            verified_mime = "application/pdf"
        elif clean_ext in ["jpg", "jpeg"]:
            verified_mime = "image/jpeg"
        elif clean_ext == "png":
            verified_mime = "image/png"
        else:
            verified_mime = declared_mime or "application/octet-stream"

        # 5. Calculate SHA-256 content hash
        content_hash = hashlib.sha256(content).hexdigest()

        return clean_ext, verified_mime, content_hash

    def generate_storage_key(self, student_id: int, category: str, ext: str) -> str:
        """Generate an unpredictable, server-controlled storage path."""
        random_token = uuid.uuid4().hex
        category_slug = re.sub(r"[^\w-]", "_", category.lower())
        return f"students/{student_id}/{random_token}_{category_slug}.{ext}"

    def store_document(
        self,
        student_id: int,
        content: bytes,
        filename: str,
        category: str,
        declared_mime: Optional[str] = None
    ) -> dict:
        if settings.ENVIRONMENT.lower() == "production" and self.backend_name == "local":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Private persistent object storage is not configured for this production deployment. "
                    "Ephemeral local storage is disabled in production to protect student records. "
                    "Please configure Cloudflare R2 environment variables in Render (STORAGE_BACKEND=r2, R2_ACCOUNT_ID, "
                    "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)."
                ),
            )

        ext, verified_mime, content_hash = self.validate_file(content, filename, declared_mime)
        storage_key = self.generate_storage_key(student_id, category, ext)

        self.backend.save_file(content, storage_key, verified_mime)

        return {
            "storage_key": storage_key,
            "storage_backend": self.backend_name,
            "file_size": len(content),
            "mime_type": verified_mime,
            "content_hash": content_hash,
            "clean_filename": self.sanitize_filename(filename),
        }

    def retrieve_document(self, storage_key: str) -> bytes:
        return self.backend.get_file(storage_key)

    def delete_document(self, storage_key: str) -> bool:
        return self.backend.delete_file(storage_key)

    def get_presigned_download_url(self, storage_key: str, expires_in_seconds: int = 300) -> Optional[str]:
        return self.backend.generate_presigned_url(storage_key, expires_in_seconds)


storage_service = StorageService()
