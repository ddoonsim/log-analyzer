"use client";

import { User, Bot, File } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AttachedFile {
  id: string;
  filename: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  attachedFiles?: AttachedFile[];
  createdAt?: Date;
}

export default function ChatMessage({
  role,
  content,
  attachedFiles,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* 아바타 */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary" : "bg-card border border-border"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* 메시지 내용 */}
      <div
        className={`max-w-[80%] space-y-2 ${isUser ? "items-end" : "items-start"}`}
      >
        {/* 첨부 파일 */}
        {attachedFiles && attachedFiles.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${isUser ? "justify-end" : ""}`}>
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-1.5 rounded bg-background px-2 py-1 text-xs text-muted"
                data-tooltip={file.filename}
              >
                <File className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{file.filename}</span>
              </div>
            ))}
          </div>
        )}

        {/* 메시지 본문 */}
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? "bg-primary text-white"
              : "bg-card border border-border"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none text-foreground">
              <ReactMarkdown
                components={{
                  pre: ({ children }) => (
                    <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs">
                      {children}
                    </pre>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="rounded bg-background px-1.5 py-0.5 text-xs">
                        {children}
                      </code>
                    ) : (
                      <code>{children}</code>
                    );
                  },
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 space-y-1">{children}</ol>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
