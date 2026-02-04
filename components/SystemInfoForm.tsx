"use client";

import { Monitor, AppWindow, Server, FileText } from "lucide-react";

interface SystemInfoFormProps {
  value: {
    os: string;
    appName: string;
    appVersion: string;
    environment: string;
    notes: string;
  };
  onChange: (value: SystemInfoFormProps["value"]) => void;
}

export default function SystemInfoForm({ value, onChange }: SystemInfoFormProps) {
  const handleChange = (field: keyof typeof value, newValue: string) => {
    onChange({ ...value, [field]: newValue });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">시스템 정보</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* OS */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-muted">
            <Monitor className="h-4 w-4" />
            운영체제
          </label>
          <input
            type="text"
            value={value.os}
            onChange={(e) => handleChange("os", e.target.value)}
            placeholder="예: Windows 11, Ubuntu 22.04"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* 앱 이름 */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-muted">
            <AppWindow className="h-4 w-4" />
            애플리케이션
          </label>
          <input
            type="text"
            value={value.appName}
            onChange={(e) => handleChange("appName", e.target.value)}
            placeholder="예: Jira, Confluence, Bitbucket"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* 앱 버전 */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-muted">
            <span className="flex h-4 w-4 items-center justify-center text-xs font-bold">#</span>
            버전
          </label>
          <input
            type="text"
            value={value.appVersion}
            onChange={(e) => handleChange("appVersion", e.target.value)}
            placeholder="예: 9.12.0, 8.5.4"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* 환경 */}
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm text-muted">
            <Server className="h-4 w-4" />
            환경
          </label>
          <select
            value={value.environment}
            onChange={(e) => handleChange("environment", e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">선택하세요</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
            <option value="test">Test</option>
          </select>
        </div>

        {/* 기타 정보 */}
        <div className="sm:col-span-2">
          <label className="mb-1.5 flex items-center gap-2 text-sm text-muted">
            <FileText className="h-4 w-4" />
            기타 정보 (선택)
          </label>
          <textarea
            value={value.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="예: Java 버전, DB 종류, 클러스터 구성, 에러 발생 시점 등"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  );
}
