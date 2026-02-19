#!/bin/sh
set -e

echo "=== Log Analyzer Starting ==="
echo "NODE_ENV: $NODE_ENV"

# DB 마이그레이션 실행
echo "Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Starting Next.js server..."
exec node server.js