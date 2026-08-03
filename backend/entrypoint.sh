#!/bin/sh
# Migrate, then serve. Running migrations here rather than from the application
# means the schema is always current before the first request is accepted, and
# a failed migration stops the container instead of producing an API that 500s
# on any query touching a new column.
set -e

python -m scripts.migrate

exec "$@"
