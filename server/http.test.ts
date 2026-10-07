import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("HTTP authentication, origin guard, supervisor isolation and live SSE updates", async () => {
	const probe = createServer();
	await new Promise<void>((r) => probe.listen(0, "127.0.0.1", r));
	const port = (probe.address() as { port: number }).port;
	await new Promise<void>((r) => probe.close(() => r()));
	const dir = mkdtempSync(join(tmpdir(), "unity-http-"));
	const child = spawn(
		process.execPath,
		["--import", "tsx", "server/index.ts"],
		{
			env: {
				...process.env,
				UNITY_MODE: "demo",
				UNITY_HOST: "127.0.0.1",
				UNITY_PORT: String(port),
				UNITY_ACCESS_TOKEN: "test-workspace-key",
				UNITY_TOOL_TOKEN: "test-tool-key",
				UNITY_STATE_PATH: join(dir, "room.json"),
			},
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const base = `http://127.0.0.1:${port}`;
	const signal = AbortSignal.timeout(10000);
	try {
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error("Server did not start")),
				5000,
			);
			child.stdout.on("data", (d) => {
				if (d.toString().includes("API ready")) {
					clearTimeout(timeout);
					resolve();
				}
			});
			child.once("exit", () => {
				clearTimeout(timeout);
				reject(new Error("Server exited"));
			});
		});
		assert.equal((await fetch(base + "/api/state")).status, 401);
		const login = await fetch(base + "/api/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: "test-workspace-key" }),
		});
		assert.equal(login.status, 200);
		const cookie = login.headers.get("set-cookie")!.split(";")[0];
		assert.match(login.headers.get("set-cookie")!, /HttpOnly; SameSite=Strict/);
		assert.equal(
			(await fetch(base + "/internal/threads", { headers: { cookie } })).status,
			403,
		);
		assert.equal(
			(
				await fetch(base + "/internal/threads", {
					headers: { cookie, "X-Unity-Tool-Token": "test-tool-key" },
				})
			).status,
			200,
		);
		assert.equal(
			(
				await fetch(base + "/api/activate", {
					method: "POST",
					headers: {
						cookie,
						Origin: "https://attacker.invalid",
						"Content-Type": "application/json",
					},
					body: "{}",
				})
			).status,
			403,
		);
        const snapshot = await (await fetch(base + "/api/workspace", {headers:{cookie}})).json();
        assert.deepEqual(snapshot.projects.map((p:any)=>p.room.threads.length), [10,10]);
        assert.equal(snapshot.projects[0].room.threads[1].title, "Authentication");
        assert.equal(snapshot.projects[1].room.threads[1].title, "Billing");
        await fetch(base + "/api/threads/studio-auth/control", {method:"POST",headers:{cookie,"Content-Type":"application/json","X-Unity-Project-Id":"studio"},body:JSON.stringify({action:"message",text:"Use monthly billing"})});
        const forge = await (await fetch(base + "/api/state", {headers:{cookie}})).json();
        const studio = await (await fetch(base + "/api/state", {headers:{cookie,"X-Unity-Project-Id":"studio"}})).json();
        assert.equal(forge.threads[1].status, "waiting");
        assert.equal(studio.threads[1].messages.at(-1).text, "Use monthly billing");
        assert.equal((await fetch(base + "/internal/threads", {headers:{cookie,"X-Unity-Tool-Token":"test-tool-key","X-Unity-Session-Id":"unknown-session"}})).status, 403);
		const controller = new AbortController();
		const stream = await fetch(base + "/api/events", {
			headers: { cookie },
			signal: controller.signal,
		});
		assert.equal(stream.status, 200);
		const reader = stream.body!.getReader();
		const first = new TextDecoder().decode((await reader.read()).value);
		assert.match(first, /"activated":false/);
		assert.equal(
			(
				await fetch(base + "/api/activate", {
					method: "POST",
					headers: { cookie, "Content-Type": "application/json" },
					body: "{}",
					signal,
				})
			).status,
			200,
		);
		const update = new TextDecoder().decode((await reader.read()).value);
		assert.match(update, /"activated":true/);
		controller.abort();
	} finally {
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => child.once("exit", () => resolve()));
		rmSync(dir, { recursive: true, force: true });
	}
});
