#!/usr/bin/env bash
# VibeVox — ежедневный бэкап PostgreSQL (Критичный пункт 3).
#
# Запуск вручную:   bash deploy/pg-backup.sh
# Cron (под пользователем postgres, чтобы pg_dump не спрашивал пароль):
#   sudo -u postgres crontab -e
#   0 3 * * * BACKUP_DIR=/backups bash /var/www/vibevox/deploy/pg-backup.sh >> /var/log/vibevox-backup.log 2>&1
#
# Переменные (необязательно): DB_NAME (default vibevox_db), BACKUP_DIR (/backups),
# KEEP_DAYS (14). Если запускаете НЕ под postgres — задайте PGPASSWORD/.pgpass.
set -euo pipefail

DB_NAME="${DB_NAME:-vibevox_db}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F_%H%M)"
FILE="$BACKUP_DIR/vibevox_${STAMP}.sql.gz"

pg_dump "$DB_NAME" | gzip > "$FILE"
echo "[$(date '+%F %T')] backup -> $FILE ($(du -h "$FILE" | cut -f1))"

# Удаляем дампы старше KEEP_DAYS дней
find "$BACKUP_DIR" -name 'vibevox_*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "[$(date '+%F %T')] retention: удалены дампы старше ${KEEP_DAYS} дн."

# Восстановление:  gunzip -c <файл>.sql.gz | psql vibevox_db
