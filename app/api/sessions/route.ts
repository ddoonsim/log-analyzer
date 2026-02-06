import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { anthropic, MODEL, MAX_TOKENS } from "@/lib/claude";
import { buildInitialAnalysisPrompt, SYSTEM_PROMPT } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  try {
    // 1. 파일들과 시스템 정보 받기
    const formData = await request.formData();

    const systemInfo = {
      os: (formData.get("os") as string) || "",
      appName: (formData.get("appName") as string) || "",
      appVersion: (formData.get("appVersion") as string) || "",
      environment: (formData.get("environment") as string) || "",
      notes: (formData.get("notes") as string) || "",
    };

    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "최소 1개 이상의 파일이 필요합니다" },
        { status: 400 }
      );
    }

    // 파일 내용 읽기
    const fileContents = await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        mimeType: file.type || "text/plain",
        size: file.size,
        content: await file.text(),
      }))
    );

    // 2. DB에 새 Session 생성
    const session = await prisma.session.create({
      data: {
        title: systemInfo.appName
          ? `${systemInfo.appName} 로그 분석`
          : "로그 분석",
        systemInfo: JSON.stringify(systemInfo),
      },
    });

    // 3. 파일들 File 테이블에 저장
    await prisma.file.createMany({
      data: fileContents.map((file) => ({
        sessionId: session.id,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        content: file.content,
      })),
    });

    // 4. Claude API로 초기 분석 요청
    const analysisPrompt = buildInitialAnalysisPrompt(
      systemInfo,
      fileContents.map((f) => ({ filename: f.filename, content: f.content }))
    );

    let analysisResult: string;

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
      });

      // 응답에서 텍스트 추출
      const textBlock = response.content.find((block) => block.type === "text");
      analysisResult = textBlock ? textBlock.text : "분석 결과를 생성할 수 없습니다.";
    } catch (apiError) {
      console.error("Claude API 오류:", apiError);
      analysisResult =
        "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.\n\n업로드된 파일은 저장되었으며, 채팅을 통해 분석을 요청할 수 있습니다.";
    }

    // 5. 분석 결과를 첫 번째 assistant 메시지로 저장
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: analysisResult,
      },
    });

    // 세션 요약 및 이슈 카운트 업데이트
    const issueCount = (analysisResult.match(/에러|오류|ERROR|WARN|경고|Exception|Failed/gi) || []).length;

    await prisma.session.update({
      where: { id: session.id },
      data: {
        summary: analysisResult.slice(0, 500),
        issueCount: Math.min(issueCount, 99),
      },
    });

    // 6. sessionId 반환
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("세션 생성 오류:", error);

    // Prisma 에러 처리
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        return NextResponse.json(
          { error: "중복된 데이터가 존재합니다" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "세션 생성에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
