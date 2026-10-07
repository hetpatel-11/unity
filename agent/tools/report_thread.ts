import { defineTool } from "eve/tools";
import { z } from "zod";
import { unityRequest } from "../lib/transport";
export default defineTool({
	description:
		"After reading a worker transcript, save a short factual summary and the exact unresolved user question, or null when none. This annotates observed work; it does not run or approve code.",
	inputSchema: z.object({
		threadId: z.string(),
		summary: z.string().max(2000),
		question: z.string().max(2000).nullable(),
	}),
	execute: ({ threadId, ...body },ctx) =>
		unityRequest(
			`/internal/threads/${encodeURIComponent(threadId)}/report`,
			body,
			ctx.session.id,
		),
});
