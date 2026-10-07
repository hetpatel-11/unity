export function visibleWorkspacePath(path: string): string {
	const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/");
	const withoutHome = normalized.replace(/^\/home\/[^/]+\//, "");
	const withoutTmp = withoutHome.replace(/^\/tmp\//, "").replace(/^tmp\//, "");
	return withoutTmp.replace(/^\//, "") || path;
}
