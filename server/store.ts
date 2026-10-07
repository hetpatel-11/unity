import { randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import {
	unityRoomSchema,
	type UnityRoom,
	type ChatMessage,
} from "../src/domain/unity";
export function message(
	role: ChatMessage["role"],
	text: string,
	sourceThreadId?: string,
): ChatMessage {
	return {
		id: randomUUID(),
		role,
		text,
		sourceThreadId,
		at: new Date().toISOString(),
	};
}
export function initialRoom(mode: UnityRoom["mode"]): UnityRoom {
	const specs = [
		[
			"frontend",
			"Frontend",
			"Build the workspace navigation and mobile layout.",
			"ready",
			"Navigation is implemented. Ready for your review.",
			null,
		],
		[
			"auth",
			"Authentication",
			"Implement sign-in and session handling.",
			"waiting",
			"Sign-in flow is waiting for a provider decision.",
			"Should I use GitHub or email login?",
		],
		[
			"tests",
			"Tests",
			"Verify the API and write regression tests.",
			"running",
			"Checking API behavior and regression tests.",
			null,
		],

        ["search", "Search", "Implement project search.", "ready", "Search results and empty states implemented (demo).", null],
        ["notifications", "Notifications", "Implement notification preferences.", "ready", "Notification preferences are ready (demo).", null],
        ["settings", "Settings", "Build workspace settings.", "ready", "Settings form is ready (demo).", null],
        ["accessibility", "Accessibility", "Check keyboard navigation.", "ready", "Keyboard navigation checked (demo).", null],
        ["performance", "Performance", "Measure startup performance.", "ready", "Performance measurements are simulated in this demo.", null],
        ["api", "API", "Implement project endpoints.", "ready", "Project endpoints implemented (demo).", null],
        ["docs", "Documentation", "Document setup and usage.", "ready", "Setup guide written (demo).", null],
	] as const;
	return {
		version: 1,
		mode,
		activated: false,
        activeDecisionThreadId: null,
		supervisorSessionId: null,
		supervisorBusy: false,
        supervisorTools: [],
		threads:
			mode === "demo"
				? specs.map(([id, title, task, status, summary, question]) => ({
						id,
						title,
						task,
						status,
						summary,
						question,
						sessionId: null,
						responseId: null,
						messages: [
							message("user", task),
							message("assistant", question ?? summary),
						],
						queued: [],
						activity: summary,
						revision: 0,
					}))
				: [],
		messages: [],
		events: [],
	};
}
export class RoomStore {
	room: UnityRoom;
	private listeners = new Set<(room: UnityRoom) => void>();
	constructor(
		private path: string,
		mode: UnityRoom["mode"],
	) {
		this.room = existsSync(path)
			? unityRoomSchema.parse(JSON.parse(readFileSync(path, "utf8")))
			: initialRoom(mode);
		if (this.room.mode !== mode) this.room = initialRoom(mode);
        if (mode === "demo") {
            const existing = new Set(this.room.threads.map(t=>t.id.replace(/^studio-/,"")));
            this.room.threads.push(...initialRoom("demo").threads.filter(t=>!existing.has(t.id)));
        }
		this.room.supervisorBusy = false;
        for(const tool of this.room.supervisorTools) if(tool.status==="inProgress"){tool.status="failed";tool.output="Server restarted before the tool result was observed.";}
        for(const m of this.room.messages) m.streaming=false;
		for (const thread of this.room.threads)
			if (thread.status === "running" && mode === "live") {
				thread.status = "paused";
				thread.activity =
					"Server restarted. Resume to reconnect to the running response.";
			}
	}
	subscribe(fn: (room: UnityRoom) => void) {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}
	publish() {
		mkdirSync(dirname(this.path), { recursive: true });
		writeFileSync(this.path + ".tmp", JSON.stringify(this.room, null, 2), {
			mode: 0o600,
		});
		renameSync(this.path + ".tmp", this.path);
		for (const fn of this.listeners) fn(this.room);
	}
	event(threadId: string, text: string) {
		this.room.events.unshift({
			id: randomUUID(),
			threadId,
			text,
			at: new Date().toISOString(),
		});
		this.room.events = this.room.events.slice(0, 200);
		this.publish();
	}
}
