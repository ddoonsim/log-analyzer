"use client";

import { useState } from "react";
import SystemInfoForm from "@/components/SystemInfoForm";
import FileUploader from "@/components/FileUploader";

interface UploadedFile {
  id: string;
  file: File;
}

export default function Home() {
  const [systemInfo, setSystemInfo] = useState({
    os: "",
    appName: "",
    appVersion: "",
    environment: "",
    notes: "",
  });

  const [files, setFiles] = useState<UploadedFile[]>([]);

  const canSubmit = files.length > 0;

  const handleSubmit = () => {
    // TODO: 세션 생성 및 분석 시작
    console.log("시스템 정보:", systemInfo);
    console.log("파일:", files);
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

        {/* 분석 시작 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-lg bg-primary py-3 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          분석 시작
        </button>
      </div>
    </div>
  );
}
