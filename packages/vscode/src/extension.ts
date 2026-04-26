import * as vscode from "vscode";
import { DiagnosticsProvider } from "./diagnostics.js";
import { StatusBarManager } from "./status-bar.js";

let diagnosticsProvider: DiagnosticsProvider;
let statusBarManager: StatusBarManager;

export function activate(context: vscode.ExtensionContext): void {
	diagnosticsProvider = new DiagnosticsProvider();
	statusBarManager = new StatusBarManager(context);

	context.subscriptions.push(
		vscode.commands.registerCommand("swagger-sentinel.validate", async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage("Swagger Sentinel: No active file.");
				return;
			}
			await diagnosticsProvider.validateDocument(editor.document);
		}),

		vscode.commands.registerCommand(
			"swagger-sentinel.generateTests",
			async () => {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showWarningMessage("Swagger Sentinel: No active file.");
					return;
				}
				await generateTests(editor.document);
			},
		),

		vscode.commands.registerCommand("swagger-sentinel.clearDiagnostics", () => {
			diagnosticsProvider.clearAll();
			statusBarManager.clear();
		}),

		vscode.commands.registerCommand("swagger-sentinel.enrich", async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage("Swagger Sentinel: No active file.");
				return;
			}
			await enrichDocumentation(editor.document, context);
		}),

		vscode.commands.registerCommand("swagger-sentinel.setApiKey", async () => {
			const config = vscode.workspace.getConfiguration("swagger-sentinel");
			const provider = config.get<string>("ai.provider", "gemini");
			const apiKey = await vscode.window.showInputBox({
				prompt: `Enter API Key for ${provider}`,
				password: true,
				ignoreFocusOut: true,
			});
			if (apiKey) {
				const secretKey =
					provider === "gemini" ? "gemini_api_key" : "openai_api_key";
				await context.secrets.store(secretKey, apiKey);
				vscode.window.showInformationMessage(
					`Swagger Sentinel: API Key for ${provider} saved securely.`,
				);
			}
		}),

		vscode.commands.registerCommand(
			"swagger-sentinel.clearApiKey",
			async () => {
				await context.secrets.delete("gemini_api_key");
				await context.secrets.delete("openai_api_key");
				vscode.window.showInformationMessage(
					"Swagger Sentinel: All stored AI API keys have been cleared.",
				);
			},
		),

		vscode.workspace.onDidSaveTextDocument(async (doc) => {
			const config = vscode.workspace.getConfiguration("swagger-sentinel");
			if (!config.get<boolean>("autoValidate", true)) return;
			if (!diagnosticsProvider.isSpecFile(doc)) return;
			const result = await diagnosticsProvider.validateDocument(doc);
			if (result)
				statusBarManager.update(result.errorCount, result.warningCount);
		}),

		vscode.workspace.onDidOpenTextDocument(async (doc) => {
			if (!diagnosticsProvider.isSpecFile(doc)) return;
			const result = await diagnosticsProvider.validateDocument(doc);
			if (result)
				statusBarManager.update(result.errorCount, result.warningCount);
		}),

		vscode.window.onDidChangeActiveTextEditor((editor) => {
			if (!editor) {
				statusBarManager.clear();
				return;
			}
			if (!diagnosticsProvider.isSpecFile(editor.document)) {
				statusBarManager.hide();
				return;
			}
			statusBarManager.show();
		}),

		diagnosticsProvider,
	);

	const editor = vscode.window.activeTextEditor;
	if (editor && diagnosticsProvider.isSpecFile(editor.document)) {
		diagnosticsProvider.validateDocument(editor.document).then((result) => {
			if (result)
				statusBarManager.update(result.errorCount, result.warningCount);
		});
	}
}

async function generateTests(doc: vscode.TextDocument): Promise<void> {
	const config = vscode.workspace.getConfiguration("swagger-sentinel");
	const outputDir = config.get<string>("outputDir", "tests/generated");

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: "Swagger Sentinel: Generating tests…",
		},
		async () => {
			try {
				const fs = await import("node:fs");
				const path = await import("node:path");
				const { loadSpec, generate } = await import("swagger-sentinel");
				const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
				const rootPath =
					workspaceFolder?.uri.fsPath ?? path.dirname(doc.uri.fsPath);
				const spec = await loadSpec(doc.uri.fsPath);
				const files = generate(spec);
				const outDir = path.join(rootPath, outputDir);
				fs.mkdirSync(outDir, { recursive: true });
				for (const file of files) {
					fs.writeFileSync(path.join(outDir, file.name), file.content, "utf8");
				}
				vscode.window.showInformationMessage(
					`Swagger Sentinel: ${files.length} test file(s) generated in ${outputDir}`,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Swagger Sentinel: ${msg}`);
			}
		},
	);
}

async function enrichDocumentation(
	doc: vscode.TextDocument,
	context: vscode.ExtensionContext,
): Promise<void> {
	const config = vscode.workspace.getConfiguration("swagger-sentinel");

	const provider = config.get<string>("ai.provider", "gemini") as
		| "gemini"
		| "openai";
	const lang = config.get<string>("ai.language", "en");

	const secretKey = provider === "gemini" ? "gemini_api_key" : "openai_api_key";
	let apiKey = (await context.secrets.get(secretKey)) || "";

	if (!apiKey) {
		apiKey =
			(await vscode.window.showInputBox({
				prompt: `Please enter your ${
					provider === "gemini" ? "Gemini" : "OpenAI"
				} API Key`,
				password: true,
				ignoreFocusOut: true,
			})) || "";

		if (!apiKey) return;

		// Save the key securely
		await context.secrets.store(secretKey, apiKey);
		vscode.window.showInformationMessage(
			`Swagger Sentinel: ${provider} API key saved securely.`,
		);
	}

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Swagger Sentinel: Enriching with AI (${provider})...`,
			cancellable: false,
		},
		async () => {
			try {
				const { loadSpec, enrichSpec } = await import("swagger-sentinel");
				const yaml = await import("js-yaml");
				const spec = await loadSpec(doc.uri.fsPath);

				const result = await enrichSpec(spec, {
					provider,
					apiKey,
					lang,
				});

				if (result.enrichedCount === 0) {
					vscode.window.showInformationMessage(
						"Swagger Sentinel: No missing documentation found.",
					);
					return;
				}

				const edit = new vscode.WorkspaceEdit();
				const newYaml = yaml.dump(result.spec);

				const entireRange = new vscode.Range(
					doc.positionAt(0),
					doc.positionAt(doc.getText().length),
				);
				edit.replace(doc.uri, entireRange, newYaml);

				await vscode.workspace.applyEdit(edit);

				vscode.window.showInformationMessage(
					`Swagger Sentinel: Successfully enriched ${result.enrichedCount} fields!`,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Swagger Sentinel: ${msg}`);
			}
		},
	);
}

export function deactivate(): void {
	diagnosticsProvider?.dispose();
	statusBarManager?.dispose();
}
