import { visibleWorkspacePath } from "./visible-workspace-path";

export const MAX_WORKSPACE_EXPLORER_PATHS = 4000;
export const MAX_WORKSPACE_SOURCE_CHARS = 200_000;

export type WorkspaceExplorerListing = {
	readonly root: string | null;
	readonly paths: readonly string[];
};

export type WorkspaceSourceFile = {
	readonly path: string;
	readonly text: string;
};

export type WorkspaceSourceWrite =
	| { readonly ok: true; readonly path: string }
	| { readonly ok: false; readonly reason: "asleep" | "invalid" | "failed" };

export function parseWorkspaceExplorerListing(
	output: string,
): WorkspaceExplorerListing {
	const lines = output.split(/\r?\n/);
	let root: string | null = null;
	const paths: string[] = [];
	for (const raw of lines) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith("PROJECT_CWD=")) {
			const next = line.slice("PROJECT_CWD=".length).trim();
			if (next) root = next.replace(/\/+$/, "");
			continue;
		}
		if (line.startsWith("{") || line.includes("\0")) continue;
		const path = visibleWorkspacePath(line);
		if (!path || path.includes("..")) continue;
		paths.push(path);
		if (paths.length >= MAX_WORKSPACE_EXPLORER_PATHS) break;
	}
	return { root, paths };
}

export function workspaceSourcePath(
	root: string,
	requested: string,
): string | null {
	const base = root.replace(/\/+$/, "");
	if (!base) return null;
	const raw = requested.replace(/\\/g, "/");
	const absolute = raw.startsWith("/")
		? raw
		: `${base}/${visibleWorkspacePath(raw)}`;
	const normalized = absolute.replace(/\/+/g, "/");
	if (normalized !== base && !normalized.startsWith(`${base}/`)) return null;
	if (normalized.includes("/../") || normalized.endsWith("/..")) return null;
	return normalized;
}

export function workspaceSourceText(contents: string | null): string | null {
	if (contents == null) return null;
	if (contents.includes("\0")) return null;
	if (contents.length <= MAX_WORKSPACE_SOURCE_CHARS) return contents;
	return `${contents.slice(0, MAX_WORKSPACE_SOURCE_CHARS)}\n`;
}

export function workspaceSourceWriteText(text: string): string | null {
	if (text.includes("\0")) return null;
	if (text.length > MAX_WORKSPACE_SOURCE_CHARS) return null;
	return text;
}

export function fileEditorSaveHotkey(event: {
	readonly metaKey: boolean;
	readonly ctrlKey: boolean;
	readonly key: string;
}): boolean {
	return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
}

export function fileEditorSaveShortcut(platform: string): string {
	return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘S" : "Ctrl+S";
}
