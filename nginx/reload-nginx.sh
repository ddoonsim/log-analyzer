#!/bin/sh
# =============================================================
# Certbot 갱신 후 Nginx reload (cron 또는 수동 실행)
# =============================================================
# 사용법: docker compose exec nginx sh /etc/nginx/reload-nginx.sh
# 또는 호스트에서: docker compose exec nginx nginx -s reload

nginx -s reload
echo "Nginx reloaded at $(date)"