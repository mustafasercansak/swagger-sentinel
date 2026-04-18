# swagger-sentinel

Opinionated OpenAPI 3.x validator and test generator with a 130-point checklist.

Despite the name, swagger-sentinel works with any OpenAPI 3.x spec — "Swagger" is just the legacy term that stuck.

## Install

```bash
npm install -g swagger-sentinel
# or use directly with npx
npx swagger-sentinel validate api.yaml
```

## Commands

### Validate

Run the 130-point checklist against your spec:

```bash
swagger-sentinel validate api.yaml
swagger-sentinel validate api.yaml --strict       # warnings = errors
swagger-sentinel validate api.yaml --format json   # CI-friendly output
swagger-sentinel validate api.yaml --category paths # validate one category
```

### Generate Tests

Generate Vitest TypeScript test suites from your spec:

```bash
swagger-sentinel generate api.yaml --output ./tests/
swagger-sentinel generate api.yaml --tag Pets           # specific tag only
swagger-sentinel generate api.yaml --base-url http://localhost:8080
```

### Watch Mode

Re-validate on every file change:

```bash
swagger-sentinel watch api.yaml
swagger-sentinel watch api.yaml --strict
```

### Utilities

```bash
swagger-sentinel syntax api.yaml    # quick syntax check
swagger-sentinel tags api.yaml      # list all operation tags
```

## Validation Categories

| Category | Checks | Automated |
|----------|--------|-----------|
| Structure & Metadata | 12 | 11 |
| Path Design | 18 | 11 |
| Operations | 22 | 12 |
| Request Validation | 16 | 9 |
| Response Design | 20 | 10 |
| Security | 14 | 10 |
| Documentation | 10 | 6 |
| **Total** | **130** | **83** |

See [docs/CHECKLIST.md](docs/CHECKLIST.md) for the full checklist.

## CI Integration

```yaml
name: API Contract
on:
  pull_request:
    paths: ['specs/**']
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx swagger-sentinel validate specs/api.yaml --strict
      - run: npx swagger-sentinel generate specs/api.yaml --output tests/
      - run: npx vitest run tests/
```

## Programmatic Usage

```javascript
const { loadSpec, validate, generate } = require('swagger-sentinel');

const spec = await loadSpec('api.yaml');
const results = validate(spec);
const testFiles = generate(spec, { output: './tests' });
```

## License

MIT

 
