import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEventStream } from "./agent37";
import { RoomStore } from "./store";
import { UnityService } from "./service";

test("SSE survives every byte boundary including CRLF and UTF-8", async () => {
	const text =
		'event: response.output_text.delta\r\ndata: {"text":"café"}\r\n\r\nevent: response.completed\ndata: {"output_text":"café"}\n\n';
	const bytes = new TextEncoder().encode(text);
	const body = new ReadableStream({
		start(controller) {
			for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
			controller.close();
		},
	});
	const events = [];
	for await (const event of parseEventStream(new Response(body)))
		events.push(event);
	assert.deepEqual(events, [
		{ type: "response.output_text.delta", data: { text: "café" } },
		{ type: "response.completed", data: { output_text: "café" } },
	]);
});

test("activation, routed decision, pause, queued instruction and persisted history", async () => {
	const dir = mkdtempSync(join(tmpdir(), "unity-test-"));
	try {
		const store = new RoomStore(join(dir, "room.json"), "demo");
		const service = new UnityService(store);
		service.activate();
		service.activate();
		await service.talk("Tell Authentication to use GitHub login");
		assert.equal(
			store.room.messages.filter((m) => m.text.includes("I’m following"))
				.length,
			1,
		);
		const auth = service.thread("auth");
		assert.equal(auth.status, "running");
		assert.equal(auth.question, null);
		assert.equal(
			auth.messages.at(-1)?.text,
			"Tell Authentication to use GitHub login",
		);
		await service.control(auth.id, "message", "Then add logout");
		assert.deepEqual(auth.queued, ["Then add logout"]);
		await service.control(auth.id, "pause");
		assert.equal(auth.status, "paused");
		await new Promise((resolve) => setTimeout(resolve, 100));
		assert.equal(auth.status, "paused");
		const restored = new RoomStore(join(dir, "room.json"), "demo");
		assert.equal(restored.room.activated, true);
		assert.equal(
			restored.room.threads.find((t) => t.id === "auth")?.messages.at(-1)?.text,
			"Tell Authentication to use GitHub login",
		);
		service.reset();
		await service.control("tests", "pause");
		assert.equal(store.room.activated, false);
		assert.equal(store.room.messages.length, 0);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("live restart preserves remote session and reconnect cursor", () => {
	const dir = mkdtempSync(join(tmpdir(), "unity-test-"));
	try {
		const store = new RoomStore(join(dir, "room.json"), "live");
		store.room.threads.push({
			id: "one",
			title: "One",
			task: "work",
			status: "running",
			summary: "working",
			question: null,
			sessionId: "remote-session",
			responseId: "remote-response",
			messages: [],
			queued: [],
			activity: "working",
			revision: 1,
		});
		store.publish();
		const restored = new RoomStore(join(dir, "room.json"), "live");
		assert.equal(restored.room.threads[0].status, "paused");
		assert.equal(restored.room.threads[0].responseId, "remote-response");
		assert.equal(restored.room.threads[0].sessionId, "remote-session");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});


test("interactive demo round names agents and keeps unanswered decisions waiting", async () => {
 const dir=mkdtempSync(join(tmpdir(),"unity-round-"));
 const store=new RoomStore(join(dir,"room.json"),"demo");
 const service=new UnityService(store);
 try {
  await service.demoRound("B");
  assert.equal(store.room.threads.length,10);
  assert.equal(store.room.threads[0].title,"Agent 1B · Navigation");
  assert.ok(store.room.threads.every(t=>t.status==="waiting" && t.question));
  await service.talk("Choose Sidebar",store.room.threads[0].id);
  assert.equal(store.room.threads[0].status,"running");
  assert.equal(store.room.threads[0].question,null);
  assert.equal(store.room.threads[1].status,"waiting");
  await new Promise(r=>setTimeout(r,4600));
  assert.equal(store.room.threads[0].status,"waiting");
  assert.match(store.room.threads[0].question!,/GitHub/);
  assert.ok(store.room.messages.some(m=>m.sourceThreadId===store.room.threads[0].id && m.text.startsWith("**Turn finished**")));
  assert.ok(store.room.messages.some(m=>m.text.includes("Agent 1B · Navigation needs your decision")));
  assert.equal(store.room.activeDecisionThreadId,store.room.threads[1].id);
 } finally {for(const t of store.room.threads) await service.control(t.id,"pause");rmSync(dir,{recursive:true,force:true});}
});


test("explicit demo agent wins over the current decision", async () => {
 const dir=mkdtempSync(join(tmpdir(),"unity-target-"));
 const store=new RoomStore(join(dir,"room.json"),"demo");
 const service=new UnityService(store);
 try {
  await service.demoRound("A");
  await service.talk("Tell Agent 3A to cover Mobile Escape dismissal");
  assert.equal(store.room.threads[2].status,"running");
  assert.equal(store.room.threads[0].status,"waiting");
  assert.match(store.room.threads[2].messages.at(-1)!.text,/Mobile Escape/);
 } finally {for(const t of store.room.threads) await service.control(t.id,"pause");rmSync(dir,{recursive:true,force:true});}
});
