interface SystemInfo {
  os: string;
  appName: string;
  appVersion: string;
  environment: string;
  notes: string;
}

interface FileInfo {
  filename: string;
  content: string;
}

export function buildInitialAnalysisPrompt(
  systemInfo: SystemInfo,
  files: FileInfo[]
): string {
  const systemInfoText = [
    systemInfo.os && `- 운영체제: ${systemInfo.os}`,
    systemInfo.appName && `- 애플리케이션: ${systemInfo.appName}`,
    systemInfo.appVersion && `- 버전: ${systemInfo.appVersion}`,
    systemInfo.environment && `- 환경: ${systemInfo.environment}`,
    systemInfo.notes && `- 기타 정보: ${systemInfo.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  const filesText = files
    .map(
      (file) => `
### ${file.filename}
\`\`\`
${file.content}
\`\`\`
`
    )
    .join("\n");

  return `당신은 시스템 로그 분석 전문가입니다. 사용자가 제공한 로그 파일을 분석하고 문제점을 파악해주세요.

## 시스템 정보
${systemInfoText || "제공된 시스템 정보 없음"}

## 로그 파일
${filesText}

## 분석 요청
위 로그 파일을 분석하여 다음 내용을 제공해주세요:

1. **요약**: 로그의 전반적인 상태를 간략히 설명
2. **발견된 문제점**: 에러, 경고, 비정상적인 패턴 목록
3. **원인 분석**: 각 문제의 가능한 원인
4. **해결 방안**: 문제 해결을 위한 구체적인 조치 사항
5. **추가 확인 필요 사항**: 더 자세한 분석을 위해 필요한 정보

마크다운 형식으로 명확하게 정리해주세요.`;
}

export const SYSTEM_PROMPT = `당신은 시스템 로그 분석 전문가입니다.
사용자가 업로드한 로그 파일을 분석하고, 문제점을 파악하며, 해결책을 제시합니다.
대화 중 사용자의 추가 질문에 친절하고 상세하게 답변합니다.
이전 대화 내용과 분석 결과를 참고하여 일관된 답변을 제공합니다.
한국어로 답변하며, 기술적인 내용도 이해하기 쉽게 설명합니다.`;
