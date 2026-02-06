import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { anthropic, MODEL, MAX_TOKENS } from "@/lib/claude";
import { SYSTEM_PROMPT } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const sessionId = formData.get("sessionId") as string;
    const message = formData.get("message") as string;
    const files = formData.getAll("files") as File[];

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId가 필요합니다" },
        { status: 400 }
      );
    }

    if (!message && files.length === 0) {
      return NextResponse.json(
        { error: "메시지 또는 파일이 필요합니다" },
        { status: 400 }
      );
    }

    // 세션 확인
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        files: true,
        messages: {
          orderBy: { createdAt: "asc" },
          include: { attachedFiles: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "세션을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 첨부 파일 처리
    const attachedFiles: { id: string; filename: string }[] = [];
    let fileContextText = "";

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
        fileContextText += `\n\n### 새로 첨부된 파일: ${file.name}\n\`\`\`\n${content}\n\`\`\``;
      }
    }

    // 사용자 메시지 저장
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

    // 대화 히스토리 구성
    const systemInfo = JSON.parse(session.systemInfo);
    const systemContext = `## 시스템 정보
- 운영체제: ${systemInfo.os || "미지정"}
- 애플리케이션: ${systemInfo.appName || "미지정"}
- 버전: ${systemInfo.appVersion || "미지정"}
- 환경: ${systemInfo.environment || "미지정"}
${systemInfo.notes ? `- 기타: ${systemInfo.notes}` : ""}

## 업로드된 로그 파일
${session.files.map((f) => `- ${f.filename} (${f.size} bytes)`).join("\n")}
`;

    const conversationHistory = session.messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // 현재 메시지 추가 (파일 컨텍스트 포함)
    const currentMessageContent = fileContextText
      ? `${message || "첨부된 파일을 분석해주세요."}${fileContextText}`
      : message;

    conversationHistory.push({
      role: "user",
      content: currentMessageContent,
    });

    // Claude API 호출
    let assistantResponse: string;

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: `${SYSTEM_PROMPT}\n\n${systemContext}`,
        messages: conversationHistory,
      });

      const textBlock = response.content.find((block) => block.type === "text");
      assistantResponse = textBlock
        ? textBlock.text
        : "응답을 생성할 수 없습니다.";
    } catch (apiError) {
      console.error("Claude API 오류:", apiError);
      assistantResponse =
        "AI 응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }

    // assistant 메시지 저장
    const assistantMessage = await prisma.message.create({
      data: {
        sessionId,
        role: "assistant",
        content: assistantResponse,
      },
    });

    // 세션 업데이트
    await prisma.session.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        attachedFiles,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    });
  } catch (error) {
    console.error("채팅 오류:", error);
    return NextResponse.json(
      { error: "메시지 처리에 실패했습니다" },
      { status: 500 }
    );
  }
}
