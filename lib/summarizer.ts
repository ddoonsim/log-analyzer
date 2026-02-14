import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "./db";
import { SUMMARIZATION_PROMPT } from "./prompts";
import { estimateTokens } from "./context-builder";

/**
 * DB에서 세션의 최신 요약 조회
 */
export async function getLatestSummary(sessionId: string) {
  return prisma.conversationSummary.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Claude API로 오래된 메시지 요약 생성 + DB 저장
 */
export async function summarizeOldMessages(
  sessionId: string,
  messages: Array<{ id: string; role: string; content: string }>,
  existingSummary: string | null
): Promise<string> {
  // 요약할 메시지들을 대화 형식으로 구성
  const conversationText = messages
    .map((msg) => `[${msg.role === "user" ? "사용자" : "AI"}]: ${msg.content}`)
    .join("\n\n");

  const userPrompt = existingSummary
    ? `## 이전 요약\n${existingSummary}\n\n## 새로운 대화 내용 (요약에 통합 필요)\n${conversationText}`
    : `## 요약할 대화 내용\n${conversationText}`;

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SUMMARIZATION_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: 2048,
  });

  // DB에 요약 저장
  const lastMessage = messages[messages.length - 1];
  await prisma.conversationSummary.create({
    data: {
      sessionId,
      summary: text,
      summarizedUpToId: lastMessage.id,
      messageCount: messages.length,
    },
  });

  return text;
}

/**
 * 토큰 예산 체크 후 필요 시 요약 트리거
 * onFinish에서 비동기로 호출 — 응답을 차단하지 않음
 */
export async function checkAndSummarizeIfNeeded(
  sessionId: string
): Promise<void> {
  try {
    const MAX_CONTEXT_TOKENS = 200_000;
    const RESERVED_TOKENS = 30_000; // 시스템 프롬프트 + 파일 + 출력 + 안전 마진
    const CONVERSATION_BUDGET = MAX_CONTEXT_TOKENS - RESERVED_TOKENS;
    const SUMMARIZATION_THRESHOLD = 0.8;
    const RECENT_MESSAGES_TO_KEEP = 6;

    // 전체 메시지 조회
    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    if (messages.length <= RECENT_MESSAGES_TO_KEEP + 1) {
      return; // 메시지가 충분하지 않으면 요약 불필요
    }

    // 전체 대화 토큰 계산
    const totalTokens = messages.reduce(
      (sum, msg) => sum + estimateTokens(msg.content),
      0
    );

    if (totalTokens < CONVERSATION_BUDGET * SUMMARIZATION_THRESHOLD) {
      return; // 임계값 미만이면 요약 불필요
    }

    // 요약 대상: Zone A(첫 메시지) 제외, Zone C(최근 6개) 제외 → Zone B
    const zoneBMessages = messages.slice(1, -RECENT_MESSAGES_TO_KEEP);

    if (zoneBMessages.length === 0) {
      return;
    }

    // 기존 요약 조회
    const existingSummary = await getLatestSummary(sessionId);

    // 이전 요약이 있으면 증분 요약: 이전 요약 이후의 메시지만 요약
    let messagesToSummarize = zoneBMessages;
    let previousSummaryText: string | null = null;

    if (existingSummary) {
      const lastSummarizedIdx = zoneBMessages.findIndex(
        (m) => m.id === existingSummary.summarizedUpToId
      );

      if (lastSummarizedIdx >= 0 && lastSummarizedIdx < zoneBMessages.length - 1) {
        // 이전 요약 이후의 새 메시지만 요약
        messagesToSummarize = zoneBMessages.slice(lastSummarizedIdx + 1);
        previousSummaryText = existingSummary.summary;
      } else if (lastSummarizedIdx === zoneBMessages.length - 1) {
        // 이미 모든 Zone B 메시지가 요약됨
        return;
      }
      // lastSummarizedIdx === -1: 이전 요약의 마지막 메시지가 Zone B에 없음 → 전체 재요약
    }

    if (messagesToSummarize.length === 0) {
      return;
    }

    await summarizeOldMessages(
      sessionId,
      messagesToSummarize.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })),
      previousSummaryText
    );
  } catch (error) {
    // 요약 실패는 치명적이지 않음 — 로그만 남기고 계속 진행
    console.error("대화 요약 생성 실패:", error);
  }
}
