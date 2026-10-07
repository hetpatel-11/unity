import { spawn } from "node:child_process";
import { localEnvironment } from "./local-env.mjs";
const env = localEnvironment();
const children = [
	spawn("pnpm", ["dev:api"], { stdio: "inherit", env }),
	spawn("pnpm", ["dev"], { stdio: "inherit", env }),
];
if (env.UNITY_MODE === "live" && env.EVE_URL?.includes("127.0.0.1:4320"))
	children.push(spawn("pnpm", ["dev:eve"], { stdio: "inherit", env }));
for (const signal of ["SIGINT", "SIGTERM"])
	process.on(signal, () => {
		for (const child of children) child.kill(signal);
		process.exit();
	});
for (const child of children)
	child.on("exit", (code) => {
		if (code) {
			for (const other of children) other.kill();
			process.exit(code);
		}
	});
