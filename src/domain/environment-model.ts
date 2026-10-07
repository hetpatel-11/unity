import { z } from "zod";

export const environmentModelRequest = z
	.object({
		harness: z.enum(["codex", "api"]),
		modelId: z.string().min(1).max(1024),
		allowApi: z.boolean().default(false),
	})
	.strict();
export type EnvironmentModelRequest = z.infer<typeof environmentModelRequest>;

export const environmentModel = z.discriminatedUnion("provider", [
	z
		.object({
			provider: z.literal("codex"),
			modelId: z.string().min(1).max(512),
		})
		.strict(),
	z
		.object({
			provider: z.literal("api"),
			connectionId: z.uuid(),
			revision: z.string().min(1),
			modelId: z.string().min(1).max(512),
			allowApi: z.literal(true),
		})
		.strict(),
]);
export type EnvironmentModel = z.infer<typeof environmentModel>;
