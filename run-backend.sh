#!/usr/bin/env bash
# Starts the Feynman backend, picking a database automatically.
#
# Docker/PostgreSQL is optional:
#   * PostgreSQL reachable   -> default profile (PostgreSQL + Flyway, data persisted)
#   * PostgreSQL unreachable -> "h2" profile (in-memory, no install, data discarded)
#
# Force a profile with:  ./run-backend.sh h2   |   ./run-backend.sh postgres
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
profile="${1:-auto}"
db_host="${DB_HOST:-localhost}"
db_port="${DB_PORT:-5432}"

postgres_reachable() {
  # Bash's /dev/tcp probe avoids requiring psql or nc to be installed.
  (exec 3<>"/dev/tcp/${db_host}/${db_port}") >/dev/null 2>&1
}

if [ "$profile" = "auto" ]; then
  if postgres_reachable; then profile="postgres"; else profile="h2"; fi
fi

cd "$script_dir/backend"

if [ "$profile" = "h2" ]; then
  echo "No PostgreSQL on ${db_host}:${db_port} - starting with the in-memory H2 database."
  echo "Data will NOT be persisted. Run 'docker compose up -d' (or install PostgreSQL) for a real database."
  exec mvn spring-boot:run -Dspring-boot.run.profiles=h2
else
  echo "PostgreSQL detected on ${db_host}:${db_port} - starting with the default profile."
  exec mvn spring-boot:run
fi

