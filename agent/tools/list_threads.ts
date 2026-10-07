import { defineTool } from "eve/tools";
import { z } from "zod";
import { unityRequest } from "../lib/transport";
export default defineTool({
	description:
		"List all independent Codex chats and their observed status, summary, question, and queued instructions.",
	inputSchema: z.object({}),
	execute: (_,ctx) => unityRequest("/internal/threads",undefined,ctx.session.id),
});
