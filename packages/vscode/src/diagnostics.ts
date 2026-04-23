import * as vscode from "vscode";

export interface ValidationSummary {
	errorCount: number;
	warningCount: number;
}

export class DiagnosticsProvider implements vscode.Disposable {
	private readonly collection: vscode.DiagnosticCollection;

	constructor() {
		this.collection = vscode.languages.createDiagnosticCollection("swagger-sentinel");
	}

	isSpecFile(doc: vscode.TextDocument): boolean {
		if (!["yaml", "json"].includes(doc.languageId)) return false;
		const config = vscode.workspace.getConfiguration("swagger-sentinel");
		const patterns = config.get<string[]>("specPatterns", [
			"**/*api*.yaml", "**/*api*.yml", "**/*api*.json",
			"**/openapi*.yaml", "**/openapi*.yml",
			"**/swagger*.yaml", "**/swagger*.yml",
		]);
		return patterns.some((p) => {
			const pattern = new vscode.RelativePattern(
				vscode.workspace.getWorkspaceFolder(doc.uri) ?? doc.uri,
				p,
			);
			return vscode.languages.match({ pattern }, doc) > 0;
		});
	}

	async validateDocument(doc: vscode.TextDocument): Promise<ValidationSummary | null> {
		try {
			const { loadSpec, validate } = await import("swagger-sentinel");
			const spec = await loadSpec(doc.uri.fsPath);
			const results = await validate(spec);
			const diagnostics: vscode.Diagnostic[] = [];

			for (const result of results) {
				if (result.passed) continue;
				const line = Math.max((result.line ?? 1) - 1, 0);
				const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
				const severity =
					result.severity === "error"
						? vscode.DiagnosticSeverity.Error
						: result.severity === "warning"
							? vscode.DiagnosticSeverity.Warning
							: vscode.DiagnosticSeverity.Hint;

				const diagnostic = new vscode.Diagnostic(range, result.message, severity);
				diagnostic.source = "Swagger Sentinel";
				diagnostic.code = result.id;
				diagnostics.push(diagnostic);
			}

			this.collection.set(doc.uri, diagnostics);

			const errorCount = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length;
			const warningCount = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Warning).length;
			return { errorCount, warningCount };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			vscode.window.showErrorMessage(`Swagger Sentinel: Validation failed — ${msg}`);
			return null;
		}
	}

	clearAll(): void {
		this.collection.clear();
	}

	dispose(): void {
		this.collection.dispose();
	}
}
