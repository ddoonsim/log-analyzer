"use client";

import { useState, useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

interface AttachedFile {
  id: string;
  filename: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachedFiles?: AttachedFile[];
  createdAt: Date;
}

interface ChatInterfaceProps {
  sessionId: string;
  initialMessages: Message[];
}

export default function ChatInterface({
  sessionId,
  initialMessages,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (message: string, files: File[]) => {
    setIsLoading(true);
    setError(null);

    // 임시 사용자 메시지 추가 (낙관적 업데이트)
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: message || "(파일 첨부)",
      attachedFiles: files.map((f, i) => ({
        id: `temp-file-${i}`,
        filename: f.name,
      })),
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("message", message);
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "메시지 전송에 실패했습니다");
      }

      const { userMessage, assistantMessage } = await response.json();

      // 실제 응답으로 메시지 업데이트
      setMessages((prev) => {
        // 임시 메시지 제거 후 실제 메시지 추가
        const withoutTemp = prev.filter((m) => m.id !== tempUserMessage.id);
        return [
          ...withoutTemp,
          {
            ...userMessage,
            createdAt: new Date(userMessage.createdAt),
          },
          {
            ...assistantMessage,
            createdAt: new Date(assistantMessage.createdAt),
          },
        ];
      });
    } catch (err) {
      // 에러 시 임시 메시지 제거
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col rounded-xl border border-border bg-card">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            content={message.content}
            attachedFiles={message.attachedFiles}
            createdAt={message.createdAt}
          />
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card border border-border">
              <div className="h-4 w-4 animate-pulse rounded-full bg-primary" />
            </div>
            <div className="rounded-2xl bg-card border border-border px-4 py-2.5">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-muted" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-error/50 bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
