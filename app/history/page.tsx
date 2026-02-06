"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Trash2,
  MessageSquare,
  AlertTriangle,
  Calendar,
  Monitor,
  Inbox,
  Loader2,
  X,
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  systemInfoSummary: string;
  messageCount: number;
  issueCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function HistoryPage() {
  const router = useRouter();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSessions = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/sessions?page=${page}&limit=10`);
      if (!res.ok) throw new Error("세션 목록을 불러올 수 없습니다.");

      const data = await res.json();
      setSessions(data.sessions);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(currentPage);
  }, [currentPage, fetchSessions]);

  // 검색 필터링 (클라이언트 사이드)
  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.title.toLowerCase().includes(query) ||
      session.systemInfoSummary.toLowerCase().includes(query)
    );
  });

  // 세션 삭제
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("삭제에 실패했습니다.");

      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    if (diffDay < 7) return `${diffDay}일 전`;

    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="py-8">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">분석 히스토리</h1>
        <p className="mt-1 text-sm text-muted">
          이전 로그 분석 세션을 확인하고 이어서 대화할 수 있습니다
        </p>
      </div>

      {/* 검색 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="시스템, 앱 이름으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted">불러오는 중...</span>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="mb-4 rounded-lg border border-error/50 bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && !error && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-card p-4">
            <Inbox className="h-10 w-10 text-muted" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">분석 기록이 없습니다</h2>
          <p className="mt-1 text-sm text-muted">
            로그 파일을 업로드하면 분석 기록이 여기에 표시됩니다
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            새 분석 시작
          </button>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {!isLoading && !error && sessions.length > 0 && filteredSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-10 w-10 text-muted" />
          <h2 className="mt-4 text-lg font-semibold">검색 결과가 없습니다</h2>
          <p className="mt-1 text-sm text-muted">
            &quot;{searchQuery}&quot;에 대한 결과를 찾을 수 없습니다
          </p>
        </div>
      )}

      {/* 세션 목록 */}
      {!isLoading && filteredSessions.length > 0 && (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => router.push(`/session/${session.id}`)}
              className="group cursor-pointer rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-card/80"
            >
              <div className="flex items-start justify-between gap-4">
                {/* 세션 정보 */}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold group-hover:text-primary">
                    {session.title}
                  </h3>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Monitor className="h-3.5 w-3.5" />
                      {session.systemInfoSummary}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(session.createdAt)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-3">
                    <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      <MessageSquare className="h-3 w-3" />
                      {session.messageCount}개 메시지
                    </span>
                    {session.issueCount > 0 && (
                      <span className="flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-xs text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        {session.issueCount}개 이슈
                      </span>
                    )}
                  </div>
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(session);
                  }}
                  className="rounded-lg p-2 text-muted opacity-0 transition-all hover:bg-error/10 hover:text-error group-hover:opacity-100"
                  aria-label="세션 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={!pagination.hasPrev}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          <span className="px-4 text-sm text-muted">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!pagination.hasNext}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg">
            <h3 className="text-lg font-semibold">세션 삭제</h3>
            <p className="mt-2 text-sm text-muted">
              &quot;{deleteTarget.title}&quot; 세션을 삭제하시겠습니까?
              <br />
              모든 대화 내용과 파일이 삭제되며 복구할 수 없습니다.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium transition-colors hover:bg-card"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-error py-2.5 text-sm font-medium text-white transition-colors hover:bg-error/90 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  "삭제"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
