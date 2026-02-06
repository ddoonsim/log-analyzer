import { NextRequest } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "@/lib/db";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import {
  buildChatContext,
  formatFilesForPrompt,
  processNewFile,
} from "@/lib/context-builder";

export async function POST(request: NextRequest) {
  try {
    // 1. sessionId와 새 메시지 받기
    const formData = await request.formData();
    const sessionId = formData.get("sessionId") as string;
    const message = formData.get("message") as string;
    const files = formData.getAll("files") as File[];

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId가 필요합니다" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!message && files.length === 0) {
      return new Response(
        JSON.stringify({ error: "메시지 또는 파일이 필요합니다" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. 컨텍스트 빌더로 세션 정보 조회
    const context = await buildChatContext(sessionId);

    if (!context) {
      return new Response(
        JSON.stringify({ error: "세션을 찾을 수 없습니다" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. 새 메시지에 첨부 파일 있으면 저장
    const attachedFiles: { id: string; filename: string }[] = [];
    let newFileContext = "";

    if (files.length > 0) {
      for (const file of files) {
        const content = await file.text();

        const savedFile = await prisma.file.create({
          data: {
            sessionId,
            filename: file.name,
            mimeType: file.type || "text/plain",
            size: file.size,
            content,
          },
        });

        attachedFiles.push({ id: savedFile.id, filename: savedFile.filename });

        // 토큰 제한 적용하여 파일 처리
        const processedFile = processNewFile(file.name, content);
        newFileContext += `\n\n### 새로 첨부된 파일: ${processedFile.filename}${processedFile.truncated ? " (일부 표시)" : ""}
\`\`\`
${processedFile.content}
\`\`\``;
      }
    }

    // 6. 사용자 메시지 DB 저장
    const userMessage = await prisma.message.create({
      data: {
        sessionId,
        role: "user",
        content: message || "(파일 첨부)",
        attachedFiles: {
          connect: attachedFiles.map((f) => ({ id: f.id })),
        },
      },
    });

    // 4. 전체 시스템 프롬프트 구성
    const filesContent = formatFilesForPrompt(context.files);
    const fullSystemPrompt = `${SYSTEM_PROMPT}

${context.systemPromptContext}

## 초기 업로드된 로그 파일
${filesContent}`;

    // 대화 히스토리 구성
    const conversationHistory = [...context.messages];

    // 현재 메시지 추가 (파일 컨텍스트 포함)
    const currentMessageContent = newFileContext
      ? `${message || "첨부된 파일을 분석해주세요."}${newFileContext}`
      : message;

    conversationHistory.push({
      role: "user" as const,
      content: currentMessageContent,
    });

    // 5. Claude API 스트리밍 호출
    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: fullSystemPrompt,
      messages: conversationHistory,
      maxTokens: 4096,
      // 7. 스트리밍 완료 후 assistant 메시지 DB 저장
      onFinish: async ({ text }) => {
        await prisma.message.create({
          data: {
            sessionId,
            role: "assistant",
            content: text,
          },
        });

        // 세션 업데이트
        await prisma.session.update({
          where: { id: sessionId },
          data: { updatedAt: new Date() },
        });
      },
    });

    // 스트리밍 응답 반환
    const response = result.toDataStreamResponse();

    // 커스텀 헤더 추가
    response.headers.set("X-User-Message-Id", userMessage.id);
    response.headers.set("X-Attached-Files", JSON.stringify(attachedFiles));

    return response;
  } catch (error) {
    console.error("채팅 오류:", error);
    return new Response(
      JSON.stringify({ error: "메시지 처리에 실패했습니다" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
