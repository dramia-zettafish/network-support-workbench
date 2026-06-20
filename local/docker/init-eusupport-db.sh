set -eu

echo "Restoring sanitized EUSupport dump into ${POSTGRES_DB}..."
pg_restore --no-owner --no-privileges --dbname "${POSTGRES_DB}" --username "${POSTGRES_USER}" /seed/eusupport.dump

echo "Applying EUSupport migrations..."
for migration in /eusupport-migrations/*.sql; do
  echo "Applying ${migration}"
  psql --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" --set ON_ERROR_STOP=1 --file "${migration}"
done
