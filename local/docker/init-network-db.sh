set -eu

echo "Initializing Network Workbench schema..."
psql --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" --set ON_ERROR_STOP=1 --file /network-db/network_vcode_schema.sql

if [ -d /network-db/patches ]; then
  for patch in /network-db/patches/*.sql; do
    [ -e "${patch}" ] || continue
    echo "Applying ${patch}"
    psql --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" --set ON_ERROR_STOP=1 --file "${patch}"
  done
fi
