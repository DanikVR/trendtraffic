#!/usr/bin/env bash
# VibeVox — smoke-тест после деплоя (Критичный пункт 4).
#
# Проверяет: (1) сервис жив, (2) authZ-замки безопасности РЕАЛЬНО закрыты
# (негативные кейсы без токена → 401), (3) публичные эндпоинты остались публичны.
# Это машинная проверка фиксов Блоков 1–6 на ЖИВОМ инстансе.
#
#   BASE=https://твой-домен bash deploy/smoke-test.sh
#   (по умолчанию BASE=http://localhost:3001)
set -uo pipefail

BASE="${BASE:-http://localhost:3001}"
pass=0; fail=0

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
check() { # имя ожидаемый_код фактический_код
  if [ "$2" = "$3" ]; then echo "  OK   $1 ($3)"; pass=$((pass+1));
  else echo "  FAIL $1: ожидал $2, получил $3"; fail=$((fail+1)); fi
}

echo "VibeVox smoke-test → BASE=$BASE"
echo "— здоровье —"
check "GET /api/health → 200"                 200 "$(code "$BASE/api/health")"
echo "— замки authZ (без токена должны давать 401) —"
check "POST /api/auth/system-settings → 401"   401 "$(code -X POST "$BASE/api/auth/system-settings" -H 'Content-Type: application/json' -d '{}')"
check "POST /api/billing/sync-products → 401"   401 "$(code -X POST "$BASE/api/billing/sync-products")"
check "GET  /api/admin/dialects → 401"          401 "$(code "$BASE/api/admin/dialects")"
echo "— публичное должно остаться публичным —"
check "GET  /api/auth/google-settings → 200"    200 "$(code "$BASE/api/auth/google-settings")"

echo "Итог: ${pass} OK, ${fail} FAIL"
[ "$fail" = 0 ] || { echo "‼ Есть провалы — смотри выше."; exit 1; }
echo "✓ Все проверки прошли."
