// ============================================================
// 타입 정의
// ============================================================

/** 지원하는 로그 포맷 */
export type LogFormat =
  | "json"
  | "ndjson"
  | "syslog"
  | "atlassian"
  | "nginx"
  | "apache"
  | "java-stacktrace"
  | "plain";

/** 로그 심각도 레벨 */
export type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "unknown";

/** 파싱된 로그 엔트리 */
export interface LogEntry {
  lineNumber: number;
  timestamp: string | null;
  level: LogLevel;
  message: string;
  source: string | null;
  stackTrace: string | null;
  raw: string;
}

/** 포맷 감지 결과 */
export interface FormatDetectionResult {
  format: LogFormat;
  confidence: number;
  sampleSize: number;
}

/** 파싱 결과 */
export interface ParseResult {
  format: FormatDetectionResult;
  totalLines: number;
  entries: LogEntry[];
  stats: LogStats;
}

/** 로그 통계 */
export interface LogStats {
  totalEntries: number;
  levelCounts: Record<LogLevel, number>;
  timeRange: { start: string | null; end: string | null };
  hasStackTraces: boolean;
  stackTraceCount: number;
}

/** parseLog 옵션 */
export interface ParseOptions {
  format?: LogFormat;
  maxEntries?: number;
  includeRaw?: boolean;
}

// ============================================================
// 상수 및 패턴
// ============================================================

// 포맷 감지용 regex
const RE_JSON_LINE = /^\s*\{.*\}\s*$/;
const RE_SYSLOG = /^<\d{1,3}>(?:\d\s+\d{4}-|[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/;
const RE_ATLASSIAN = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3}\s+(?:TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+\[/;
const RE_WEBSERVER = /^\S+\s+\S+\s+\S+\s+\[\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4}]\s+"/;
const RE_JAVA_EXCEPTION = /(?:Exception|Error)(?::\s|\s+at\s)/;
const RE_JAVA_AT_LINE = /^\s+at\s+/;

// 파싱용 regex
const RE_ATLASSIAN_ENTRY = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+\[([^\]]+)]\s*(.*)/;
const RE_SYSLOG_3164 = /^(?:<(\d{1,3})>)?([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)])?\s*:\s*(.*)/;
const RE_SYSLOG_5424 = /^(?:<(\d{1,3})>)?(\d)\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)/;
const RE_COMBINED_LOG = /^(\S+)\s+(\S+)\s+(\S+)\s+\[(\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4})]\s+"(\S+)\s+(.*?)\s+(\S+)"\s+(\d{3})\s+(\S+)(?:\s+"([^"]*)")?(?:\s+"([^"]*)")?/;
const RE_EXCEPTION_START = /^([\w.$]*(?:Exception|Error|Throwable))(?::\s*(.*))?$/;
const RE_CAUSED_BY = /^Caused by:\s+(.*)/;
const RE_STACK_ELLIPSIS = /^\s+\.\.\.\s+\d+\s+more/;
const RE_GENERIC_TIMESTAMP = /(\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?)/;
const RE_GENERIC_LEVEL = /\b(FATAL|CRITICAL|EMERGENCY|ERROR|ERR|WARN(?:ING)?|INFO|NOTICE|DEBUG|TRACE)\b/i;

// 레벨 정규화 맵
const LEVEL_MAP: Record<string, LogLevel> = {
  fatal: "fatal", critical: "fatal", emergency: "fatal", emerg: "fatal",
  error: "error", err: "error", severe: "error",
  warn: "warn", warning: "warn",
  info: "info", information: "info", notice: "info",
  debug: "debug", fine: "debug",
  trace: "trace", finest: "trace", verbose: "trace",
};

// JSON 필드명 매핑
const TIMESTAMP_FIELDS = ["timestamp", "time", "@timestamp", "ts", "date", "datetime", "eventTime"];
const LEVEL_FIELDS = ["level", "severity", "loglevel", "log_level", "priority", "lvl"];
const MESSAGE_FIELDS = ["message", "msg", "text", "log", "body"];
const SOURCE_FIELDS = ["logger", "source", "class", "module", "component", "logger_name"];
const STACK_FIELDS = ["stackTrace", "stack_trace", "stack", "exception", "error.stack", "stacktrace"];

// 월 이름 맵 (syslog/webserver 타임스탬프 변환)
const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

// ============================================================
// 유틸리티
// ============================================================

function normalizeLevel(raw: string): LogLevel {
  return LEVEL_MAP[raw.toLowerCase()] || "unknown";
}

function normalizeContent(content: string): string {
  // BOM 제거 + 줄바꿈 정규화
  return content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function getLines(content: string): string[] {
  return content.split("\n");
}

function findJsonField(obj: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of candidates) {
    if (key in obj) return obj[key];
  }
  // 대소문자 무시 검색
  const lowerCandidates = candidates.map((c) => c.toLowerCase());
  for (const key of Object.keys(obj)) {
    const idx = lowerCandidates.indexOf(key.toLowerCase());
    if (idx !== -1) return obj[key];
  }
  return undefined;
}

function syslogSeverityToLevel(priority: number): LogLevel {
  const severity = priority % 8;
  if (severity <= 2) return "fatal";
  if (severity === 3) return "error";
  if (severity === 4) return "warn";
  if (severity <= 6) return "info";
  return "debug";
}

function parseWebTimestamp(raw: string): string | null {
  // "15/Jan/2024:10:30:45 +0900" -> ISO
  const m = raw.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})/);
  if (!m) return null;
  const month = MONTH_MAP[m[2]];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1]}T${m[4]}${m[5].slice(0, 3)}:${m[5].slice(3)}`;
}

function parseSyslog3164Timestamp(raw: string): string | null {
  // "Jan 15 10:30:45" -> ISO (현재 연도 사용)
  const m = raw.match(/([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/);
  if (!m) return null;
  const month = MONTH_MAP[m[1]];
  if (!month) return null;
  const day = m[2].padStart(2, "0");
  const year = new Date().getFullYear();
  return `${year}-${month}-${day}T${m[3]}`;
}

function httpStatusToLevel(status: number): LogLevel {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

function isStackTraceLine(line: string): boolean {
  return RE_JAVA_AT_LINE.test(line) || RE_CAUSED_BY.test(line) || RE_STACK_ELLIPSIS.test(line);
}

// ============================================================
// 포맷 감지
// ============================================================

export function detectFormat(content: string, sampleLines: number = 50): FormatDetectionResult {
  const normalized = normalizeContent(content);
  const lines = getLines(normalized);
  const sample = lines.slice(0, sampleLines).filter((l) => l.trim().length > 0);

  if (sample.length === 0) {
    return { format: "plain", confidence: 0, sampleSize: 0 };
  }

  const scores: Record<string, number> = {
    json: 0, syslog: 0, atlassian: 0, webserver: 0, javaStack: 0,
  };

  for (const line of sample) {
    if (RE_JSON_LINE.test(line)) scores.json++;
    if (RE_SYSLOG.test(line)) scores.syslog++;
    if (RE_ATLASSIAN.test(line)) scores.atlassian++;
    if (RE_WEBSERVER.test(line)) scores.webserver++;
    if (RE_JAVA_AT_LINE.test(line) || RE_JAVA_EXCEPTION.test(line)) scores.javaStack++;
  }

  const total = sample.length;

  // JSON 형태가 대부분이면 JSON/NDJSON
  if (scores.json / total >= 0.5) {
    // 여러 줄이면 NDJSON, 한 줄이면 JSON
    const format: LogFormat = scores.json > 1 ? "ndjson" : "json";
    return { format, confidence: scores.json / total, sampleSize: total };
  }

  // 특정 포맷 우선순위로 판별
  const candidates: { format: LogFormat; score: number }[] = [
    { format: "atlassian", score: scores.atlassian },
    { format: "syslog", score: scores.syslog },
    { format: "nginx", score: scores.webserver },
    { format: "java-stacktrace", score: scores.javaStack },
  ];

  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (best.score / total >= 0.3) {
    return { format: best.format, confidence: best.score / total, sampleSize: total };
  }

  return { format: "plain", confidence: 1, sampleSize: total };
}

// ============================================================
// 포맷별 파서
// ============================================================

type FormatParser = (lines: string[], maxEntries?: number) => LogEntry[];

function parseJsonLog(lines: string[], maxEntries?: number): LogEntry[] {
  const entries: LogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (maxEntries && entries.length >= maxEntries) break;
    const line = lines[i].trim();
    if (!line) continue;

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    if (typeof obj !== "object" || obj === null) continue;

    const timestamp = findJsonField(obj, TIMESTAMP_FIELDS);
    const level = findJsonField(obj, LEVEL_FIELDS);
    const message = findJsonField(obj, MESSAGE_FIELDS);
    const source = findJsonField(obj, SOURCE_FIELDS);
    const stack = findJsonField(obj, STACK_FIELDS);

    entries.push({
      lineNumber: i + 1,
      timestamp: timestamp ? String(timestamp) : null,
      level: level ? normalizeLevel(String(level)) : "unknown",
      message: message ? String(message) : JSON.stringify(obj),
      source: source ? String(source) : null,
      stackTrace: stack ? String(stack) : null,
      raw: lines[i],
    });
  }

  return entries;
}

function parseSyslog(lines: string[], maxEntries?: number): LogEntry[] {
  const entries: LogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (maxEntries && entries.length >= maxEntries) break;
    const line = lines[i];
    if (!line.trim()) continue;

    // RFC 5424 시도
    let m = line.match(RE_SYSLOG_5424);
    if (m) {
      const priority = m[1] ? parseInt(m[1], 10) : -1;
      entries.push({
        lineNumber: i + 1,
        timestamp: m[3],
        level: priority >= 0 ? syslogSeverityToLevel(priority) : "info",
        message: m[8] || "",
        source: `${m[5]}[${m[6]}]`,
        stackTrace: null,
        raw: line,
      });
      continue;
    }

    // RFC 3164 시도
    m = line.match(RE_SYSLOG_3164);
    if (m) {
      const priority = m[1] ? parseInt(m[1], 10) : -1;
      entries.push({
        lineNumber: i + 1,
        timestamp: parseSyslog3164Timestamp(m[2]),
        level: priority >= 0 ? syslogSeverityToLevel(priority) : "info",
        message: m[6] || "",
        source: m[4] || null,
        stackTrace: null,
        raw: line,
      });
      continue;
    }

    // 매칭 실패 시 plain 처리
    entries.push({
      lineNumber: i + 1,
      timestamp: null,
      level: "unknown",
      message: line,
      source: null,
      stackTrace: null,
      raw: line,
    });
  }

  return entries;
}

function parseAtlassianLog(lines: string[], maxEntries?: number): LogEntry[] {
  const entries: LogEntry[] = [];
  let currentEntry: LogEntry | null = null;
  let stackLines: string[] = [];
  let messageContinuation: string[] = [];

  function finalizeEntry() {
    if (!currentEntry) return;
    if (messageContinuation.length > 0) {
      currentEntry.message += "\n" + messageContinuation.join("\n");
    }
    if (stackLines.length > 0) {
      currentEntry.stackTrace = stackLines.join("\n");
    }
    entries.push(currentEntry);
    currentEntry = null;
    stackLines = [];
    messageContinuation = [];
  }

  for (let i = 0; i < lines.length; i++) {
    if (maxEntries && entries.length >= maxEntries) {
      finalizeEntry();
      break;
    }

    const line = lines[i];
    const m = line.match(RE_ATLASSIAN_ENTRY);

    if (m) {
      // 새 엔트리 시작 → 이전 엔트리 마무리
      finalizeEntry();

      const ts = m[1].replace(",", ".");
      currentEntry = {
        lineNumber: i + 1,
        timestamp: ts.replace(" ", "T"),
        level: normalizeLevel(m[2]),
        message: m[4] || "",
        source: m[3],
        stackTrace: null,
        raw: line,
      };
    } else if (currentEntry) {
      // 멀티라인 계속
      if (isStackTraceLine(line) || RE_EXCEPTION_START.test(line.trim())) {
        stackLines.push(line);
      } else {
        messageContinuation.push(line);
      }
      currentEntry.raw += "\n" + line;
    }
  }

  // 마지막 엔트리 마무리
  finalizeEntry();
  return entries;
}

function parseWebServerLog(lines: string[], maxEntries?: number): LogEntry[] {
  const entries: LogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (maxEntries && entries.length >= maxEntries) break;
    const line = lines[i];
    if (!line.trim()) continue;

    const m = line.match(RE_COMBINED_LOG);
    if (m) {
      const status = parseInt(m[8], 10);
      const size = m[9] === "-" ? 0 : parseInt(m[9], 10);

      entries.push({
        lineNumber: i + 1,
        timestamp: parseWebTimestamp(m[4]),
        level: httpStatusToLevel(status),
        message: `${m[5]} ${m[6]} ${status} ${size}`,
        source: m[1],
        stackTrace: null,
        raw: line,
      });
    } else {
      entries.push({
        lineNumber: i + 1,
        timestamp: null,
        level: "unknown",
        message: line,
        source: null,
        stackTrace: null,
        raw: line,
      });
    }
  }

  return entries;
}

function parseJavaStackTrace(lines: string[], maxEntries?: number): LogEntry[] {
  const entries: LogEntry[] = [];
  let currentEntry: LogEntry | null = null;
  let stackLines: string[] = [];

  function finalizeEntry() {
    if (!currentEntry) return;
    if (stackLines.length > 0) {
      currentEntry.stackTrace = stackLines.join("\n");
    }
    entries.push(currentEntry);
    currentEntry = null;
    stackLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    if (maxEntries && entries.length >= maxEntries) {
      finalizeEntry();
      break;
    }

    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Exception/Error 시작
    const exMatch = trimmed.match(RE_EXCEPTION_START);
    if (exMatch) {
      finalizeEntry();
      currentEntry = {
        lineNumber: i + 1,
        timestamp: null,
        level: "error",
        message: exMatch[2] ? `${exMatch[1]}: ${exMatch[2]}` : exMatch[1],
        source: exMatch[1],
        stackTrace: null,
        raw: line,
      };
      continue;
    }

    // Caused by:
    const causedMatch = trimmed.match(RE_CAUSED_BY);
    if (causedMatch && currentEntry) {
      stackLines.push(line);
      currentEntry.raw += "\n" + line;
      continue;
    }

    // at ... 라인 또는 ... N more
    if (RE_JAVA_AT_LINE.test(line) || RE_STACK_ELLIPSIS.test(line)) {
      if (currentEntry) {
        stackLines.push(line);
        currentEntry.raw += "\n" + line;
      }
      continue;
    }

    // 그 외 라인 → 새 엔트리의 시작일 수 있음
    if (currentEntry) {
      finalizeEntry();
    }
    // Exception이 아닌 일반 라인은 plain 처리
    currentEntry = {
      lineNumber: i + 1,
      timestamp: null,
      level: "unknown",
      message: trimmed,
      source: null,
      stackTrace: null,
      raw: line,
    };
    finalizeEntry();
  }

  finalizeEntry();
  return entries;
}

function parsePlainText(lines: string[], maxEntries?: number): LogEntry[] {
  const entries: LogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (maxEntries && entries.length >= maxEntries) break;
    const line = lines[i];
    if (!line.trim()) continue;

    // 타임스탬프 추출
    const tsMatch = line.match(RE_GENERIC_TIMESTAMP);
    const timestamp = tsMatch ? tsMatch[1].replace(" ", "T").replace(",", ".") : null;

    // 레벨 추출
    const lvlMatch = line.match(RE_GENERIC_LEVEL);
    const level: LogLevel = lvlMatch ? normalizeLevel(lvlMatch[1]) : "unknown";

    // 메시지: 타임스탬프와 레벨을 제거한 나머지
    let message = line;
    if (tsMatch) message = message.replace(tsMatch[0], "").trim();
    if (lvlMatch) message = message.replace(lvlMatch[0], "").trim();
    // 앞뒤 구분자 제거
    message = message.replace(/^[\s\-:|[\]]+/, "").trim() || line.trim();

    entries.push({
      lineNumber: i + 1,
      timestamp,
      level,
      message,
      source: null,
      stackTrace: null,
      raw: line,
    });
  }

  return entries;
}

// ============================================================
// 통계 계산
// ============================================================

function computeStats(entries: LogEntry[]): LogStats {
  const levelCounts: Record<LogLevel, number> = {
    fatal: 0, error: 0, warn: 0, info: 0, debug: 0, trace: 0, unknown: 0,
  };

  let start: string | null = null;
  let end: string | null = null;
  let stackTraceCount = 0;

  for (const entry of entries) {
    levelCounts[entry.level]++;
    if (entry.stackTrace) stackTraceCount++;
    if (entry.timestamp) {
      if (!start || entry.timestamp < start) start = entry.timestamp;
      if (!end || entry.timestamp > end) end = entry.timestamp;
    }
  }

  return {
    totalEntries: entries.length,
    levelCounts,
    timeRange: { start, end },
    hasStackTraces: stackTraceCount > 0,
    stackTraceCount,
  };
}

// ============================================================
// 공개 API
// ============================================================

const PARSERS: Record<LogFormat, FormatParser> = {
  json: parseJsonLog,
  ndjson: parseJsonLog,
  syslog: parseSyslog,
  atlassian: parseAtlassianLog,
  nginx: parseWebServerLog,
  apache: parseWebServerLog,
  "java-stacktrace": parseJavaStackTrace,
  plain: parsePlainText,
};

/**
 * 로그 내용을 파싱하여 구조화된 결과 반환.
 * 포맷 미지정 시 자동 감지.
 */
export function parseLog(content: string, options?: ParseOptions): ParseResult {
  const normalized = normalizeContent(content);
  const lines = getLines(normalized);

  const detection: FormatDetectionResult = options?.format
    ? { format: options.format, confidence: 1, sampleSize: 0 }
    : detectFormat(normalized);

  const parser = PARSERS[detection.format];
  let entries = parser(lines, options?.maxEntries);

  if (options?.includeRaw === false) {
    entries = entries.map((e) => ({ ...e, raw: "" }));
  }

  const stats = computeStats(entries);

  return { format: detection, totalLines: lines.length, entries, stats };
}

/**
 * 에러/경고/치명적 엔트리만 추출.
 */
export function extractIssues(content: string): LogEntry[] {
  const result = parseLog(content);
  return result.entries.filter(
    (e) => e.level === "fatal" || e.level === "error" || e.level === "warn"
  );
}

/**
 * AI 프롬프트에 주입할 로그 요약 텍스트 생성.
 */
export function buildLogSummary(result: ParseResult): string {
  const { format, stats, totalLines } = result;

  const parts: string[] = [];

  const formatLabel: Record<LogFormat, string> = {
    json: "JSON", ndjson: "NDJSON", syslog: "Syslog",
    atlassian: "Atlassian (Jira/Confluence/Bitbucket)",
    nginx: "Nginx Access Log", apache: "Apache Access Log",
    "java-stacktrace": "Java Stack Trace", plain: "일반 텍스트",
  };

  parts.push(`로그 형식: ${formatLabel[format.format]} (신뢰도: ${Math.round(format.confidence * 100)}%)`);
  parts.push(`총 라인: ${totalLines}줄 / 파싱 항목: ${stats.totalEntries}건`);

  if (stats.timeRange.start && stats.timeRange.end) {
    parts.push(`시간 범위: ${stats.timeRange.start} ~ ${stats.timeRange.end}`);
  }

  const levelSummary = Object.entries(stats.levelCounts)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${level.toUpperCase()}: ${count}건`)
    .join(", ");
  if (levelSummary) {
    parts.push(`심각도 분포: ${levelSummary}`);
  }

  if (stats.hasStackTraces) {
    parts.push(`스택 트레이스: ${stats.stackTraceCount}건`);
  }

  return parts.join("\n");
}

/**
 * LogEntry를 프롬프트에 넣기 좋은 문자열로 변환.
 */
export function formatEntryForPrompt(entry: LogEntry): string {
  const parts: string[] = [];
  if (entry.timestamp) parts.push(`[${entry.timestamp}]`);
  parts.push(`[${entry.level.toUpperCase()}]`);
  if (entry.source) parts.push(`[${entry.source}]`);
  parts.push(entry.message);
  let result = parts.join(" ");
  if (entry.stackTrace) result += "\n" + entry.stackTrace;
  return result;
}
