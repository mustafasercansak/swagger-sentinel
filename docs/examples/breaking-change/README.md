# Breaking Change Demo

This folder contains a minimal old/new OpenAPI pair that intentionally produces all change categories.

## Files

- old-api.yaml: Baseline API version
- new-api.yaml: Changed API version
- report.md: Generated summary output (created by CLI)

## Run Locally

From repository root:

```bash
npx tsx packages/core/src/cli.ts breaking \
  docs/examples/breaking-change/old-api.yaml \
  docs/examples/breaking-change/new-api.yaml \
  --summary docs/examples/breaking-change/report.md \
  --fail-on none
```

## Expected Result

- Breaking: GET /pets parameter limit became required
- Breaking: GET /pets/{petId} path removed
- Non-breaking: GET /health path added
- Informative: operationId changed from pets_list to pets_list_v2

Typical recommendation:

- Version bump: major
- Risk level: high (with default weights and thresholds)
