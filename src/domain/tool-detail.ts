import { commandActivityTitle } from "./command-activity-title";
import { redactSecrets } from "./project-workspace";
import type { DynamicToolCallItem } from "./session-item";

export function toolCommand(item: DynamicToolCallItem): string | null {
	if (!item.input) return null;
	try {
		const input = JSON.parse(item.input);
		return typeof input.command === "string" ? input.command : null;
	} catch {
		return null;
	}
}

export function toolOutputText(output: string): string {
	try {
		let value = JSON.parse(output);
		if (value?.type === "text" && typeof value.value === "string")
			return value.value;
		if (value?.type === "json") value = value.value;
		if (typeof value?.stdout === "string" || typeof value?.stderr === "string")
			return [
				value.stdout,
				value.stderr,
				typeof value.exitCode === "number" ? `exit ${value.exitCode}` : null,
			]
				.filter(Boolean)
				.join("\n");
		return JSON.stringify(value, null, 2) ?? output;
	} catch {
		return output;
	}
}

export function toolDetailTitle(item: DynamicToolCallItem): string {
	const name = item.tool.replaceAll("_", " ");
	if (!item.input) return name;
	try {
		const input = JSON.parse(item.input);
		if (typeof input.command === "string")
			return commandActivityTitle(input.command);
		const detail = input.path ?? input.query ?? input.title;
		return typeof detail === "string"
			? `${name} · ${detail.replace(/\s+/g, " ").slice(0, 100)}`
			: name;
	} catch {
		return name;
	}
}

/** Public tool evidence is bounded and never includes credential-shaped fields. */
export function publicToolDetail(
	value: unknown,
	format: "structured" | "output" = "structured",
): string {
	const text =
		typeof value === "string"
			? value
			: (JSON.stringify(
					value,
					(key, entry) =>
						/^(authorization|cookie|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)$/i.test(
							key,
						)
							? "[redacted]"
							: entry,
					2,
				) ?? "No output");
	const safe = redactSecrets(format === "output" ? toolOutputText(text) : text)
		.replace(/\bsk-[\w-]{12,}/g, "[redacted]")
		.replace(/\bAIza[\w-]{20,}/g, "[redacted]")
		.replace(
			/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)["']?\s*[:=]\s*)(["'])(.*?)\2/gi,
			"$1$2[redacted]$2",
		)
		.replace(
			/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)["']?\s*[:=]\s*)(?!["'])[^\s,"'}]+/gi,
			"$1[redacted]",
		);
	return safe.length > 16000
		? `${safe.slice(0, 16000)}\n[Output truncated for display]`
		: safe;
}
