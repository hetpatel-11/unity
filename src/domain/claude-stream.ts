import { agentTodosFromUnknown } from "./agent-todos";
import { fileBasename } from "./file-kind";
import { SessionItemId } from "./ids";
import { activityGlyphForToolName } from "./session-activity";
import type { SessionItem, ToolActivityStatus } from "./session-item";

/**
 * Claude Code `-p --output-format stream-json` writes one event per line.
 * Map those onto the same timeline items Codex and OpenCode already use so
 * a running turn shows reasoning and tool calls instead of a final text dump.
 */
export function sessionItemsFromClaudeStream(
	output: string | null,
): SessionItem[] {
	const items: SessionItem[] = [];
	const toolIndex = new Map<string, number>();
	for (const event of claudeStreamEvents(output)) {
		if (!isRecord(event)) continue;
		const type = readNonEmpty(event.type);
		if (
			type === "stream_event" ||
			type === "content_block_start" ||
			type === "content_block_delta" ||
			type === "content_block_stop"
		) {
			applyStreamEvent(items, toolIndex, event);
			continue;
		}
		if (type === "assistant") {
			appendAssistantBlocks(items, toolIndex, event);
			continue;
		}
		if (type === "user") {
			applyToolResults(items, toolIndex, event);
			continue;
		}
		if (type === "result") {
			settleLastAgentMessage(items);
			appendResult(items, event);
		}
	}
	return items;
}

export function claudeTurnItemsFromStream(input: {
	readonly previousItems: readonly SessionItem[];
	readonly stream: string | null;
}): SessionItem[] {
	const prior = itemsThroughLastUserMessage(input.previousItems);
	const turnId = prior.at(-1)?.id ?? "initial";
	const streamed = sessionItemsFromClaudeStream(input.stream)
		.filter((item) => item.kind !== "userMessage")
		.map((item) => ({ ...item, id: SessionItemId(`${turnId}:${item.id}`) }));
	return streamed.length === 0 ? [...prior] : [...prior, ...streamed];
}

export function claudeStreamTerminalResult(
	output: string | null,
):
	| { readonly kind: "completed" }
	| { readonly kind: "failed"; readonly message: string }
	| null {
	for (const event of claudeStreamEvents(output)) {
		if (!isRecord(event) || readNonEmpty(event.type) !== "result") continue;
		if (event.is_error === true) {
			return {
				kind: "failed",
				message:
					readNonEmpty(event.result) ??
					readNonEmpty(event.error) ??
					"Claude Code did not return a response.",
			};
		}
		return { kind: "completed" };
	}
	return null;
}

export function claudeStreamEvents(output: string | null): unknown[] {
	if (!output) return [];
	const events: unknown[] = [];
	for (const line of output.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("{")) continue;
		try {
			events.push(JSON.parse(trimmed));
		} catch {
			// The last line is often still being written.
		}
	}
	return events;
}

function appendAssistantBlocks(
	items: SessionItem[],
	toolIndex: Map<string, number>,
	event: Record<string, unknown>,
) {
	for (const block of contentBlocks(event)) {
		const type = readNonEmpty(block.type);
		if (type === "thinking" || type === "redacted_thinking") {
			const text =
				readNonEmpty(block.thinking) ?? readNonEmpty(block.text) ?? "";
			const index = lastIndexOfKind(items, "reasoning");
			if (index >= 0) {
				const current = items[index];
				if (current?.kind === "reasoning") {
					items[index] = {
						...current,
						summaries: text ? [text] : current.summaries,
					};
				}
				continue;
			}
			items.push({
				kind: "reasoning",
				id: SessionItemId(
					readNonEmpty(block.id) ?? streamItemId("think", items),
				),
				summaries: text ? [text] : [],
			});
			continue;
		}
		if (type === "text") {
			const text = readNonEmpty(block.text);
			if (!text) continue;
			const index = lastIndexOfKind(items, "agentMessage");
			if (index >= 0) {
				const current = items[index];
				if (current?.kind === "agentMessage") {
					items[index] = settledAgentMessage({ ...current, text });
				}
				continue;
			}
			items.push(
				settledAgentMessage({
					id: SessionItemId(
						readNonEmpty(block.id) ?? streamItemId("text", items),
					),
					text,
				}),
			);
			continue;
		}
		if (type === "tool_use") {
			const toolId = readNonEmpty(block.id) ?? streamItemId("tool", items);
			const existingIndex = toolIndex.get(toolId);
			if (existingIndex !== undefined) {
				if (block.name === "TodoWrite")
					items[existingIndex] = itemFromClaudeToolUse(block, toolId);
				continue;
			}
			toolIndex.set(toolId, items.length);
			items.push(itemFromClaudeToolUse(block, toolId));
		}
	}
}

function applyStreamEvent(
	items: SessionItem[],
	toolIndex: Map<string, number>,
	event: Record<string, unknown>,
) {
	const nested = isRecord(event.event) ? event.event : event;
	const kind = readNonEmpty(nested.type);
	if (kind === "content_block_start") {
		const block = isRecord(nested.content_block) ? nested.content_block : {};
		const blockType = readNonEmpty(block.type);
		if (blockType === "thinking" || blockType === "redacted_thinking") {
			items.push({
				kind: "reasoning",
				id: SessionItemId(
					readNonEmpty(block.id) ?? streamItemId("think", items),
				),
				summaries: [],
			});
			return;
		}
		if (blockType === "text") {
			return;
		}
		if (blockType === "tool_use") {
			const toolId = readNonEmpty(block.id) ?? streamItemId("tool", items);
			if (toolIndex.has(toolId)) return;
			toolIndex.set(toolId, items.length);
			items.push(itemFromClaudeToolUse(block, toolId));
		}
		return;
	}
	const last = items.at(-1);
	if (kind === "content_block_stop" && last?.kind === "agentMessage") {
		items[items.length - 1] = settledAgentMessage(last);
		return;
	}
	if (kind !== "content_block_delta") return;
	const delta = isRecord(nested.delta) ? nested.delta : {};
	const deltaType = readNonEmpty(delta.type);
	if (deltaType === "thinking_delta") {
		const next = readDelta(delta.thinking) ?? readDelta(delta.text);
		if (!next) return;
		appendThinkingDelta(items, next);
		return;
	}
	if (deltaType === "text_delta") {
		const next = readDelta(delta.text);
		if (!next) return;
		if (last?.kind === "agentMessage") {
			items[items.length - 1] = {
				...last,
				text: `${last.text}${next}`,
				streaming: true,
			};
			return;
		}
		items.push({
			kind: "agentMessage",
			id: SessionItemId(streamItemId("text", items)),
			text: next,
			streaming: true,
		});
	}
}

function applyToolResults(
	items: SessionItem[],
	toolIndex: Map<string, number>,
	event: Record<string, unknown>,
) {
	for (const block of contentBlocks(event)) {
		if (readNonEmpty(block.type) !== "tool_result") continue;
		const toolId = readNonEmpty(block.tool_use_id);
		if (!toolId) continue;
		const index = toolIndex.get(toolId);
		if (index == null) continue;
		const current = items[index];
		if (!current) continue;
		const output = toolResultText(block);
		const failed = block.is_error === true;
		const status: ToolActivityStatus = failed ? "failed" : "completed";
		if (current.kind === "plan" && failed) {
			items[index] = {
				kind: "unknown",
				id: current.id,
				type: "Todo update failed",
			};
			continue;
		}
		if (current.kind === "commandExecution") {
			items[index] = {
				...current,
				status,
				output: output ?? current.output,
				exitCode: failed ? (current.exitCode ?? 1) : 0,
			};
			continue;
		}
		if (current.kind === "dynamicToolCall" || current.kind === "mcpToolCall") {
			items[index] = { ...current, status };
		}
	}
}

function appendResult(items: SessionItem[], event: Record<string, unknown>) {
	if (event.is_error === true) {
		const message =
			readNonEmpty(event.result) ??
			readNonEmpty(event.error) ??
			"Claude Code did not return a response.";
		items.push({
			kind: "error",
			id: SessionItemId(streamItemId("error", items)),
			message,
		});
		return;
	}
	const text = readNonEmpty(event.result);
	if (!text) return;
	if (
		items.some((item) => item.kind === "agentMessage" && item.text === text)
	) {
		return;
	}
	items.push(
		settledAgentMessage({
			id: SessionItemId(streamItemId("result", items)),
			text,
		}),
	);
}

function appendThinkingDelta(items: SessionItem[], next: string) {
	const index =
		items.at(-1)?.kind === "reasoning"
			? items.length - 1
			: lastIndexOfKind(items, "reasoning");
	if (index >= 0) {
		const current = items[index];
		if (current?.kind === "reasoning") {
			const prev = current.summaries.at(-1) ?? "";
			items[index] = {
				...current,
				summaries: prev
					? [...current.summaries.slice(0, -1), prev + next]
					: [next],
			};
		}
		return;
	}
	items.push({
		kind: "reasoning",
		id: SessionItemId(streamItemId("think", items)),
		summaries: [next],
	});
}

function settleLastAgentMessage(items: SessionItem[]) {
	const last = items.at(-1);
	if (last?.kind === "agentMessage") {
		items[items.length - 1] = settledAgentMessage(last);
	}
}

function settledAgentMessage(item: {
	readonly id: SessionItem["id"];
	readonly text: string;
}): Extract<SessionItem, { kind: "agentMessage" }> {
	return {
		kind: "agentMessage",
		id: item.id,
		text: item.text,
	};
}

function itemFromClaudeToolUse(
	block: Record<string, unknown>,
	toolId: string,
): SessionItem {
	const tool = readNonEmpty(block.name) ?? "tool";
	const args = isRecord(block.input) ? block.input : {};
	if (tool === "TodoWrite" && Array.isArray(args.todos)) {
		return {
			kind: "plan",
			id: SessionItemId(toolId),
			text: "",
			todos: agentTodosFromUnknown(args.todos),
		};
	}
	const glyph = activityGlyphForToolName(tool);
	if (glyph === "shell") {
		return {
			kind: "commandExecution",
			id: SessionItemId(toolId),
			command: readNonEmpty(args.command) ?? readNonEmpty(args.cmd) ?? tool,
			cwd: readNonEmpty(args.workdir) ?? readNonEmpty(args.cwd) ?? null,
			status: "inProgress",
			output: null,
			exitCode: null,
		};
	}
	if (glyph === "web") {
		return {
			kind: "webSearch",
			id: SessionItemId(toolId),
			query:
				readNonEmpty(args.query) ??
				readNonEmpty(args.url) ??
				readNonEmpty(args.pattern) ??
				null,
		};
	}
	return {
		kind: "dynamicToolCall",
		id: SessionItemId(toolId),
		tool: claudeToolTitle(tool, args),
		status: "inProgress",
	};
}

function claudeToolTitle(tool: string, args: Record<string, unknown>): string {
	const path =
		readNonEmpty(args.path) ??
		readNonEmpty(args.file_path) ??
		readNonEmpty(args.filePath) ??
		readNonEmpty(args.file);
	if (path) return `${tool} ${fileBasename(path)}`;
	const query =
		readNonEmpty(args.pattern) ??
		readNonEmpty(args.query) ??
		readNonEmpty(args.glob);
	if (query) return `${tool} ${query}`;
	return tool;
}

function contentBlocks(
	event: Record<string, unknown>,
): Record<string, unknown>[] {
	const message = isRecord(event.message) ? event.message : event;
	const content = message.content;
	if (!Array.isArray(content)) return [];
	return content.filter(isRecord);
}

function toolResultText(block: Record<string, unknown>): string | null {
	if (typeof block.content === "string") return block.content;
	if (Array.isArray(block.content)) {
		return (
			block.content
				.filter(isRecord)
				.map((part) => readNonEmpty(part.text))
				.filter((part): part is string => Boolean(part))
				.join("\n")
				.trim() || null
		);
	}
	return readNonEmpty(block.text) ?? null;
}

function itemsThroughLastUserMessage(
	items: readonly SessionItem[],
): SessionItem[] {
	let lastUser = -1;
	for (let index = 0; index < items.length; index += 1) {
		if (items[index]?.kind === "userMessage") lastUser = index;
	}
	return lastUser >= 0 ? items.slice(0, lastUser + 1) : [...items];
}

function streamItemId(kind: string, items: readonly SessionItem[]): string {
	return `claude-${kind}-${items.length}`;
}

function lastIndexOfKind(
	items: readonly SessionItem[],
	kind: SessionItem["kind"],
): number {
	for (let index = items.length - 1; index >= 0; index -= 1) {
		if (items[index]?.kind === kind) return index;
	}
	return -1;
}

function readDelta(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNonEmpty(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
