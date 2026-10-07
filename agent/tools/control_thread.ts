import { defineTool } from "eve/tools";
import { z } from "zod";
import { unityRequest } from "../lib/transport";
export default defineTool({
	description:
		"Send a message, pause, resume, or request review of an independent Codex chat. A message to a running chat queues until the next turn.",
	inputSchema: z.object({
		threadId: z.string(),
		action: z.enum(["message", "pause", "resume"]),
		text: z.string().optional(),
	}),
	execute: ({ threadId, ...body },ctx) =>
		unityRequest(
			`/internal/threads/${encodeURIComponent(threadId)}/control`,
			body,
			ctx.session.id,
		),
});
