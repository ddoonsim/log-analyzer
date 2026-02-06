"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import SystemInfoForm from "@/components/SystemInfoForm";
import FileUploader from "@/components/FileUploader";

interface UploadedFile {
  id: string;
  file: File;
}

export default function Home() {
  const router = useRouter();

  const [systemInfo, setSystemInfo] = useState({
    os: "",
    appName: "",
    appVersion: "",
    environment: "",
    notes: "",
  });

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = files.length > 0 && !isLoading;

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      // 시스템 정보 추가
      Object.entries(systemInfo).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // 파일 추가
      files.forEach(({ file }) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/sessions", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("세션 생성에 실패했습니다");
      }

      const { sessionId } = await response.json();
      router.push(`/session/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          로그 파일 분석
        </h1>
        <p className="mt-3 text-muted">
          시스템 정보와 로그 파일을 업로드하면 AI가 분석해드립니다
        </p>
      </div>

      <div className="mt-10 w-full max-w-xl space-y-6">
        {/* 시스템 정보 입력 */}
        <SystemInfoForm value={systemInfo} onChange={setSystemInfo} />

        {/* 파일 업로드 */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">로그 파일</h2>
          <FileUploader files={files} onChange={setFiles} />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="rounded-lg border border-error/50 bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}

        {/* 분석 시작 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              처리 중...
            </>
          ) : (
            "분석 시작"
          )}
        </button>
      </div>
    </div>
  );
}
