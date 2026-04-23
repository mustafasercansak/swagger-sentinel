# Swagger Sentinel for VS Code

Opinionated OpenAPI 3.x validator and test generator with a 130-point checklist, right in your editor.

![Swagger Sentinel Logo](assets/logo.png)

![Swagger Sentinel Demo](assets/vscode-demo.png)

Swagger Sentinel brings the power of the 130-point OpenAPI checklist directly to VS Code. It provides real-time feedback, diagnostics, and automated test generation to help you build better APIs.

## Features

- **Real-time Linting**: Automatically validates your OpenAPI spec (`.yaml`, `.yml`, `.json`) as you type.
- **Problem Highlighting**: See errors, warnings, and suggestions directly in the VS Code "Problems" tab and highlighted in your code.

![Validation Features](assets/features.png)

- **Smart Test Generation**: Generate Vitest-compatible TypeScript tests with Faker.js integration directly from your spec via the context menu.

![Test Generation](assets/test-gen.png)
- **130-Point Checklist**: Covers Structure, Paths, Operations, Requests, Responses, Security, and Documentation.
- **Custom Rules Support**: Loads rules from your `.sentinelrc` or custom rules directory.

## Getting Started

1. Install the extension from the VS Code Marketplace.
2. Open any OpenAPI 3.x specification file.
3. Errors and warnings will appear automatically in the editor.
4. Right-click anywhere in the editor to:
   - **Swagger Sentinel: Validate Spec**: Force a full validation.
   - **Swagger Sentinel: Generate Tests**: Create test suites for your API.

## Configuration

You can customize the extension via VS Code settings or a `.sentinelrc` file in your workspace root.

### Extension Settings

- `swagger-sentinel.autoValidate`: Enable/disable automatic validation on save (default: `true`).
- `swagger-sentinel.specPatterns`: Customize glob patterns to identify OpenAPI files.
- `swagger-sentinel.outputDir`: Set the default directory for generated tests (default: `tests/generated`).

### .sentinelrc

Swagger Sentinel will respect your project's `.sentinelrc` configuration for ignoring rules or overriding severities.

```json
{
  "strict": true,
  "ignore": ["R50", "P15"],
  "overrides": {
    "SEC101": "error"
  }
}
```

## Commands

- `Swagger Sentinel: Validate Spec`: Runs the full 130-point checklist.
- `Swagger Sentinel: Generate Tests`: Generates TypeScript Vitest tests.
- `Swagger Sentinel: Clear Diagnostics`: Clears all highlights from the editor.

## Related

- **[NPM Package](https://www.npmjs.com/package/swagger-sentinel)**: For CLI and programmatic usage.
- **[GitHub Action](https://github.com/marketplace/actions/swagger-sentinel)**: For CI/CD integration.
- **[GitHub Repository](https://github.com/mustafasercansak/swagger-sentinel)**: Source code and issue tracking.

## License

MIT
