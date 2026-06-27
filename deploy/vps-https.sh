#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# TrendTraffic — включить домен + HTTPS (Let's Encrypt) для УЖЕ развёрнутого
# приложения (после vps-bootstrap.sh). Запуск ОТ ROOT и ТОЛЬКО ПОСЛЕ того,
# как A-запись домена уже указывает на этот VPS (иначе certbot не выдаст сертификат).
#
# Использование:
#   bash vps-https.sh app.trendtraffic.pro you@email.com
# (для апекса с www:  bash vps-https.sh trendtraffic.pro you@email.com www.trendtraffic.pro)
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:?Укажи домен:  bash vps-https.sh app.trendtraffic.pro you@email.com}"
EMAIL="${2:?Укажи email для Let's Encrypt}"
ALT_DOMAIN="${3:-}"                       # опц. второй домен (например www.)
APP_DIR="/var/www/trendtraffic"
ENV_FILE="${APP_DIR}/apps/backend/.env"
PM2_NAME="trendtraffic-api"

[ "$(id -u)" = "0" ] || { echo "Запусти от root (sudo -i)"; exit 1; }

log(){ echo -e "\n\033[1;36m== $* ==\033[0m"; }

### 0. Проверка, что домен резолвится на этот сервер (предупреждение, не блок) ─
SRV_IP="$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
DNS_IP="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1 || true)"
echo "Сервер IP: ${SRV_IP} ; DNS ${DOMAIN} → ${DNS_IP:-(нет A-записи)}"
if [ -z "$DNS_IP" ]; then
  echo "⚠ A-запись для ${DOMAIN} ещё не видна. Если certbot упадёт — подожди прогрузки DNS и запусти скрипт снова."
elif [ "$DNS_IP" != "$SRV_IP" ]; then
  echo "⚠ ${DOMAIN} указывает на ${DNS_IP}, а не на ${SRV_IP}. certbot, скорее всего, не выдаст сертификат."
fi

### 1. nginx: server_name = домен ─────────────────────────────────────────────
log "nginx: server_name → ${DOMAIN}${ALT_DOMAIN:+ ${ALT_DOMAIN}}"
sed -i "s/server_name [^;]*;/server_name ${DOMAIN}${ALT_DOMAIN:+ ${ALT_DOMAIN}};/" \
  /etc/nginx/sites-available/trendtraffic
nginx -t
systemctl reload nginx

### 2. certbot (выдаёт сертификат + добавляет 443-блок + http→https редирект) ─
log "certbot --nginx"
apt-get update -y
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "${DOMAIN}" ${ALT_DOMAIN:+-d "${ALT_DOMAIN}"} \
  --non-interactive --agree-tos -m "${EMAIL}" --redirect --keep-until-expiring

### 3. .env → https://домен (OAuth/вебхуки/ссылки) ───────────────────────────
log ".env → https://${DOMAIN}"
if [ -f "$ENV_FILE" ]; then
  for KEY in FRONTEND_URL PUBLIC_BASE_URL APP_BASE_URL PUBLIC_APP_URL; do
    if grep -q "^${KEY}=" "$ENV_FILE"; then
      sed -i "s#^${KEY}=.*#${KEY}=https://${DOMAIN}#" "$ENV_FILE"
    else
      echo "${KEY}=https://${DOMAIN}" >> "$ENV_FILE"
    fi
  done
fi

### 4. рестарт backend с новым окружением ────────────────────────────────────
pm2 restart "${PM2_NAME}" --update-env >/dev/null 2>&1 || true

log "ГОТОВО → https://${DOMAIN}"
echo "Автопродление сертификата: systemctl status certbot.timer (ставится автоматически)."
