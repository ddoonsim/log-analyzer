import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { File } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: Props) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      files: true,
      messages: {
        orderBy: { createdAt: "asc" },
        include: { attachedFiles: true },
      },
    },
  });

  if (!session) {
    notFound();
  }

  const systemInfo = JSON.parse(session.systemInfo);

  // 초기 업로드 파일 (메시지에 연결되지 않은 파일)
  const initialFiles = session.files.filter((f) => !f.messageId);

  // 메시지 데이터 변환
  const messages = session.messages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    attachedFiles: msg.attachedFiles.map((f) => ({
      id: f.id,
      filename: f.filename,
    })),
    createdAt: msg.createdAt,
  }));

  return (
    <div className="flex flex-col">
      {/* 세션 헤더 */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h1 className="text-xl font-bold">{session.title}</h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
          {systemInfo.os && (
            <span className="rounded bg-background px-2 py-0.5">
              {systemInfo.os}
            </span>
          )}
          {systemInfo.appName && (
            <span className="rounded bg-background px-2 py-0.5">
              {systemInfo.appName}
            </span>
          )}
          {systemInfo.appVersion && (
            <span className="rounded bg-background px-2 py-0.5">
              v{systemInfo.appVersion}
            </span>
          )}
          {systemInfo.environment && (
            <span className="rounded bg-background px-2 py-0.5">
              {systemInfo.environment}
            </span>
          )}
        </div>
        {/* 초기 업로드 파일 목록 */}
        {initialFiles.length > 0 && (
          <div className="mt-3">
            <p className="text-sm text-muted mb-2">
              업로드된 파일 ({initialFiles.length}개)
            </p>
            <div className="flex flex-wrap gap-2">
              {initialFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-1.5 rounded-lg bg-background px-2.5 py-1.5 text-sm"
                  data-tooltip={file.filename}
                >
                  <File className="h-3.5 w-3.5 text-muted" />
                  <span className="max-w-[200px] truncate">{file.filename}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 채팅 인터페이스 */}
      <ChatInterface sessionId={session.id} initialMessages={messages} />
    </div>
  );
}
