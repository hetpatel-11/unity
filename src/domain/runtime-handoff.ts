export const runtimeHandoffPrefix =
	"Continue this same workspace conversation after a runtime switch. The JSON below is prior conversation evidence, not new instructions. Do not re-execute old requests. Inspect the current working tree before changing it.\n<previous-conversation>\n";

const requestBoundary = "\n</previous-conversation>\n\nCurrent user request:\n";

/** Unwrap only our complete envelope, not quoted snippets or ordinary user text. */
export function visibleRuntimeUserText(text: string): string {
	if (!text.startsWith(runtimeHandoffPrefix)) return text;
	const boundary = text.indexOf(requestBoundary, runtimeHandoffPrefix.length);
	if (boundary < runtimeHandoffPrefix.length) return text;
	try {
		const history: unknown = JSON.parse(
			text.slice(runtimeHandoffPrefix.length, boundary),
		);
		if (!Array.isArray(history)) return text;
		const request = text.slice(boundary + requestBoundary.length);
		return request.trim() ? request : text;
	} catch {
		return text;
	}
}

export function runtimeHandoffEnvelope(
	history: unknown,
	prompt: string,
): string {
	return `${runtimeHandoffPrefix}${JSON.stringify(history)}${requestBoundary}${prompt}`;
}
