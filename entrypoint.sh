#!/bin/sh
set -e

SPEC_PATH="${INPUT_SPEC_PATH}"
STRICT="${INPUT_STRICT:-false}"
CATEGORY="${INPUT_CATEGORY:-}"
GENERATE_TESTS="${INPUT_GENERATE_TESTS:-false}"
OUTPUT_DIR="${INPUT_OUTPUT_DIR:-generated-tests}"
BASE_URL="${INPUT_BASE_URL:-http://localhost:3000}"

if [ -z "$SPEC_PATH" ]; then
  echo "::error::spec-path input is required"
  exit 1
fi

if [ ! -f "$SPEC_PATH" ]; then
  echo "::error::Spec file not found: $SPEC_PATH"
  exit 1
fi

# ── Collect structured output for action outputs ──────────────────────────────
JSON_CMD="node /app/src/cli.js validate $SPEC_PATH --format json"
if [ -n "$CATEGORY" ]; then
  JSON_CMD="$JSON_CMD --category $CATEGORY"
fi

JSON_OUTPUT=$(eval "$JSON_CMD" 2>/dev/null || true)

if [ -n "$JSON_OUTPUT" ] && [ -n "$GITHUB_OUTPUT" ]; then
  node -e "
    const raw = \`$JSON_OUTPUT\`;
    const d = JSON.parse(raw);
    const s = d.summary || {};
    const out = [
      'errors='   + (s.errors      || 0),
      'warnings=' + (s.warnings    || 0),
      'suggestions=' + (s.suggestions || 0),
      'passed='   + (s.passed      || 0),
      'total='    + (s.total       || 0),
    ].join('\n');
    require('fs').appendFileSync(process.env.GITHUB_OUTPUT, out + '\n');
  " 2>/dev/null || true
fi

# ── Human-readable validation output ─────────────────────────────────────────
VALIDATE_CMD="node /app/src/cli.js validate $SPEC_PATH"
if [ "$STRICT" = "true" ]; then
  VALIDATE_CMD="$VALIDATE_CMD --strict"
fi
if [ -n "$CATEGORY" ]; then
  VALIDATE_CMD="$VALIDATE_CMD --category $CATEGORY"
fi

eval "$VALIDATE_CMD"
EXIT_CODE=$?

# ── Generate tests if requested ───────────────────────────────────────────────
if [ "$GENERATE_TESTS" = "true" ]; then
  echo ""
  echo "Generating tests..."
  node /app/src/cli.js generate "$SPEC_PATH" --output "$OUTPUT_DIR" --base-url "$BASE_URL"
fi

exit $EXIT_CODE
