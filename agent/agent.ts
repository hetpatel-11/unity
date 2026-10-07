import { defineAgent } from "eve";
import { chatgpt, openai } from "eve/models/openai";
export default defineAgent({
	model:
		process.env.UNITY_SUPERVISOR_PROVIDER === "openai"
			? openai(process.env.UNITY_MODEL ?? "gpt-6-luna-fast")
			: chatgpt("gpt-5.6-sol"),
	reasoning: "medium",
	defaultTools: false,
	tool: false,
});
