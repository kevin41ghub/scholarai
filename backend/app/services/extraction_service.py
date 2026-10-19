import io
import re
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger("extraction_service")

# Try importing pytesseract for optional OCR support
try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False


class DocumentExtractionService:
    """
    Real document text and metadata extraction service.
    Extracts structured fields from text PDFs and images.
    Enforces resource limits (page limits, byte caps) and treats all content as untrusted.
    """

    MAX_PAGES = 10
    MAX_TEXT_CHARS = 50_000

    def extract_document(
        self,
        raw_bytes: bytes,
        mime_type: str,
        document_type: str,
    ) -> Dict[str, Any]:
        """
        Extracts structured information from document bytes.
        Returns a dict containing extraction_status, extracted_fields, and metadata.
        """
        if mime_type == "application/pdf":
            return self._extract_from_pdf(raw_bytes, document_type)
        elif mime_type in ["image/jpeg", "image/png"]:
            return self._extract_from_image(raw_bytes, mime_type, document_type)
        else:
            return {
                "extraction_status": "FAILED",
                "raw_text_length": 0,
                "page_count": 0,
                "extracted_fields": {},
                "extraction_notes": [f"Unsupported MIME type for extraction: {mime_type}"],
            }

    def _extract_from_pdf(self, raw_bytes: bytes, document_type: str) -> Dict[str, Any]:
        try:
            from pypdf import PdfReader
            from pypdf.errors import PdfReadError
        except ImportError:
            return {
                "extraction_status": "FAILED",
                "raw_text_length": 0,
                "page_count": 0,
                "extracted_fields": {},
                "extraction_notes": ["PDF extraction library (pypdf) is not available."],
            }

        try:
            reader = PdfReader(io.BytesIO(raw_bytes))

            if reader.is_encrypted:
                return {
                    "extraction_status": "FAILED",
                    "raw_text_length": 0,
                    "page_count": len(reader.pages) if hasattr(reader, "pages") else 0,
                    "extracted_fields": {},
                    "extraction_notes": ["Document is password-protected or encrypted."],
                }

            page_count = len(reader.pages)
            if page_count == 0:
                return {
                    "extraction_status": "FAILED",
                    "raw_text_length": 0,
                    "page_count": 0,
                    "extracted_fields": {},
                    "extraction_notes": ["PDF contains no readable pages."],
                }

            extracted_text_parts: List[str] = []
            pages_to_process = min(page_count, self.MAX_PAGES)

            for page_idx in range(pages_to_process):
                page = reader.pages[page_idx]
                text = page.extract_text() or ""
                extracted_text_parts.append(text)
                if sum(len(p) for p in extracted_text_parts) > self.MAX_TEXT_CHARS:
                    break

            full_text = "\n".join(extracted_text_parts)[:self.MAX_TEXT_CHARS]
            clean_text = self._sanitize_text(full_text)

            if len(clean_text.strip()) < 20:
                # Scanned PDF without embedded text layer
                return {
                    "extraction_status": "NEEDS_MANUAL_PROCESSING",
                    "raw_text_length": len(clean_text),
                    "page_count": page_count,
                    "extracted_fields": {},
                    "extraction_notes": [
                        "PDF contains scanned raster images without embedded text layer. OCR or manual review required."
                    ],
                }

            # Parse fields from the extracted text
            fields, notes = self._parse_structured_fields(clean_text, document_type)

            return {
                "extraction_status": "COMPLETED",
                "raw_text_length": len(clean_text),
                "page_count": page_count,
                "extracted_fields": fields,
                "extraction_notes": notes,
            }

        except Exception as e:
            logger.warning(f"Failed to extract PDF content: {e}")
            return {
                "extraction_status": "FAILED",
                "raw_text_length": 0,
                "page_count": 0,
                "extracted_fields": {},
                "extraction_notes": [f"PDF parsing error: {str(e)}"],
            }

    def _extract_from_image(self, raw_bytes: bytes, mime_type: str, document_type: str) -> Dict[str, Any]:
        try:
            from PIL import Image
        except ImportError:
            return {
                "extraction_status": "FAILED",
                "raw_text_length": 0,
                "page_count": 1,
                "extracted_fields": {},
                "extraction_notes": ["Image library (Pillow) is not available."],
            }

        try:
            with Image.open(io.BytesIO(raw_bytes)) as img:
                width, height = img.size
                img_format = img.format

            # Attempt real OCR if pytesseract is installed and functional
            ocr_text = ""
            ocr_attempted = False
            ocr_success = False

            if PYTESSERACT_AVAILABLE:
                try:
                    with Image.open(io.BytesIO(raw_bytes)) as img:
                        # Convert to grayscale for better OCR
                        gray = img.convert("L")
                        ocr_text = pytesseract.image_to_string(gray, timeout=5)
                        ocr_attempted = True
                        ocr_success = bool(ocr_text.strip())
                except Exception as ocr_err:
                    logger.debug(f"Pytesseract execution unavailable: {ocr_err}")
                    ocr_attempted = True
                    ocr_success = False

            clean_text = self._sanitize_text(ocr_text)[:self.MAX_TEXT_CHARS]

            if ocr_success and len(clean_text.strip()) >= 20:
                fields, notes = self._parse_structured_fields(clean_text, document_type)
                notes.append(f"Image dimensions: {width}x{height} ({img_format}). Optical character recognition succeeded.")
                return {
                    "extraction_status": "COMPLETED",
                    "raw_text_length": len(clean_text),
                    "page_count": 1,
                    "extracted_fields": fields,
                    "extraction_notes": notes,
                }
            else:
                notes = [f"Image verified: {width}x{height} px ({img_format})."]
                if ocr_attempted and not ocr_success:
                    notes.append("OCR optical character recognition engine could not recognize text from this image.")
                else:
                    notes.append("System OCR binary not installed in runtime environment. Visual document inspection required.")

                return {
                    "extraction_status": "NEEDS_MANUAL_PROCESSING",
                    "raw_text_length": len(clean_text),
                    "page_count": 1,
                    "extracted_fields": {
                        "image_width": width,
                        "image_height": height,
                        "format": img_format,
                    },
                    "extraction_notes": notes,
                }

        except Exception as e:
            logger.warning(f"Image parsing error: {e}")
            return {
                "extraction_status": "FAILED",
                "raw_text_length": 0,
                "page_count": 1,
                "extracted_fields": {},
                "extraction_notes": [f"Image parsing error: {str(e)}"],
            }

    def _sanitize_text(self, text: str) -> str:
        """Strip control characters and normalize whitespace without removing meaningful symbols."""
        if not text:
            return ""
        # Remove non-printable control chars except \n, \r, \t
        sanitized = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", "", text)
        return re.sub(r"[ \t]+", " ", sanitized).strip()

    def _parse_structured_fields(self, text: str, document_type: str) -> tuple[Dict[str, Any], List[str]]:
        """Extract domain fields such as student name, dates, reference IDs, and authorities."""
        fields: Dict[str, Any] = {}
        notes: List[str] = []

        # 1. Certificate / Reference Number
        cert_match = re.search(
            r"(?:certificate|cert|ref|reference|roll|reg|registration|application|ack)\s*(?:no|num|number|id|code)?[:.\s#-]*([A-Z0-9/_-]{5,30})",
            text,
            re.IGNORECASE,
        )
        if cert_match:
            fields["certificate_number"] = cert_match.group(1).strip()
            notes.append(f"Identified reference number: {fields['certificate_number']}")

        # 2. Student Name pattern matching
        name_match = re.search(
            r"(?:this is to certify that|name of student|candidate name|student name|certify that|name)\s*[:.\s-]*([A-Za-z\s]{3,40})",
            text,
            re.IGNORECASE,
        )
        if name_match:
            extracted_name = name_match.group(1).strip()
            # Clean trailing words like 'son of', 'daughter of', 'bearing'
            extracted_name = re.split(r"\b(?:s/o|d/o|son|daughter|bearing|studying|is|who)\b", extracted_name, flags=re.IGNORECASE)[0].strip()
            if len(extracted_name) >= 3 and not re.search(r"\b(?:certificate|government|department|authority)\b", extracted_name, re.IGNORECASE):
                fields["student_name"] = extracted_name
                notes.append(f"Extracted name: {extracted_name}")

        # 3. Dates (Issue date and Expiry date)
        # Search for date patterns: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
        date_matches = re.findall(
            r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b",
            text,
        )
        parsed_dates: List[datetime] = []
        for d_str in date_matches:
            for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y", "%d-%m-%y"):
                try:
                    dt = datetime.strptime(d_str, fmt)
                    if 1990 <= dt.year <= 2040:
                        parsed_dates.append(dt)
                        break
                except ValueError:
                    continue

        if parsed_dates:
            # Sort chronologically
            parsed_dates.sort()
            # Issue date is typically earliest valid date
            fields["issue_date"] = parsed_dates[0].strftime("%Y-%m-%d")
            notes.append(f"Identified issue date: {fields['issue_date']}")

            # If multiple dates and the latest date is in the future or after issue date
            if len(parsed_dates) > 1 and parsed_dates[-1] > parsed_dates[0]:
                fields["expiry_date"] = parsed_dates[-1].strftime("%Y-%m-%d")
                notes.append(f"Identified validity / expiry date: {fields['expiry_date']}")

        # 4. Issuing Authority identification
        authorities = [
            "Government of India",
            "Government of Maharashtra",
            "Government of Karnataka",
            "Government of Tamil Nadu",
            "Government of Delhi",
            "Government of Uttar Pradesh",
            "Government of Rajasthan",
            "Government of Bihar",
            "Government of West Bengal",
            "Revenue Department",
            "Tahsildar",
            "District Magistrate",
            "Sub-Divisional Magistrate",
            "Central Board of Secondary Education",
            "State Board of Technical Education",
            "Ministry of Education",
            "University of Delhi",
            "Anna University",
            "VTU",
        ]
        for auth in authorities:
            if re.search(r"\b" + re.escape(auth) + r"\b", text, re.IGNORECASE):
                fields["issuing_authority"] = auth
                notes.append(f"Recognized issuing authority: {auth}")
                break

        # 5. Income parsing for income certificates
        if "INCOME" in document_type.upper():
            income_match = re.search(
                r"(?:annual\s+income|family\s+income|income\s+is|total\s+income|rs\.?|inr)\s*[:.\s-]*([0-9,]{3,10})",
                text,
                re.IGNORECASE,
            )
            if income_match:
                try:
                    income_val = float(income_match.group(1).replace(",", ""))
                    fields["annual_income"] = income_val
                    notes.append(f"Extracted annual income: INR {income_val:,.2f}")
                except ValueError:
                    pass

        # 6. Academic parsing for transcripts
        if any(term in document_type.upper() for term in ["TRANSCRIPT", "MARKSHEET", "ACADEMIC"]):
            cgpa_match = re.search(r"(?:cgpa|gpa|sgpa)\s*[:.\s-]*([0-9]+\.?[0-9]*)", text, re.IGNORECASE)
            percentage_match = re.search(r"(?:percentage|marks)\s*[:.\s-]*([0-9]+\.?[0-9]*)\s*%", text, re.IGNORECASE)
            if cgpa_match:
                fields["cgpa"] = float(cgpa_match.group(1))
                notes.append(f"Extracted CGPA: {fields['cgpa']}")
            elif percentage_match:
                fields["percentage"] = float(percentage_match.group(1))
                notes.append(f"Extracted percentage: {fields['percentage']}%")

        return fields, notes


extraction_service = DocumentExtractionService()
