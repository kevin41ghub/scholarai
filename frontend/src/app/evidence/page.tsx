"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EvidenceRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/documents");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
      <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Redirecting to Document Vault...
      </p>
    </div>
  );
}
