import { Clock } from "lucide-react";

export default function HistoryPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">분석 히스토리</h1>
        <p className="mt-1 text-muted">이전에 분석한 로그 세션 목록입니다</p>
      </div>

      {/* 빈 상태 */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
        <Clock className="h-12 w-12 text-muted" />
        <p className="mt-4 text-muted">아직 분석 기록이 없습니다</p>
        <a
          href="/"
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          새 분석 시작
        </a>
      </div>
    </div>
  );
}
