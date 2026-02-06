import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { anthropic, MODEL, MAX_TOKENS } from "@/lib/claude";
import { buildInitialAnalysisPrompt, SYSTEM_PROMPT } from "@/lib/prompts";
import { processNewFile } from "@/lib/context-builder";

// GET: 모든 세션 목록 조회 (페이지네이션)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    // 전체 세션 수 조회
    const totalCount = await prisma.session.count();

    // 세션 목록 조회 (최신순, 메시지 수 포함)
    const sessions = await prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    // 응답 데이터 가공
    const formattedSessions = sessions.map((session) => {
      let systemInfoSummary = "";
      try {
        const info = JSON.parse(session.systemInfo);
        const parts = [info.appName, info.os, info.environment].filter(Boolean);
        systemInfoSummary = parts.join(" | ") || "정보 없음";
      } catch {
        systemInfoSummary = "정보 없음";
      }

      return {
        id: session.id,
        title: session.title || "제목 없음",
        systemInfoSummary,
        messageCount: session._count.messages,
        issueCount: session.issueCount,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
    });

    return NextResponse.json({
      sessions: formattedSessions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: skip + sessions.length < totalCount,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("세션 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "세션 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

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

    // 4. Claude API로 초기 분석 요청 (토큰 제한 적용)
    const optimizedFiles = fileContents.map((f) => {
      const processed = processNewFile(f.filename, f.content);
      return {
        filename: processed.filename,
        content: processed.content,
      };
    });

    const analysisPrompt = buildInitialAnalysisPrompt(systemInfo, optimizedFiles);

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

    // AI로 간단한 제목 생성
    let generatedTitle = session.title;
    try {
      const titleResponse = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 50,
        messages: [
          {
            role: "user",
            content: `다음 로그 분석 결과를 보고, 핵심 이슈를 요약하는 짧은 제목을 한국어로 만들어줘.
제목만 출력해. 따옴표나 부가 설명 없이 제목 텍스트만.
15자 이내로 간결하게. 예시: "Nginx 502 에러 분석", "Jira 메모리 이슈", "DB 연결 타임아웃"

분석 결과:
${analysisResult.slice(0, 1000)}`,
          },
        ],
      });

      const titleBlock = titleResponse.content.find((block) => block.type === "text");
      if (titleBlock) {
        generatedTitle = titleBlock.text.trim().replace(/^["']|["']$/g, "");
      }
    } catch (titleError) {
      console.error("제목 생성 오류:", titleError);
    }

    await prisma.session.update({
      where: { id: session.id },
      data: {
        title: generatedTitle,
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
