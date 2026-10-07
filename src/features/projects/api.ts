export async function requestJson<T>(
	path: string,
	_body?: unknown,
): Promise<T> {
	let result: unknown;
	if (path === "/api/account")
		result = { user: { name: "Het Patel", email: "preview@unity.local" } };
	else if (path.startsWith("/api/workspaces")) result = null;
	else if (path === "/api/projects") result = [];
	else throw new Error("This action requires a connected backend.");
	return result as T;
}
