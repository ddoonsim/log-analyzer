# Log Analyzer - 배포 환경 설정 가이드

## 필수 환경 변수

| 변수명 | 필수 | 설명 | 예시 |
|--------|------|------|------|
| `ANTHROPIC_API_KEY` | **필수** | Claude API 키 | `sk-ant-api03-...` |
| `DATABASE_URL` | **필수** | 데이터베이스 연결 문자열 | `file:/app/data/prod.db` |
| `NODE_ENV` | 권장 | 실행 환경 | `production` |
| `PORT` | 권장 | 서버 포트 | `3000` |
| `HOSTNAME` | 권장 | 바인딩 호스트 | `0.0.0.0` |
| `MAX_FILE_SIZE` | 선택 | 업로드 파일 최대 크기 (바이트) | `10485760` (10MB) |
| `MAX_FILES_PER_SESSION` | 선택 | 세션당 최대 파일 수 | `10` |
| `ALLOWED_ORIGINS` | 선택 | 허용 Origin (CORS) | `https://your-domain.com` |

## 데이터베이스 옵션

### SQLite (기본, 단일 서버)
```
DATABASE_URL="file:/app/data/prod.db"
```
- Docker 볼륨 마운트 필요: `-v ./data:/app/data`
- 단일 인스턴스 배포에 적합
- 백업: `data/prod.db` 파일 복사

### PostgreSQL (운영 환경 권장)
```
DATABASE_URL="postgresql://user:password@db-host:5432/log_analyzer?schema=public"
```
- 다중 인스턴스, 고가용성 필요 시 사용
- Prisma 스키마의 provider를 `postgresql`로 변경 필요

## 환경 설정 순서

```bash
# 1. 템플릿 복사
cp .env.production .env.production.local

# 2. 실제 값 입력
vi .env.production.local

# 3. Docker 빌드 시 사용
docker run --env-file .env.production.local ...
```

---

## 보안 체크리스트

### 배포 전 필수 확인

- [ ] **API 키 노출 확인**: `.env` 파일이 Git에 커밋되지 않았는지 확인
  ```bash
  git log --all --full-history -- .env .env.local .env.production.local
  ```
  만약 커밋된 적 있다면 → API 키 즉시 재발급 (https://console.anthropic.com)

- [ ] **Anthropic API 키 재발급**: 개발용 키와 운영용 키를 분리
  - 개발: 낮은 rate limit 키 사용
  - 운영: 별도 키 발급, 사용량 알림 설정

- [ ] **DATABASE_URL 보안**: PostgreSQL 사용 시
  - 강력한 비밀번호 사용 (20자 이상, 랜덤)
  - SSL 연결 활성화 (`?sslmode=require`)
  - DB 접근 IP 제한

### Docker 보안

- [ ] **non-root 사용자로 실행**: Dockerfile에 `USER nextjs` 설정
- [ ] **빌드 스테이지 분리**: multi-stage build로 소스코드 미포함
- [ ] **`.dockerignore` 설정**: node_modules, .env, .git 제외
- [ ] **이미지 취약점 스캔**: `docker scout` 또는 Trivy 사용
  ```bash
  docker scout cves log-analyzer:latest
  ```

### 네트워크 보안

- [ ] **HTTPS 적용**: 리버스 프록시(Nginx/Traefik)로 TLS 종료
- [ ] **불필요한 포트 차단**: 3000번 포트 외부 직접 노출 금지
- [ ] **Rate Limiting**: Nginx 또는 앱 레벨에서 API 호출 제한
- [ ] **CORS 설정**: `ALLOWED_ORIGINS`에 허용 도메인만 지정

### 애플리케이션 보안

- [ ] **파일 업로드 제한**
  - 파일 크기 제한 (기본 10MB)
  - 허용 MIME 타입 검증
  - 파일명 sanitization
- [ ] **입력 검증**: 시스템 정보, 채팅 메시지 길이 제한
- [ ] **에러 메시지**: 운영 환경에서 스택 트레이스 노출 금지
- [ ] **의존성 취약점 점검**
  ```bash
  npm audit
  ```

### 데이터 보안

- [ ] **DB 백업 설정**: 정기 백업 스케줄 (SQLite: 파일 복사, PostgreSQL: pg_dump)
- [ ] **로그 데이터 보존 정책**: 민감 정보 포함 로그의 보존 기간 설정
- [ ] **볼륨 마운트 권한**: Docker 볼륨의 파일 퍼미션 확인 (644/755)

### 모니터링

- [ ] **헬스체크 엔드포인트**: Docker HEALTHCHECK 설정
- [ ] **Anthropic API 사용량 모니터링**: 비용 알림 설정
- [ ] **디스크 용량 모니터링**: SQLite DB 파일 크기, 업로드 파일 용량
