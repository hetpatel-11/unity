import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
export function localEnvironment() {
	const env = { ...process.env };
	mkdirSync(".unity", { recursive: true });
	if (!env.UNITY_TOOL_TOKEN) {
		const path = ".unity/tool-token";
		if (!existsSync(path))
			writeFileSync(path, randomBytes(32).toString("hex"), { mode: 0o600 });
		env.UNITY_TOOL_TOKEN = readFileSync(path, "utf8").trim();
	}
	if (env.UNITY_MODE === "live") {
		if (!env.AGENT37_API_KEY && existsSync(".unity/agent37-credential"))
			env.AGENT37_API_KEY = readFileSync(
				".unity/agent37-credential",
				"utf8",
			).trim();
		if (!env.AGENT37_INSTANCE_ID && existsSync(".unity/agent37-instance.json"))
			env.AGENT37_INSTANCE_ID = JSON.parse(
				readFileSync(".unity/agent37-instance.json", "utf8"),
			).id;
		env.EVE_URL ??= "http://127.0.0.1:4320";
	}
	env.UNITY_API_URL = "http://127.0.0.1:4318";
	env.EVE_TELEMETRY_DISABLED = "1";
	return env;
}
