import { spawn } from "node:child_process";
import { mkdirSync, existsSync, symlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
const env = {
	...process.env,
	UNITY_HOST: process.env.UNITY_HOST ?? "0.0.0.0",
	UNITY_PORT: process.env.PORT ?? "8080",
	UNITY_TOOL_TOKEN:
		process.env.UNITY_TOOL_TOKEN ?? randomBytes(32).toString("hex"),
	UNITY_API_URL: `http://127.0.0.1:${process.env.PORT ?? "8080"}`,
	EVE_TELEMETRY_DISABLED: "1",
};
const children = [];
if (env.UNITY_MODE === "live") {
	mkdirSync("/data/eve-workflow", { recursive: true });
	mkdirSync(".eve", { recursive: true });
	if (!existsSync(".eve/.workflow-data"))
		symlinkSync("/data/eve-workflow", ".eve/.workflow-data");
	env.EVE_URL ??= "http://127.0.0.1:4320";
	if (env.UNITY_SUPERVISOR_PROVIDER !== "agent37" && env.EVE_URL.includes("127.0.0.1:4320"))
		children.push(
			spawn(
				"pnpm",
				["exec", "eve", "start", "--host", "127.0.0.1", "--port", "4320"],
				{ env, stdio: "inherit" },
			),
		);
}
children.push(spawn("pnpm", ["start"], { env, stdio: "inherit" }));
for (const signal of ["SIGINT", "SIGTERM"])
	process.on(signal, () => {
		for (const child of children) child.kill(signal);
		process.exit();
	});
for (const child of children)
	child.on("exit", (code) => {
		for (const other of children) other.kill();
		process.exit(code ?? 1);
	});
