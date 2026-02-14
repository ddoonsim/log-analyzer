import { prisma } from "./db";
import { parseLog, buildLogSummary, formatEntryForPrompt } from "./parser";

// 대략적인 토큰 계산 (한글 1자 ≈ 2토큰, 영문 1단어 ≈ 1토큰)
// API 분당 제한(30,000 토큰)을 고려하여 시스템 프롬프트 + 대화 히스토리 공간 확보
const MAX_LOG_TOKENS = 15000; // 로그 컨텐츠 최대 토큰 (전체)
const MAX_FILE_TOKENS = 10000; // 파일당 최대 토큰

// 컨텍스트 윈도우 관리 상수
export const MAX_CONTEXT_TOKENS = 200_000;
export const MAX_OUTPUT_TOKENS = 4_096;
export const SAFETY_MARGIN = 10_000;
export const RECENT_MESSAGES_TO_KEEP = 6;
export const SUMMARIZATION_THRESHOLD = 0.8;

interface SystemInfo {
  os: string;
  appName: string;
  appVersion: string;
  environment: string;
  notes: string;
}

interface ProcessedFile {
  filename: string;
  content: string;
  originalSize: number;
  truncated: boolean;
  formatSummary?: string;
}

interface ChatContext {
  systemInfo: SystemInfo;
  files: ProcessedFile[];
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  systemPromptContext: string;
}

/**
 * 대략적인 토큰 수 계산
 */
export function estimateTokens(text: string): number {
  // 한글은 글자당 약 2토큰, 영문/숫자는 단어당 약 1토큰으로 추정
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars * 2 + otherChars * 0.3);
}

/**
 * 로그 내용 최적화 (구조화 파싱 + 에러/경고 우선 + 최근 로그 우선)
 */
function optimizeLogContent(
  content: string,
  maxTokens: number = MAX_FILE_TOKENS
): { content: string; truncated: boolean; formatSummary?: string } {
  // 파서로 구조화 파싱
  const parseResult = parseLog(content, { maxEntries: 2000 });
  const summary = buildLogSummary(parseResult);

  const currentTokens = estimateTokens(content);

  // 토큰 제한 이내면 요약만 앞에 붙여서 반환
  if (currentTokens <= maxTokens) {
    return { content, truncated: false, formatSummary: summary };
  }

  // 에러/경고 엔트리와 일반 엔트리 분리
  const issueEntries = parseResult.entries.filter(
    (e) => e.level === "fatal" || e.level === "error" || e.level === "warn"
  );
  const normalEntries = parseResult.entries.filter(
    (e) => e.level !== "fatal" && e.level !== "error" && e.level !== "warn"
  );

  const result: string[] = [];
  let usedTokens = 0;

  // 로그 분석 요약 헤더
  const header = `[로그 분석 요약]\n${summary}`;
  result.push(header);
  usedTokens += estimateTokens(header);

  // 에러/경고 엔트리 구조화 출력 (70% 예산)
  const errorBudget = maxTokens * 0.7;
  for (const entry of issueEntries) {
    const text = formatEntryForPrompt(entry);
    const tokens = estimateTokens(text);
    if (usedTokens + tokens <= errorBudget) {
      result.push(text);
      usedTokens += tokens;
    }
  }

  // 에러/경고 섹션 표시
  if (issueEntries.length > 0 && normalEntries.length > 0) {
    result.push("\n--- [에러/경고 외 로그 (최근)] ---\n");
    usedTokens += 20;
  }

  // 남은 공간에 최근 일반 로그 추가 (최신부터)
  for (let i = normalEntries.length - 1; i >= 0; i--) {
    const text = normalEntries[i].raw;
    const tokens = estimateTokens(text);
    if (usedTokens + tokens <= maxTokens) {
      result.push(text);
      usedTokens += tokens;
    } else {
      break;
    }
  }

  const truncationNotice = `[로그가 너무 길어 일부만 표시됩니다. 원본: ${parseResult.totalLines}줄, 에러/경고: ${issueEntries.length}건]`;

  return {
    content: truncationNotice + "\n\n" + result.join("\n"),
    truncated: true,
    formatSummary: summary,
  };
}

/**
 * 시스템 프롬프트용 컨텍스트 문자열 생성
 */
function buildSystemPromptContext(
  systemInfo: SystemInfo,
  files: ProcessedFile[]
): string {
  const systemInfoText = [
    systemInfo.os && `- 운영체제: ${systemInfo.os}`,
    systemInfo.appName && `- 애플리케이션: ${systemInfo.appName}`,
    systemInfo.appVersion && `- 버전: ${systemInfo.appVersion}`,
    systemInfo.environment && `- 환경: ${systemInfo.environment}`,
    systemInfo.notes && `- 기타: ${systemInfo.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  const fileList = files
    .map(
      (f) =>
        `- ${f.filename} (${f.originalSize} bytes)${f.truncated ? " [일부 표시]" : ""}`
    )
    .join("\n");

  return `## 세션 정보

### 시스템 정보
${systemInfoText || "제공된 정보 없음"}

### 업로드된 파일
${fileList || "없음"}`;
}

/**
 * 세션 컨텍스트 빌드 (메인 함수)
 */
export async function buildChatContext(
  sessionId: string
): Promise<ChatContext | null> {
  // 세션 조회
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      files: {
        orderBy: { uploadedAt: "asc" },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) {
    return null;
  }

  // 시스템 정보 파싱
  const systemInfo: SystemInfo = JSON.parse(session.systemInfo);

  // 파일 처리 (토큰 제한 적용)
  let totalLogTokens = 0;
  const processedFiles: ProcessedFile[] = [];

  for (const file of session.files) {
    // 메시지에 첨부된 파일은 제외 (히스토리에서 처리됨)
    if (file.messageId) continue;

    const remainingTokens = MAX_LOG_TOKENS - totalLogTokens;
    if (remainingTokens <= 0) {
      processedFiles.push({
        filename: file.filename,
        content: "[토큰 제한으로 생략됨]",
        originalSize: file.size,
        truncated: true,
      });
      continue;
    }

    const { content, truncated } = optimizeLogContent(
      file.content,
      Math.min(MAX_FILE_TOKENS, remainingTokens)
    );

    processedFiles.push({
      filename: file.filename,
      content,
      originalSize: file.size,
      truncated,
    });

    totalLogTokens += estimateTokens(content);
  }

  // 메시지 히스토리 구성
  const messages = session.messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // 시스템 프롬프트 컨텍스트
  const systemPromptContext = buildSystemPromptContext(systemInfo, processedFiles);

  return {
    systemInfo,
    files: processedFiles,
    messages,
    systemPromptContext,
  };
}

/**
 * 로그 파일 내용을 Claude 메시지 형식으로 변환
 */
export function formatFilesForPrompt(files: ProcessedFile[]): string {
  if (files.length === 0) return "업로드된 로그 파일 없음";

  return files
    .map(
      (file) => `### ${file.filename}${file.truncated ? " (일부 표시)" : ""}
\`\`\`
${file.content}
\`\`\``
    )
    .join("\n\n");
}

/**
 * 새로 첨부된 파일 처리
 */
export function processNewFile(
  filename: string,
  content: string,
  maxTokens: number = MAX_FILE_TOKENS
): ProcessedFile {
  const { content: optimizedContent, truncated, formatSummary } = optimizeLogContent(
    content,
    maxTokens
  );

  return {
    filename,
    content: optimizedContent,
    originalSize: content.length,
    truncated,
    formatSummary,
  };
}

/**
 * 윈도우 컨텍스트 빌더 — 3-Zone 메시지 윈도우 적용
 *
 * [Zone A] 초기 분석 (항상 유지) — messages[0]
 * [Zone B] 중간 메시지 → 요약으로 압축
 * [Zone C] 최근 메시지 (항상 유지) — 마지막 RECENT_MESSAGES_TO_KEEP개
 */
export async function buildChatContextWithWindowing(
  sessionId: string
): Promise<ChatContext | null> {
  // 기존 로직으로 세션/파일/메시지 로드
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      files: { orderBy: { uploadedAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) return null;

  const systemInfo: SystemInfo = JSON.parse(session.systemInfo);

  // 파일 처리 (토큰 제한 적용)
  let totalLogTokens = 0;
  const processedFiles: ProcessedFile[] = [];

  for (const file of session.files) {
    if (file.messageId) continue;

    const remainingTokens = MAX_LOG_TOKENS - totalLogTokens;
    if (remainingTokens <= 0) {
      processedFiles.push({
        filename: file.filename,
        content: "[토큰 제한으로 생략됨]",
        originalSize: file.size,
        truncated: true,
      });
      continue;
    }

    const { content, truncated } = optimizeLogContent(
      file.content,
      Math.min(MAX_FILE_TOKENS, remainingTokens)
    );

    processedFiles.push({
      filename: file.filename,
      content,
      originalSize: file.size,
      truncated,
    });

    totalLogTokens += estimateTokens(content);
  }

  const systemPromptContext = buildSystemPromptContext(systemInfo, processedFiles);

  // 시스템 프롬프트 + 파일 토큰 계산 → 대화 예산 산출
  const systemTokens = estimateTokens(systemPromptContext) + totalLogTokens;
  const conversationBudget =
    MAX_CONTEXT_TOKENS - systemTokens - MAX_OUTPUT_TOKENS - SAFETY_MARGIN;

  // 전체 메시지 토큰 계산
  const allMessages = session.messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  const totalMessageTokens = allMessages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );

  // 예산 내면 그대로 반환
  if (totalMessageTokens <= conversationBudget) {
    return { systemInfo, files: processedFiles, messages: allMessages, systemPromptContext };
  }

  // 예산 초과 → 3-Zone 윈도우 적용
  const { getLatestSummary } = await import("./summarizer");
  const latestSummary = await getLatestSummary(sessionId);

  // Zone A: 첫 번째 메시지 (초기 분석)
  const zoneA = allMessages.length > 0 ? [allMessages[0]] : [];

  // Zone C: 최근 메시지
  const zoneCStart = Math.max(1, allMessages.length - RECENT_MESSAGES_TO_KEEP);
  const zoneC = allMessages.slice(zoneCStart);

  // Zone B: 요약 메시지 구성
  const zoneB: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (latestSummary) {
    zoneB.push({
      role: "user",
      content: `[이전 대화 요약]\n${latestSummary.summary}`,
    });
    zoneB.push({
      role: "assistant",
      content: "네, 이전 대화 내용을 이해했습니다. 요약된 내용을 바탕으로 계속 도와드리겠습니다.",
    });
  }
  // 요약이 없으면 Zone B를 단순 생략 (fallback)

  const windowedMessages = [...zoneA, ...zoneB, ...zoneC];

  return {
    systemInfo,
    files: processedFiles,
    messages: windowedMessages,
    systemPromptContext,
  };
}
