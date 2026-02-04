"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import SystemInfoForm from "@/components/SystemInfoForm";

export default function Home() {
  const [systemInfo, setSystemInfo] = useState({
    os: "",
    appName: "",
    appVersion: "",
    environment: "",
    notes: "",
  });

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

        {/* 파일 업로드 영역 플레이스홀더 */}
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-12 transition-colors hover:border-primary/50 hover:bg-card-hover">
          <Upload className="h-12 w-12 text-muted" />
          <p className="mt-4 text-sm text-muted">
            여기에 파일 업로드 컴포넌트가 들어갑니다
          </p>
        </div>

        {/* 분석 시작 버튼 */}
        <button
          disabled
          className="w-full rounded-lg bg-primary py-3 font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          분석 시작
        </button>
      </div>
    </div>
  );
}
