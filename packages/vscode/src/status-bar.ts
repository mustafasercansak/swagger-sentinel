import * as vscode from "vscode";

export class StatusBarManager implements vscode.Disposable {
	private readonly item: vscode.StatusBarItem;

	constructor(context: vscode.ExtensionContext) {
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.item.command = "swagger-sentinel.validate";
		context.subscriptions.push(this.item);
	}

	update(errors: number, warnings: number): void {
		if (errors > 0) {
			this.item.text = `$(error) Sentinel: ${errors}E ${warnings}W`;
			this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
			this.item.tooltip = `${errors} error(s), ${warnings} warning(s) — click to re-validate`;
		} else if (warnings > 0) {
			this.item.text = `$(warning) Sentinel: ${warnings}W`;
			this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
			this.item.tooltip = `${warnings} warning(s) — click to re-validate`;
		} else {
			this.item.text = "$(check) Sentinel: OK";
			this.item.backgroundColor = undefined;
			this.item.tooltip = "OpenAPI spec is valid — click to re-validate";
		}
		this.item.show();
	}

	show(): void {
		this.item.text = "$(shield) Sentinel";
		this.item.show();
	}

	clear(): void {
		this.item.text = "$(shield) Sentinel";
		this.item.backgroundColor = undefined;
		this.item.tooltip = "Click to validate";
		this.item.show();
	}

	hide(): void {
		this.item.hide();
	}

	dispose(): void {
		this.item.dispose();
	}
}
