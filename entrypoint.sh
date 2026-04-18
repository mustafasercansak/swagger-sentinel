#!/bin/sh

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

# ── Set GitHub Action outputs ─────────────────────────────────────────────────
if [ -n "$GITHUB_OUTPUT" ]; then
  TMPJSON=$(mktemp /tmp/sentinelXXXXXX)
  TMPJS=$(mktemp /tmp/sentinelXXXXXX)

  JSON_CMD="node /app/src/cli.js validate $SPEC_PATH --format json"
  if [ -n "$CATEGORY" ]; then
    JSON_CMD="$JSON_CMD --category $CATEGORY"
  fi
  eval "$JSON_CMD" > "$TMPJSON" 2>/dev/null

  cat > "$TMPJS" << 'EOF'
const fs = require('fs');
const [,, jsonFile, outputFile] = process.argv;
try {
  const d = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const s = d.summary || {};
  const lines = [
    'errors='       + (s.errors       || 0),
    'warnings='     + (s.warnings     || 0),
    'suggestions='  + (s.suggestions  || 0),
    'passed='       + (s.passed       || 0),
    'total='        + (s.total        || 0),
  ].join('\n') + '\n';
  fs.appendFileSync(outputFile, lines);
} catch (e) {
  process.stderr.write('Output write failed: ' + e.message + '\n');
}
EOF

  node "$TMPJS" "$TMPJSON" "$GITHUB_OUTPUT"
  rm -f "$TMPJSON" "$TMPJS"
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
