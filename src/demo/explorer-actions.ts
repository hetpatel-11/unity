import type {
	WorkspaceExplorerListing,
	WorkspaceSourceFile,
	WorkspaceSourceWrite,
} from "#/domain/workspace-explorer";
import type { WorkspaceFilePreview } from "#/domain/file-preview";
type Scope = {
	projectId?: string;
	sessionId?: string;
	path?: string;
	revision?: string;
	text?: string;
};
const files = new Map([
	[
		"README.md",
		"# Unity\n\nOne thread for all your agents.\n\nThis is the extracted ytimesy frontend.",
	],
	["src/captain.ts", 'export const projectName = \"Unity\";\n'],
]);
export async function listWorkspaceExplorerFn(_input: {
	data: Scope;
}): Promise<WorkspaceExplorerListing> {
	return { root: "/unity-preview", paths: [...files.keys()] };
}
export async function readWorkspaceSourceFn({
	data,
}: {
	data: Scope;
}): Promise<WorkspaceSourceFile | null> {
	const text = files.get(data.path ?? "");
	return text === undefined ? null : { path: data.path!, text };
}
export async function writeWorkspaceSourceFn({
	data,
}: {
	data: Scope;
}): Promise<WorkspaceSourceWrite> {
	if (!data.path || data.text === undefined)
		return { ok: false, reason: "invalid" };
	files.set(data.path, data.text);
	return { ok: true, path: data.path };
}
export async function readWorkspacePreviewFn({
	data,
}: {
	data: Scope;
}): Promise<WorkspaceFilePreview> {
	const text = files.get(data.path ?? "");
	return text === undefined
		? { kind: "unavailable", reason: "Not included in the frontend preview." }
		: { kind: "text", text };
}
