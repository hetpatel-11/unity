import { defineTool } from "eve/tools";
import { z } from "zod";
import { unityRequest } from "../lib/transport";
export default defineTool({
	description:
		"Start an independent Codex chat for a new task. Include all context and explicit workspace isolation instructions needed by this worker.",
	inputSchema: z.object({ title: z.string(), task: z.string() }),
	execute: (body,ctx) => unityRequest("/internal/threads", body,ctx.session.id),
});
