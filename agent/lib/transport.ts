export async function unityRequest(path: string, body?: unknown, sessionId?: string) {
	const host = process.env.UNITY_API_URL ?? "http://127.0.0.1:4318";
	const token = process.env.UNITY_TOOL_TOKEN;
	if (!token) throw new Error("Unity tool connection is not configured");
	const response = await fetch(host + path, {
		method: body === undefined ? "GET" : "POST",
		headers: {
			"X-Unity-Tool-Token": token,
			...(sessionId ? {"X-Unity-Session-Id":sessionId} : {}),
			...(process.env.UNITY_ACCESS_TOKEN
				? { Authorization: `Bearer ${process.env.UNITY_ACCESS_TOKEN}` }
				: {}),
			...(body === undefined ? {} : { "Content-Type": "application/json" }),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
		redirect: "error",
	});
	if (!response.ok)
		throw new Error(`Unity tool request failed: ${response.status}`);
	return response.json();
}
