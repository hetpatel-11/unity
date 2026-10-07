import { z } from "zod";
export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  sourceThreadId: z.string().optional(),
  streaming: z.boolean().optional(),
  at: z.string(),
});
export const unityThreadSchema = z.object({
  id: z.string(),
  title: z.string(),
  task: z.string(),
  status: z.enum(["running", "waiting", "ready", "paused", "failed", "idle"]),
  summary: z.string(),
  question: z.string().nullable(),
  sessionId: z.string().nullable(),
  responseId: z.string().nullable(),
  messages: z.array(chatMessageSchema),
  queued: z.array(z.string()),
  activity: z.string(),
  revision: z.number(),
});
export const unityRoomSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["demo", "live"]),
  activated: z.boolean(),
  activeDecisionThreadId: z.string().nullable().default(null),
  supervisorSessionId: z.string().nullable(),
  supervisorBusy: z.boolean(),
  supervisorTools: z.array(z.object({id:z.string(),name:z.string(),input:z.string(),output:z.string(),status:z.enum(["inProgress","completed","failed"]),at:z.string()})).default([]),
  threads: z.array(unityThreadSchema),
  messages: z.array(chatMessageSchema),
  events: z.array(
    z.object({
      id: z.string(),
      threadId: z.string(),
      text: z.string(),
      at: z.string(),
    }),
  ),
});
export type UnityThread = z.infer<typeof unityThreadSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type UnityRoom = z.infer<typeof unityRoomSchema>;
export type ThreadAction = "pause" | "resume" | "message" | "review";
export const threadActionSchema = z.object({
  action: z.enum(["pause", "resume", "message", "review"]),
  text: z.string().max(20000).optional(),
});

export const unityWorkspaceSchema = z.object({
  projects: z.array(
    z.object({ id: z.string(), name: z.string(), room: unityRoomSchema }),
  ),
});
export type UnityWorkspace = z.infer<typeof unityWorkspaceSchema>;
