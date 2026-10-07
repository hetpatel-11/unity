import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { z } from "zod";
import { threadActionSchema } from "../src/domain/unity";
import { RoomStore } from "./store";
import { UnityService } from "./service";
import { Agent37 } from "./agent37";
import { EveSupervisor } from "./supervisor";
import {CodexSupervisor} from "./codex-supervisor";
const mode = process.env.UNITY_MODE === "live" ? "live" : "demo";
if (
	mode === "live" &&
	(!process.env.AGENT37_API_KEY || !process.env.AGENT37_INSTANCE_ID)
)
	throw new Error(
		"Live mode requires AGENT37_API_KEY and AGENT37_INSTANCE_ID. No fallback to demo.",
	);
const rootPath = process.env.UNITY_STATE_PATH ?? `.unity/${mode}-room.json`;
const worker = mode === "live" ? new Agent37(process.env.AGENT37_INSTANCE_ID!,process.env.AGENT37_API_KEY!) : undefined;
const projects = [{id:"forge",name:"Forge"},{id:"studio",name:"Studio"}].map((project,index) => {
 const store = new RoomStore(index === 0 ? rootPath : rootPath.replace(/\.json$/, "-studio.json"), mode);
 if (index === 1 && mode === "demo" && store.room.threads.some(t => t.id === "auth")) {
  const titles = ["Dashboard", "Billing", "Checks"];
  store.room.threads.forEach((t,i) => {t.id=`studio-${t.id}`;t.title=titles[i] ?? t.title;t.task=i===1 ? "Implement billing checkout." : `Work on ${titles[i] ?? t.title}.`;t.messages=[{...t.messages[0],text:t.task},{...t.messages[1],text:i===1 ? "Should checkout use a monthly or annual plan?" : t.summary}];if(i===1){t.question="Should checkout use a monthly or annual plan?";t.summary="Waiting for the checkout plan decision.";}});
 }
 let service:UnityService;
 const supervisor = mode === "live" && process.env.UNITY_SUPERVISOR_PROVIDER === "agent37" ? new CodexSupervisor(worker!,store,()=>service) : mode === "live" && process.env.EVE_URL ? new EveSupervisor(process.env.EVE_URL) : undefined;
 service = new UnityService(store,worker,supervisor);
 return {...project,store,service};
});
function workspace() {return {projects:projects.map(p=>({id:p.id,name:p.name,room:p.store.room}))};}
const host = process.env.UNITY_HOST ?? "127.0.0.1";
if (host !== "127.0.0.1" && mode === "live" && !process.env.UNITY_ACCESS_TOKEN)
	throw new Error("Public binding requires UNITY_ACCESS_TOKEN.");
const toolToken =
	process.env.UNITY_TOOL_TOKEN ?? randomBytes(32).toString("hex");
function sameToken(candidate: string, expected: string) {
	const a = Buffer.from(candidate),
		b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}
function authenticated(req: import("node:http").IncomingMessage) {
	const token = process.env.UNITY_ACCESS_TOKEN;
	if (!token) return true;
	if (
		sameToken(req.headers.authorization?.replace(/^Bearer /, "") ?? "", token)
	)
		return true;
	const cookie =
		req.headers.cookie
			?.split(";")
			.map((v) => v.trim())
			.find((v) => v.startsWith("unity_session="))
			?.slice(14) ?? "";
	const [expires, signature] = cookie.split(".");
	return (
		Number(expires) > Date.now() &&
		sameToken(
			signature ?? "",
			createHmac("sha256", token)
				.update(expires ?? "")
				.digest("hex"),
		)
	);
}
const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
	const path = url.pathname;
 const scopeSession = req.headers["x-unity-session-id"]?.toString();
 const selected = path.startsWith("/internal/") && scopeSession
  ? projects.find(p=>p.store.room.supervisorSessionId === scopeSession)
  : projects.find(p=>p.id === (req.headers["x-unity-project-id"]?.toString() ?? "forge"));
 const {store,service} = selected ?? projects[0];
	const json = (status: number, data: unknown) => {
		res.writeHead(status, {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
		});
		res.end(JSON.stringify(data));
	};
	try {
		if (path === "/health") {
			json(200, { ok: true, mode });
			return;
		}
		if (path.startsWith("/api/") || path.startsWith("/internal/")) {
			const origin = req.headers.origin;
			if (
				origin &&
				origin !==
					(process.env.UNITY_PUBLIC_ORIGIN ??
						(host === "127.0.0.1"
							? "http://127.0.0.1:4317"
							: `http://${req.headers.host}`)) &&
				new URL(origin).host !== req.headers.host
			) {
				json(403, { error: "Origin not allowed" });
				return;
			}
			if (path === "/api/access" && req.method === "GET") {
				json(200, { locked: !authenticated(req) });
				return;
			}
			if (path !== "/api/login" && !authenticated(req)) {
				json(401, { error: "Authentication required" });
				return;
			}
		}
		if (
			path.startsWith("/internal/") &&
			!sameToken(req.headers["x-unity-tool-token"]?.toString() ?? "", toolToken)
		) {
			json(403, { error: "Supervisor tool authentication required" });
			return;
		}
    if (!selected) {json(403,{error:"Project scope not found"});return;}
    if(req.method === "GET" && path === "/api/workspace") {json(200,workspace());return;}
    if(req.method === "GET" && path === "/api/workspace/events") {
      res.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive"});
      const publish = () => res.write(`data: ${JSON.stringify(workspace())}\n\n`);
      publish();const unsubscribers=projects.map(p=>p.store.subscribe(publish));
      const heartbeat=setInterval(()=>res.write(": heartbeat\n\n"),15000);
      res.on("close",()=>{unsubscribers.forEach(fn=>fn());clearInterval(heartbeat);});return;
    }
		if (req.method === "GET" && path === "/api/state") {
			json(200, store.room);
			return;
		}
		if (req.method === "GET" && path === "/api/events") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			res.write(`data: ${JSON.stringify(store.room)}\n\n`);
			const unsubscribe = store.subscribe((room) =>
				res.write(`data: ${JSON.stringify(room)}\n\n`),
			);
			const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15000);
			res.on("close", () => {
				unsubscribe();
				clearInterval(heartbeat);
			});
			return;
		}
		if (req.method === "GET" && path === "/internal/threads") {
			json(200, store.room.threads);
			return;
		}
		if (req.method === "GET" && path.startsWith("/internal/threads/")) {
			json(200, service.thread(decodeURIComponent(path.split("/").at(-1)!)));
			return;
		}
		if (req.method === "POST") {
			if (!req.headers["content-type"]?.includes("application/json")) {
				json(415, { error: "JSON required" });
				return;
			}
			let raw = "";
			for await (const chunk of req) {
				raw += chunk;
				if (raw.length > 64000) {
					json(413, { error: "Request too large" });
					return;
				}
			}
			const body: unknown = JSON.parse(raw || "{}");
			if (path === "/api/login") {
				const input = z.object({ token: z.string().max(500) }).parse(body);
				const token = process.env.UNITY_ACCESS_TOKEN;
				if (!token || !sameToken(input.token, token)) {
					json(401, { error: "Incorrect workspace key" });
					return;
				}
				const expires = String(Date.now() + 24 * 60 * 60 * 1000);
				const signed = createHmac("sha256", token)
					.update(expires)
					.digest("hex");
				res.setHeader(
					"Set-Cookie",
					`unity_session=${expires}.${signed}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.UNITY_PUBLIC_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`,
				);
				json(200, { ok: true });
				return;
			}
			if(path === "/api/focus-decisions") {service.focusDecisions();json(200,{ok:true});return;}
            if (path === "/api/demo-round") {
                await service.demoRound(selected?.id === "studio" ? "B" : "A");
                json(200,{ok:true});return;
            }
			if (path === "/api/activate") {
				service.activate();
				json(200, { ok: true });
				return;
			}
			if (path === "/api/deactivate") {
				store.room.activated = false;
				store.publish();
				json(200, { ok: true });
				return;
			}
			if (path === "/api/reset") {
				service.reset();
				json(200, { ok: true });
				return;
			}
			if (path === "/api/message") {
				const input = z
					.object({
						text: z.string().min(1).max(20000),
						targetId: z.string().optional(),
					})
					.parse(body);
				if (input.targetId) service.thread(input.targetId);
				void service.talk(input.text, input.targetId);
				json(202, { accepted: true });
				return;
			}
			if (path === "/api/threads" || path === "/internal/threads") {
				const input = z
					.object({
						title: z.string().min(1).max(100),
						task: z.string().min(1).max(20000),
					})
					.parse(body);
				json(201, service.create(input.title, input.task));
				return;
			}
			if (/^\/internal\/threads\/[^/]+\/report$/.test(path)) {
				const thread = service.thread(decodeURIComponent(path.split("/")[3]));
				const input = z
					.object({
						summary: z.string().min(1).max(2000),
						question: z.string().max(2000).nullable(),
					})
					.parse(body);
				thread.summary = input.summary;
				thread.question = input.question;
				if (thread.status === "ready" || thread.status === "waiting")
					thread.status = input.question ? "waiting" : "ready";
				store.publish();
				json(200, { ok: true });
				return;
			}
			if (/^\/(api|internal)\/threads\/[^/]+\/control$/.test(path)) {
				const id = decodeURIComponent(path.split("/")[3]);
				const input = threadActionSchema.parse(body);
				await service.control(id, input.action, input.text);
                const thread=service.thread(id);
				json(200, { ok: true, threadId:id,title:thread.title,status:thread.status,delivery:input.action==="message" ? (thread.queued.includes(input.text??"") ? "queued" : "delivered") : input.action });
				return;
			}
		}
		if (
			!path.startsWith("/api/") &&
			!path.startsWith("/internal/") &&
			req.method === "GET"
		) {
			const root = resolve("dist");
			const candidate = resolve(root, "." + path);
			if (!candidate.startsWith(root + "/") && candidate !== root) {
				json(404, { error: "Not found" });
				return;
			}
			const file =
				existsSync(candidate) && extname(candidate)
					? candidate
					: resolve(root, "index.html");
			if (existsSync(file)) {
				const mime: Record<string, string> = {
					".html": "text/html",
					".js": "application/javascript",
					".css": "text/css",
					".svg": "image/svg+xml",
                    ".png": "image/png",
                    ".webp": "image/webp",
					".woff2": "font/woff2",
				};
				res.writeHead(200, {
					"Content-Type": mime[extname(file)] ?? "application/octet-stream",
				});
				res.end(readFileSync(file));
				return;
			}
		}
		json(404, { error: "Not found" });
	} catch (error) {
		json(error instanceof z.ZodError ? 400 : 500, {
			error: error instanceof Error ? error.message : "Request failed",
		});
	}
});
server.listen(Number(process.env.UNITY_PORT ?? 4318), host, () => {
	console.log(
		`Unity API ready on ${host}:${process.env.UNITY_PORT ?? 4318} (${mode})`,
	);
	for (const project of projects) project.service.start();
});
