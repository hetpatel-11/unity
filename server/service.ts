import { randomUUID } from "node:crypto";
import type { UnityRoom, UnityThread, ThreadAction } from "../src/domain/unity";
import { RoomStore, message, initialRoom } from "./store";
import { Agent37 } from "./agent37";
import {projectEveEvent} from "./eve-events";
import { EveSupervisor } from "./supervisor";
import {decisions,decisionFor} from "./demo-decisions";
export class UnityService {
	private timers = new Map<string, ReturnType<typeof setTimeout>>();
	private aborts = new Map<string, AbortController>();
	private activityReports = new Map<string,{at:number;text:string}>();

	private supervisorQueue: Promise<void> = Promise.resolve();
	constructor(
		readonly store: RoomStore,
		private worker?: Agent37,
		private supervisor?: Pick<EveSupervisor,"send">,
	) {}
	thread(id: string) {
		const thread = this.store.room.threads.find((t) => t.id === id);
		if (!thread) throw new Error("Thread not found");
		return thread;
	}
	start() {
		if (this.store.room.mode === "live" && this.store.room.activated) {this.store.room.activated=false;this.activate();}
		if (this.store.room.mode === "demo")
			for (const thread of this.store.room.threads)
				if (thread.status === "running") this.simulate(thread);
	}
	activate() {
		if (this.store.room.activated) return;
		this.store.room.activated = true;

		this.store.publish();
		void this.brief(
			"Unity activated. Inspect all existing chats, summarize their current work, and surface decisions needed.",
		);
	}
	reset() {
		if (this.store.room.mode !== "demo")
			throw new Error("Reset is available only in demo mode");
		for (const timer of this.timers.values()) clearTimeout(timer);
		this.timers.clear();
		this.store.room = initialRoom("demo");
		this.store.publish();
		this.start();
	}
    async demoRound(projectCode: string) {
        for(const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
        this.store.room.activated = true;
        this.store.room.activeDecisionThreadId=null;
        this.store.room.messages.push(message("assistant", "**New demo round.** I’m asking each agent for its next decision. Reply here and I’ll send your choice to that agent, follow its work, and bring back the result."));
        for(const [i,thread] of this.store.room.threads.entries()) {
            if(thread.status === "running" && this.worker) await this.control(thread.id,"pause");
            thread.title=`Agent ${i+1}${projectCode} · ${decisions[i % decisions.length][0]}`;
            const question=decisionFor(i);
            if(this.store.room.mode === "demo") {
                thread.status="waiting";thread.question=question;thread.activity="Needs your decision";
                thread.summary="Ready to implement your choice (simulated demo).";
                thread.messages.push(message("assistant",question));
            } else {
                const instruction=`You are ${thread.title}. We are starting an interactive demo round. Your first response must ONLY ask this product decision, without implementing anything yet: ${question}. End with the exact line UNITY_QUESTION: ${question}. Wait for the user's answer. When they answer, make a small working change in your existing isolated /tmp workspace, run a meaningful check, report actual results, and end with UNITY_QUESTION: followed by a concrete next product choice with two options in parentheses separated by / . Never invent completed work. Keep each implementation turn small. This authorizes successive enhancements only when the user answers your question.`;
                void this.sendWorker(thread,instruction);
            }
        }
        this.askNextDecision();
        this.store.publish();
    }
    focusDecisions() {
        this.store.room.activeDecisionThreadId=null;
        this.store.room.messages.push(message("assistant","**New demo round.** I’m supervising all ten agents here. I’ll bring you one decision at a time. Reply in this conversation; I’ll direct the agent and follow its work."));
        this.askNextDecision();this.store.publish();
    }
    private askNextDecision() {
        const room=this.store.room;
        if(room.activeDecisionThreadId && room.threads.find(t=>t.id===room.activeDecisionThreadId)?.question) return;
        const next=room.threads.find(t=>t.status==="waiting" && t.question);
        room.activeDecisionThreadId=next?.id ?? null;
        if(next) room.messages.push(message("assistant",`**${next.title} needs your decision.**\n\n${next.question}\n\nReply here and I’ll tell ${next.title.split(" · ")[0]} what to do.`,next.id));
    }

	create(title: string, task: string) {
		const thread: UnityThread = {
			id: randomUUID(),
			title,
			task,
			status: "idle",
			summary: "New chat",
			question: null,
			sessionId: null,
			responseId: null,
			messages: [],
			queued: [],
			activity: "Ready to start",
			revision: 0,
		};
		this.store.room.threads.push(thread);
		this.store.publish();
		void this.sendWorker(thread, task);
		return thread;
	}
	async control(id: string, action: ThreadAction, text?: string) {
		const thread = this.thread(id);
		if (action === "pause") {
			const previousStatus = thread.status;
			thread.status = "paused";
			try {
				if (this.worker && thread.responseId)
					await this.worker.stop(thread.responseId);
			} catch (error) {
				thread.status = previousStatus;
				throw error;
			}
			this.aborts.get(id)?.abort();
			clearTimeout(this.timers.get(id));
			this.timers.delete(id);
			thread.status = "paused";
			thread.activity = "Paused by you";
			thread.summary = "Paused. Work and conversation are preserved.";
			this.store.event(id, "Paused");
			return;
		}
		if (action === "review") {
			thread.messages.push(
				message(
					"assistant",
					this.store.room.mode === "demo"
						? "Demo evidence: navigation handles mobile widths; API provider remains undecided; test run is simulated. No real code was executed."
						: thread.summary,
				),
			);
			this.store.publish();
			await this.brief(
				`Review the result of ${thread.title}. Read its transcript. Report the evidence available, and do not claim checks you did not run.`,
			);
			return;
		}
		if (action === "resume") {
			if (thread.status === "running") return;
			if (
				this.worker &&
				thread.responseId &&
				(thread.status === "failed" ||
					thread.activity.startsWith("Server restarted"))
			) {
				void this.consume(
					thread,
					this.worker.reattach(thread.responseId, this.controller(id).signal),
				);
				return;
			}
			thread.responseId = null;
			void this.sendWorker(
				thread,
				text ?? thread.queued.shift() ?? "Continue your previous task.",
			);
			return;
		}
		if (!text?.trim()) throw new Error("A message is required");
		if (thread.status === "running") {
			thread.queued.push(text);
			this.store.event(id, "Instruction queued for the next turn");
			return;
		}
		void this.sendWorker(thread, text);
	}
	private controller(id: string) {
		const controller = new AbortController();
		this.aborts.set(id, controller);
		return controller;
	}
	private async sendWorker(thread: UnityThread, text: string) {
		thread.messages.push(message("user", text));
		thread.question = null;
        if(this.store.room.activeDecisionThreadId===thread.id) this.store.room.activeDecisionThreadId=null;
        this.askNextDecision();
		thread.status = "running";
		thread.activity = "Reading your instruction";
		thread.summary = `Working on: ${text}`;
		thread.revision++;
		this.store.event(thread.id, "Instruction delivered");
		if (this.worker)
			await this.consume(
				thread,
				this.worker.run(thread, text, this.controller(thread.id).signal),
			);
		else this.simulate(thread, text);
	}
	private simulate(thread: UnityThread, text = "") {
		clearTimeout(this.timers.get(thread.id));
		thread.activity = "Updating the implementation";
		this.store.publish();
		this.timers.set(
			thread.id,
			setTimeout(() => {
				thread.activity = "Checking the result";
				this.store.publish();
				this.timers.set(
					thread.id,
					setTimeout(() => {
						thread.status = "ready";
						thread.activity = "Finished";
						thread.summary =
							thread.id === "auth"
								? `Selected ${/github/i.test(text) ? "GitHub" : /email/i.test(text) ? "email" : "the requested"} login. Ready for review (demo).`
								: thread.id === "tests"
									? "Regression checks complete: 12 passed (simulated demo result)."
									: `Completed the requested changes (demo).`;
                        if(thread.title.startsWith("Agent ")) {
                            const index=this.store.room.threads.indexOf(thread);
                            thread.summary += `\n\nUNITY_QUESTION: ${decisionFor((index+thread.revision)%decisions.length)}`;
                        }
						thread.messages.push(message("assistant", thread.summary));
						this.store.event(thread.id, "Turn completed");
						void this.finished(thread);
					}, 2200),
				);
			}, 2200),
		);
	}
	private async consume(
		thread: UnityThread,
		stream: AsyncIterable<{ type: string; data: Record<string, unknown> }>,
	) {
		thread.status = "running";
		let output = "";
		let terminal = false;
		const liveId = thread.responseId
			? `response:${thread.responseId}`
			: randomUUID();
		let outputId = liveId;
		try {
			for await (const event of stream) {
				if (event.type === "response.created") {
					if (typeof event.data.session_id === "string")
						thread.sessionId = event.data.session_id;
					if (typeof event.data.id === "string")
						thread.responseId = event.data.id;
					if (thread.responseId) outputId = `response:${thread.responseId}`;
				}
                if(event.type === "response.tool_call.started") {
                    thread.activity=String(event.data.label ?? event.data.tool ?? "Working");
                    const text=/node.*--test/.test(thread.activity) ? "Running its checks." : /\b(cat|sed|rg|ls)\b/.test(thread.activity) ? "Inspecting its implementation." : "Updating its implementation.";
                    const previous=this.activityReports.get(thread.id);
                    if(this.store.room.activated && (!previous || (previous.text!==text && Date.now()-previous.at>8000))) {
                        this.activityReports.set(thread.id,{at:Date.now(),text});
                        this.store.room.messages.push(message("assistant",text,thread.id));
                    }
                }
				if (
					event.type === "response.output_text.delta" &&
					typeof event.data.text === "string"
				) {
					output += event.data.text;
					const existing = thread.messages.find((m) => m.id === outputId);
					if (existing) existing.text = output;
					else
						thread.messages.push({
							...message("assistant", output),
							id: outputId,
						});
				}
				if (event.type === "response.completed") {
					terminal = true;
					thread.responseId = null;
					if (this.thread(thread.id).status !== "paused")
						thread.status = "ready";
					thread.summary =
						typeof event.data.output_text === "string"
							? event.data.output_text
							: output;
					thread.activity = "Turn completed";
					const finalMessage = thread.messages.find((m) => m.id === outputId);
					if (finalMessage) finalMessage.text = thread.summary;
					else
						thread.messages.push({
							...message("assistant", thread.summary),
							id: outputId,
						});
				}
				if (event.type === "response.failed")
					throw new Error(JSON.stringify(event.data));
				this.store.publish();
			}
			if (!terminal)
				throw new Error(
					"Worker stream disconnected before completion. Resume to reconnect.",
				);
			await this.finished(thread);
		} catch (error) {
			if (this.thread(thread.id).status === "paused") return;
			thread.status = "failed";
			thread.summary = error instanceof Error ? error.message : "Worker failed";
			thread.activity = "Needs attention";
			this.store.event(thread.id, thread.summary);
			void this.brief(`${thread.title} failed: ${thread.summary}`);
		}
	}
	private async finished(thread: UnityThread) {
        const question = thread.summary.match(/UNITY_QUESTION:\s*([^\n]+)/)?.[1]?.trim();
        if(question) {
            thread.question=question;thread.status="waiting";thread.activity="Needs your decision";
            const result=thread.summary.split("UNITY_QUESTION:")[0].trim();
            const report=result.includes("Unity report:") ? result.split("Unity report:").at(-1)!.trim() : result;
            const evidence=this.store.room.mode === "demo" || report.length > question.length+80 ? report.slice(-650) : "Planning is finished. It needs your decision before continuing.";
            this.store.room.messages.push(message("assistant", `**Turn finished**\n\n${evidence}`,thread.id));
            this.askNextDecision();
            this.store.publish();
        }
        if(this.store.room.activated && !question) {
            this.store.room.messages.push(message("assistant",`**Turn finished**\n\n${thread.summary.slice(-500)}`,thread.id));
            this.store.publish();
        }
		if (this.store.room.activated && !question)
			void this.brief(
				`Thread ${thread.title} completed a turn: ${thread.summary}`,
				thread.id,
			);
		const next = thread.queued.shift();
		this.store.publish();
		if (next) void this.sendWorker(thread, next);
	}
	async talk(text: string, targetId?: string) {
        const focus=this.store.room.threads.find(t=>t.id===this.store.room.activeDecisionThreadId);
		this.store.room.messages.push(message("user", text));
		this.store.publish();
		if (targetId) {
			await this.control(targetId, "message", text);
			this.store.room.messages.push(
				message(
					"assistant",
					`Sent to **${this.thread(targetId).title}**${this.thread(targetId).queued.includes(text) ? " (queued until its current turn ends)" : ""}.`,
					targetId,
				),
			);
			this.store.publish();
			return;
		}
		const namesTarget=this.store.room.threads.some(t=>text.toLowerCase().includes(t.title.split(" · ")[0].toLowerCase()));
		await this.brief(focus && !(this.store.room.mode === "demo" && namesTarget) ? `The question currently presented in Unity is from ${focus.title}: ${focus.question}. The user replies: ${text}. If this answers that decision, send it to that agent. If the user names another agent or asks something else, follow that instruction instead. Keep the response concise.` : text);
	}
	private brief(text: string, sourceThreadId?: string): Promise<void> {
		this.supervisorQueue = this.supervisorQueue
			.catch(() => {})
			.then(async () => {
				if (this.store.room.mode === "live") {
					if (!this.supervisor) {
						this.store.room.messages.push(
							message(
								"assistant",
								"Unity needs its Eve connection. Set EVE_URL and start the Eve supervisor. Worker chats remain available.",
							),
						);
						this.store.publish();
						return;
					}
					this.store.room.supervisorBusy = true;
					this.store.publish();
					try {
						const result = await this.supervisor.send(
							this.store.room.supervisorSessionId,
							text,
							(id) => {this.store.room.supervisorSessionId=id;this.store.publish();},
                            (event)=>{projectEveEvent(this.store.room,event);this.store.publish();},
						);
						this.store.room.supervisorSessionId = result.sessionId;
                        if(this.store.room.messages.at(-1)?.text!==result.text) this.store.room.messages.push(message("assistant",result.text,sourceThreadId));
					} catch (error) {
						this.store.room.messages.push(
							message(
								"assistant",
								`Unity could not finish this turn: ${error instanceof Error ? error.message : "Unknown error"}`,
							),
						);
					} finally {
						this.store.room.supervisorBusy = false;
						this.store.publish();
					}
					return;
				}
				const room = this.store.room;
				const lower = text.toLowerCase();
				const target = room.threads.find(
					(t) => lower.includes(t.title.toLowerCase()) || lower.includes(t.title.split(" · ")[0].toLowerCase()) || lower.includes(t.id),
				);
				if (
					target &&
					!text.startsWith("Thread ") &&
					!text.startsWith("Unity activated")
				) {
					if (/\b(pause|stop)\b/.test(lower)) {
						await this.control(target.id, "pause");
						room.messages.push(
							message(
								"assistant",
								`Paused **${target.title}**. Its conversation is preserved.`,
								target.id,
							),
						);
					} else if (/\b(resume|continue)\b/.test(lower)) {
						await this.control(target.id, "resume");
						room.messages.push(
							message("assistant", `Resumed **${target.title}**.`, target.id),
						);
					} else if (/\b(tell|ask|use|change|fix|implement)\b/.test(lower)) {
						await this.control(target.id, "message", text);
						room.messages.push(
							message(
								"assistant",
								`Routed your instruction to **${target.title}**. I’ll bring its result back here.`,
								target.id,
							),
						);
					} else
						room.messages.push(
							message(
								"assistant",
								`**${target.title}** — ${target.summary}${target.question ? "\n\n" + target.question : ""}`,
								target.id,
							),
						);
				} else if (text.startsWith("Thread "))
					room.messages.push(
						message(
							"assistant",
							text
								.replace(/^Thread /, "**")
								.replace(" completed a turn:", "** finished:"),
							target?.id,
						),
					);
				else
					room.messages.push(
						message(
							"assistant",
							`I’m following **${room.threads.length} chats**.\n\n${room.threads.map((t) => `- **${t.title}** — ${t.summary}${t.question ? `\n  **Needs you:** ${t.question}` : ""}`).join("\n")}\n\n${room.threads.some((t) => t.question) ? "You can answer here: “Tell Authentication to use GitHub login.”" : "Use a crew card to send an instruction, pause a chat, or inspect its result."}`,
						),
					);
				this.store.publish();
			});
		return this.supervisorQueue;
	}
}
