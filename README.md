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
swagger-sentinel validate api.yaml --rules ./rules # load custom rules
```

### Rules Registry

Explore the 130-point checklist directly from your terminal:

```bash
swagger-sentinel rules                 # List all rules by category
swagger-sentinel rules --category security # Filter by category
swagger-sentinel rules P16             # Show details for a specific rule
```

### Generate Tests
 
Generate **TypeScript** Vitest test suites from your spec. Now includes **Faker.js** integration for realistic, schema-driven test data:
 
 ```bash
 swagger-sentinel generate api.yaml --output ./tests/
 swagger-sentinel generate api.yaml --tag Pets           # specific tag only
 swagger-sentinel generate api.yaml --base-url http://localhost:8080
 swagger-sentinel generate api.yaml --seed 123          # consistent random data
 ```
 
 The generator automatically maps semantic field names (like `email`, `firstName`, `birthDate`) to realistic mock data.

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

### Spectral Export

Export your sentinel rules to a Spectral-compatible YAML ruleset:

```bash
swagger-sentinel export-spectral > .spectral.yaml
```

## Validation Categories

| Category | Checks | Automated |
|----------|--------|-----------|
| Structure & Metadata | 15 | 11 |
| Path Design | 20 | 13 |
| Operations | 25 | 15 |
| Request Validation | 18 | 12 |
| Response Design | 25 | 12 |
| Security | 15 | 12 |
| Documentation | 12 | 8 |
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
        with:
          node-version: 24
      - name: Validate
        run: npx swagger-sentinel validate specs/api.yaml --strict
      - name: Generate Tests
        run: npx swagger-sentinel generate specs/api.yaml --output tests/
      - name: Run Tests
        run: npx vitest run tests/
```

## Custom Rules

You can extend **swagger-sentinel** with your own domain-specific rules. Create a directory (e.g., `./sentinel-rules`) and add `.js` or `.mjs` files:

```javascript
// ./sentinel-rules/no-internal-paths.js
export default function validate(spec) {
  const results = [];
  for (const path in spec.paths) {
    if (path.startsWith('/internal')) {
      results.push({
        id: 'CUSTOM01',
        category: 'Custom',
        severity: 'error',
        passed: false,
        message: `Internal path detected: ${path}`
      });
    }
  }
  return results;
}
```

Then run with the `--rules` flag:
```bash
swagger-sentinel validate api.yaml --rules ./sentinel-rules
```

## Programmatic Usage (TypeScript/ESM)

```typescript
import { loadSpec, validate, generate } from 'swagger-sentinel';

const spec = loadSpec('api.yaml');
const results = validate(spec);
const testFiles = generate(spec, { output: './tests' });
```

## Development

If you are contributing to **swagger-sentinel**, use the following scripts:

- **`npm run build`**: Compiles TypeScript (important for updating the `dist/` binary used by `npx`).
- **`npm run validate <file>`**: Runs the validator directly from source (using `tsx`).
- **`npm test`**: Runs the Vitest suite.
- **`npm run build:watch`**: Automatically recompiles on every file change.

> [!IMPORTANT]
> When testing the CLI locally via `npx .`, always run `npm run build` first to ensure the distributed files are up to date!

## Configuration

You can customize **swagger-sentinel** using a `.sentinelrc` file (JSON or YAML) in your project root.

```json
{
  "strict": true,
  "ignore": ["R50", "P15"],
  "overrides": {
    "SEC101": "error",
    "DOC119": "suggestion"
  },
  "generate": {
    "seed": 12345,
    "baseUrl": "https://api.staging.com",
    "output": "./generated-tests"
  }
}
```

### Options
- **`strict`**: Treat warnings as errors (equivalent to `--strict`).
- **`ignore`**: An array of Rule IDs to completely skip during validation.
- **`overrides`**: A map of Rule IDs to their desired severity (`error`, `warning`, or `suggestion`).
- **`generate`**: Default options for the `generate` command.

## License

MIT

 
