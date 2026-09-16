#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${PROJECT_DIR}/server.log"
PID_FILE="${PROJECT_DIR}/server.pid"

cd "${PROJECT_DIR}"

if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(cat "${PID_FILE}" 2>/dev/null || true)"

  if [[ "${EXISTING_PID}" =~ ^[0-9]+$ ]] && kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "Backend server is already running with PID ${EXISTING_PID}."
    exit 0
  fi

  rm -f "${PID_FILE}"
fi

touch "${LOG_FILE}"

nohup npm run server >>"${LOG_FILE}" 2>&1 </dev/null &
SERVER_PID=$!

echo "${SERVER_PID}" >"${PID_FILE}"

sleep 1

if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
  rm -f "${PID_FILE}"
  echo "Backend server failed to start. Check ${LOG_FILE} for details." >&2
  exit 1
fi

echo "Backend server started with PID ${SERVER_PID}."
echo "Log file: ${LOG_FILE}"