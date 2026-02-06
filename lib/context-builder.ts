import { prisma } from "./db";

// 대략적인 토큰 계산 (한글 1자 ≈ 2토큰, 영문 1단어 ≈ 1토큰)
// API 분당 제한(30,000 토큰)을 고려하여 시스템 프롬프트 + 대화 히스토리 공간 확보
const MAX_LOG_TOKENS = 15000; // 로그 컨텐츠 최대 토큰 (전체)
const MAX_FILE_TOKENS = 10000; // 파일당 최대 토큰

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

// 에러/경고 패턴
const ERROR_PATTERNS = [
  /error/i,
  /exception/i,
  /failed/i,
  /failure/i,
  /fatal/i,
  /critical/i,
  /warn/i,
  /warning/i,
  /denied/i,
  /refused/i,
  /timeout/i,
  /timed out/i,
  /not found/i,
  /없음/,
  /실패/,
  /오류/,
  /에러/,
  /경고/,
];

/**
 * 로그 라인이 에러/경고인지 확인
 */
function isImportantLine(line: string): boolean {
  return ERROR_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * 대략적인 토큰 수 계산
 */
function estimateTokens(text: string): number {
  // 한글은 글자당 약 2토큰, 영문/숫자는 단어당 약 1토큰으로 추정
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const otherChars = text.length - koreanChars;
  return Math.ceil(koreanChars * 2 + otherChars * 0.3);
}

/**
 * 로그 내용 최적화 (에러/경고 우선, 최근 로그 우선)
 */
function optimizeLogContent(
  content: string,
  maxTokens: number = MAX_FILE_TOKENS
): { content: string; truncated: boolean } {
  const currentTokens = estimateTokens(content);

  // 토큰 제한 이내면 그대로 반환
  if (currentTokens <= maxTokens) {
    return { content, truncated: false };
  }

  const lines = content.split("\n");

  // 1. 에러/경고 라인 추출
  const importantLines: { index: number; line: string }[] = [];
  const normalLines: { index: number; line: string }[] = [];

  lines.forEach((line, index) => {
    if (isImportantLine(line)) {
      importantLines.push({ index, line });
    } else {
      normalLines.push({ index, line });
    }
  });

  // 2. 결과 구성 (에러/경고 + 최근 일반 로그)
  let result: string[] = [];
  let usedTokens = 0;

  // 에러/경고 라인 우선 추가
  for (const { line } of importantLines) {
    const lineTokens = estimateTokens(line);
    if (usedTokens + lineTokens <= maxTokens * 0.7) {
      result.push(line);
      usedTokens += lineTokens;
    }
  }

  // 에러/경고 섹션 표시
  if (importantLines.length > 0 && normalLines.length > 0) {
    result.push("\n--- [에러/경고 외 로그 (최근)] ---\n");
    usedTokens += 20;
  }

  // 남은 공간에 최근 일반 로그 추가 (역순으로)
  const recentNormalLines = normalLines.slice(-Math.floor(normalLines.length * 0.3));
  for (let i = recentNormalLines.length - 1; i >= 0; i--) {
    const { line } = recentNormalLines[i];
    const lineTokens = estimateTokens(line);
    if (usedTokens + lineTokens <= maxTokens) {
      result.push(line);
      usedTokens += lineTokens;
    } else {
      break;
    }
  }

  // truncation 표시 추가
  const truncationNotice = `\n\n[로그가 너무 길어 일부만 표시됩니다. 원본: ${lines.length}줄, 표시: ${result.length}줄]\n[에러/경고: ${importantLines.length}건 포함]`;

  return {
    content: truncationNotice + "\n\n" + result.join("\n"),
    truncated: true,
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
  const { content: optimizedContent, truncated } = optimizeLogContent(
    content,
    maxTokens
  );

  return {
    filename,
    content: optimizedContent,
    originalSize: content.length,
    truncated,
  };
}
