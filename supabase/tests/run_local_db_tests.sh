#!/usr/bin/env bash
# Runs all migrations + security tests against a throwaway local PostgreSQL 15/16 database
# using a minimal Supabase stub (auth.uid(), storage, roles). Requires `psql` and a local server.
# Usage: PGUSER=postgres bash supabase/tests/run_local_db_tests.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-deliversme_test}"
PSQL="psql -X -q -t -A -v ON_ERROR_STOP=1"
dropdb --if-exists "$DB" && createdb "$DB"
$PSQL -d "$DB" -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do echo "→ applying $f"; $PSQL -d "$DB" -f "$f"; done
$PSQL -d "$DB" -f tests/01_helpers.sql
$PSQL -d "$DB" -f tests/10_security_and_workflow_tests.sql
$PSQL -d "$DB" -f tests/20_seed_path_tests.sql
