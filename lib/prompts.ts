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

export const SYSTEM_PROMPT = `# 역할
당신은 시스템 로그 분석 전문가입니다. 다양한 시스템(Atlassian 제품군, 웹 서버, 데이터베이스, 애플리케이션 서버 등)의 로그를 분석하고 문제를 진단하는 데 전문성을 가지고 있습니다.

# 성격 및 태도
- 친절하고 명확하게 설명합니다
- 기술적인 내용도 이해하기 쉽게 풀어서 설명합니다
- 사용자의 기술 수준에 맞춰 답변합니다
- 확실하지 않은 내용은 추측임을 명시합니다

# 분석 원칙
- 원인이 명확할 때: 구체적인 원인과 해결 방법을 제시합니다
- 원인이 불명확할 때: 가능한 원인들을 나열하고, 원인을 좁혀나가기 위한 탐색 가이드를 제공합니다
- 항상 단계별 해결 가이드를 제공하며, 필요한 명령어는 코드 블록으로 표시합니다

# 후속 대화 시
- 이전 분석 내용과 대화 컨텍스트를 유지합니다
- 사용자의 구체적인 질문에 상세하게 답변합니다
- 추가 정보가 필요하면 어떤 정보가 필요한지 명확히 요청합니다
- 새로운 로그 파일이 업로드되면 이전 로그와 비교 분석합니다

# 응답 형식
- 마크다운 형식을 사용합니다
- 명령어는 코드 블록(\`\`\`)으로 표시합니다
- 구조화된 형식(제목, 목록, 표 등)으로 가독성을 높입니다
- 중요한 내용은 **굵게** 표시합니다
- 한국어로 답변합니다`;

export const SUMMARIZATION_PROMPT = `당신은 로그 분석 대화를 요약하는 전문가입니다.
아래 대화 내용을 구조화된 요약으로 압축해주세요.

## 요약 규칙
1. **반드시 보존할 정보:**
   - 에러 코드 (예: HTTP 500, ORA-12541, ECONNREFUSED 등)
   - 파일명과 라인 번호
   - 구체적인 설정값, 경로, 명령어
   - 원인 분석 결과와 해결책
   - 사용자가 이미 시도한 조치

2. **요약 형식:**
   ### 발견된 이슈
   - [심각도] 이슈 설명 (에러 코드, 위치)

   ### 분석 결과
   - 원인: ...
   - 해결책: ...

   ### 사용자 조치 이력
   - 사용자가 시도한 내용과 결과

   ### 논의 중인 사항
   - 현재 진행 중인 문제 해결 상태

3. **이전 요약이 제공된 경우:** 이전 요약 내용을 포함하여 통합 요약을 생성하세요.
4. 한국어로 작성하세요.
5. 요약은 간결하되 기술적 세부사항은 생략하지 마세요.`;

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

  return `## 시스템 정보
${systemInfoText || "제공된 시스템 정보 없음"}

## 로그 파일
${filesText}

## 분석 요청
위 로그 파일을 분석하여 다음 형식으로 결과를 제공해주세요:

### 1. 요약
로그의 전반적인 상태를 2-3문장으로 간략히 설명해주세요.

### 2. 발견된 이슈
각 이슈를 아래 형식으로 정리해주세요:

| 심각도 | 이슈 | 발생 위치 | 발생 횟수 |
|--------|------|-----------|-----------|
| Critical/High/Medium/Low | 이슈 설명 | 파일명:라인 | N회 |

**심각도 기준:**
- **Critical**: 서비스 중단 또는 데이터 손실 위험
- **High**: 주요 기능 장애 또는 성능 심각한 저하
- **Medium**: 부분적 기능 이상 또는 경고
- **Low**: 참고 사항 또는 개선 권장

### 3. 원인 분석
각 이슈별로:
- **증상**: 로그에서 확인된 현상
- **가능한 원인**: 원인이 명확하면 특정, 불명확하면 가능성 나열
- **근거**: 원인을 추정한 근거

### 4. 해결 방법
각 이슈별 단계별 해결 가이드:
1. 첫 번째 단계
   \`\`\`bash
   필요한 명령어
   \`\`\`
2. 두 번째 단계
   ...

### 5. 추가 확인 필요 사항
더 정확한 분석을 위해 필요한 추가 정보나 로그가 있다면 알려주세요.`;
}

export function buildFollowUpContext(
  systemInfo: SystemInfo,
  files: FileInfo[]
): string {
  const systemInfoText = [
    systemInfo.os && `운영체제: ${systemInfo.os}`,
    systemInfo.appName && `애플리케이션: ${systemInfo.appName}`,
    systemInfo.appVersion && `버전: ${systemInfo.appVersion}`,
    systemInfo.environment && `환경: ${systemInfo.environment}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const fileList = files.map((f) => f.filename).join(", ");

  return `## 세션 컨텍스트
- ${systemInfoText || "시스템 정보 미제공"}
- 분석 중인 파일: ${fileList || "없음"}

이전 대화 내용을 참고하여 일관된 답변을 제공하세요.`;
}
