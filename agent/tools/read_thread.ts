import { defineTool } from "eve/tools";
import { z } from "zod";
import { unityRequest } from "../lib/transport";
export default defineTool({
	description:
		"Read a Codex chat transcript and its task before inspecting or directing its work.",
	inputSchema: z.object({ threadId: z.string() }),
	execute: ({ threadId },ctx) =>
		unityRequest(`/internal/threads/${encodeURIComponent(threadId)}`,undefined,ctx.session.id),
});
