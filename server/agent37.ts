import type { UnityThread } from "../src/domain/unity";
export type AgentEvent = { type: string; data: Record<string, unknown> };
export class Agent37 {
	private origin: string;
	constructor(
		instanceId: string,
		private apiKey: string,
	) {
		if (!/^[a-zA-Z0-9-]+$/.test(instanceId))
			throw new Error("Invalid Agent37 instance ID");
		this.origin = `https://${instanceId}.agent37.app`;
	}
	private async request(path: string, body?: unknown, signal?: AbortSignal) {
		const response = await fetch(this.origin + path, {
			method: body === undefined ? "GET" : "POST",
			headers: {
				"X-Agent37-Key": this.apiKey,
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			signal,
			redirect: "error",
		});
		if (!response.ok)
			throw new Error(
				`Agent37 returned ${response.status}: ${(await response.text()).slice(0, 500)}`,
			);
		return response;
	}
	async *run(
		thread: UnityThread,
		text: string,
		signal: AbortSignal,
	): AsyncGenerator<AgentEvent> {
		const response = await this.request(
			"/v1/responses",
			{
				input: text,
				stream: true,
				...(thread.sessionId ? { session_id: thread.sessionId } : {}),
			},
			signal,
		);
		yield* parseEventStream(response);
	}
	async *reattach(responseId: string, signal: AbortSignal) {
		yield* parseEventStream(
			await this.request(
				`/v1/responses/${encodeURIComponent(responseId)}/stream`,
				undefined,
				signal,
			),
		);
	}
	async stop(responseId: string) {
		await this.request(
			`/v1/responses/${encodeURIComponent(responseId)}/cancel`,
			{},
		);
		// Cancel is acknowledged before the Codex turn unwinds. Wait until the
		// session is free so an immediate resume does not collide with it.
		for (let attempt = 0; attempt < 20; attempt++) {
			const response = await this.request(
				`/v1/responses/${encodeURIComponent(responseId)}`,
			);
			const result = await response.json();
			if (result.status !== "in_progress" && result.status !== "queued") return;
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		throw new Error("Codex is still stopping. Wait before resuming this chat.");
	}
}
export async function* parseEventStream(
	response: Response,
): AsyncGenerator<AgentEvent> {
	if (!response.body) throw new Error("Agent37 returned an empty stream");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		for (;;) {
			const { value, done } = await reader.read();
			buffer += decoder.decode(value, { stream: !done });
			buffer = buffer.replace(/\r\n/g, "\n");
			let boundary: number;
			while ((boundary = buffer.indexOf("\n\n")) >= 0) {
				const frame = buffer.slice(0, boundary);
				buffer = buffer.slice(boundary + 2);
				const type = frame.match(/^event:\s*(.+)$/m)?.[1];
				const data = frame
					.split("\n")
					.filter((line) => line.startsWith("data:"))
					.map((line) => line.slice(5).trimStart())
					.join("\n");
				if (type && data) {
					const parsed: unknown = JSON.parse(data);
					if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
						yield { type, data: parsed as Record<string, unknown> };
				}
			}
			if (done) break;
		}
	} finally {
		reader.releaseLock();
	}
}
