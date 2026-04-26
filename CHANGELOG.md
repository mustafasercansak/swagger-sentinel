# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-26

### Added
- **AI Documentation Enricher**: A major new feature that uses Google Gemini or OpenAI to automatically generate missing `summary` and `description` fields in OpenAPI specifications.
- **CLI `enrich` Command**: New command to scan and update spec files via terminal with support for multiple languages and providers.
- **VS Code AI Integration**: Direct integration in the VS Code editor via context menu and command palette.
- **Secure Secret Storage**: API keys are now stored securely using the operating system's keychain (SecretStorage) instead of plain-text settings.
- **Batch Processing**: LLM calls are optimized using batch processing to reduce latency and API costs.

### Changed
- **Improved Test Coverage**: Increased unit test coverage for core modules to over 85%.
- **Linter Cleanup**: Resolved all remaining Biome linting and strict TypeScript issues.
- **UI Enhancements**: Simplified VS Code command titles and improved settings grouping.
- **Documentation**: Updated all READMEs with AI features and security guides.

### Fixed
- Fixed a bug where `any` type casts were causing linter warnings in the enricher module.
- Fixed an issue with ESM hoisting in Vitest mocks for LLM providers.
- Fixed a security concern regarding plain-text API key storage in VS Code.

## [1.0.3] - 2026-04-19

### Added
- Initial release of the 130-point OpenAPI checklist.
- TypeScript test generation with Faker.js integration.
- Real-time diagnostics for VS Code.
- GitHub Action integration.
