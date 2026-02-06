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
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSend = async (message: string, files: File[]) => {
    setIsLoading(true);
    setError(null);
    setStreamingContent("");

    // 임시 사용자 메시지 추가
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

      // AbortController for cancellation
      abortControllerRef.current = new AbortController();

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errorMessage = "메시지 전송에 실패했습니다";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // JSON 파싱 실패 시 기본 에러 메시지 사용
        }
        throw new Error(errorMessage);
      }

      // 헤더에서 사용자 메시지 정보 추출
      const userMessageId = response.headers.get("X-User-Message-Id");
      const attachedFilesHeader = response.headers.get("X-Attached-Files");
      let attachedFiles: AttachedFile[] = [];
      if (attachedFilesHeader) {
        try {
          attachedFiles = JSON.parse(attachedFilesHeader);
        } catch {
          // 헤더 파싱 실패 시 빈 배열 사용
        }
      }

      // 임시 메시지를 실제 메시지로 교체
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempUserMessage.id
            ? {
                ...m,
                id: userMessageId || m.id,
                attachedFiles,
              }
            : m
        )
      );

      // 스트리밍 응답 처리
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setStreamingContent(fullContent);
        }
      }

      // 스트리밍 완료 후 assistant 메시지 추가
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: fullContent,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // 취소된 요청
        return;
      }
      // 에러 시 임시 메시지 제거
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
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

        {/* 스트리밍 중인 응답 */}
        {streamingContent && (
          <ChatMessage
            role="assistant"
            content={streamingContent}
            createdAt={new Date()}
          />
        )}

        {/* 로딩 인디케이터 (스트리밍 시작 전) */}
        {isLoading && !streamingContent && (
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
