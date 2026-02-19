#!/bin/bash
# =============================================================
# Let's Encrypt SSL 인증서 초기 발급 스크립트
# =============================================================
# 사용법:
#   1. .env 파일에 DOMAIN, CERT_EMAIL 설정
#   2. chmod +x init-ssl.sh
#   3. ./init-ssl.sh
#
# 이 스크립트는 최초 1회만 실행하면 됩니다.
# 이후 갱신은 certbot 컨테이너가 자동으로 처리합니다.
# =============================================================

set -e

# .env 파일에서 변수 로드
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# 필수 변수 확인
if [ -z "$DOMAIN" ]; then
    echo "ERROR: DOMAIN 환경 변수가 설정되지 않았습니다."
    echo "  .env 파일에 DOMAIN=your-domain.com 을 추가하세요."
    exit 1
fi

if [ -z "$CERT_EMAIL" ]; then
    echo "ERROR: CERT_EMAIL 환경 변수가 설정되지 않았습니다."
    echo "  .env 파일에 CERT_EMAIL=your@email.com 을 추가하세요."
    exit 1
fi

echo "=== Let's Encrypt SSL 인증서 발급 ==="
echo "도메인: $DOMAIN"
echo "이메일: $CERT_EMAIL"
echo ""

# Step 1: 초기 설정(인증서 없이)으로 Nginx 시작
echo "[1/4] 초기 Nginx 설정으로 컨테이너 시작..."
docker compose -f docker-compose.yml up -d db app

echo "  DB healthy 대기 중..."
docker compose -f docker-compose.yml exec db sh -c \
    'until pg_isready -U ${POSTGRES_USER:-loganalyzer} -d log_analyzer; do sleep 2; done'

# nginx.init.conf로 시작 (SSL 없이)
docker compose -f docker-compose.yml run -d \
    --name nginx-init \
    -p 80:80 \
    -v "$(pwd)/nginx/nginx.init.conf:/etc/nginx/nginx.conf:ro" \
    -v "certbot_www:/var/www/certbot:ro" \
    nginx

echo "  Nginx 시작 대기 (5초)..."
sleep 5

# Step 2: Certbot으로 인증서 발급
echo "[2/4] Let's Encrypt 인증서 발급 중..."
docker run --rm \
    -v "certbot_conf:/etc/letsencrypt" \
    -v "certbot_www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$CERT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

# Step 3: 초기 Nginx 정리
echo "[3/4] 초기 Nginx 컨테이너 정리..."
docker stop nginx-init && docker rm nginx-init

# Step 4: nginx.conf에 도메인 적용 후 전체 서비스 시작
echo "[4/4] SSL 적용된 전체 서비스 시작..."
docker compose up -d

echo ""
echo "=== 완료! ==="
echo "  https://$DOMAIN 으로 접속하세요."
echo "  인증서 자동 갱신: certbot 컨테이너가 12시간마다 체크합니다."
