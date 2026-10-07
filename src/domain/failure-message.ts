const GENERIC_EFFECT_PROMISE_FAILURE =
	"An unknown error occurred in Effect.tryPromise";

export function failureMessage(cause: unknown): string {
	const message = unwrapFailureMessage(cause, new Set());
	return message || "Something went wrong.";
}

export function workspaceLooksGone(message: string): boolean {
	if (/codex binary not found/i.test(message)) return false;
	return /not found|404|does not exist|unknown vm|no such (?:workspace|vm|machine)|deleted/i.test(
		message,
	);
}

export function isWorkspaceAtCapacity(message: string) {
	return /LIMIT_EXCEEDED|limit of \d+ VMs|at its VM limit|at its limit|Pausing a VM does not free a slot|Pausing does not free a slot/i.test(
		message,
	);
}

export function isWorkspaceComputeAllowanceExhausted(message: string) {
	return /allowance for vcpu_time|memory_time has been used|compute allowance|vCPU-hour allowance/i.test(
		message,
	);
}

function unwrapFailureMessage(cause: unknown, seen: Set<unknown>): string {
	if (cause == null) return "";
	if (typeof cause === "string") {
		const text = cause.trim();
		return text === GENERIC_EFFECT_PROMISE_FAILURE ? "" : text;
	}
	if (typeof cause !== "object") return "";
	if (seen.has(cause)) return "";
	seen.add(cause);
	const record = cause as {
		error?: unknown;
		cause?: unknown;
		message?: unknown;
	};
	const nested = unwrapFailureMessage(record.error, seen);
	if (nested) return nested;
	const innerCause = unwrapFailureMessage(record.cause, seen);
	if (innerCause) return innerCause;
	if (typeof record.message === "string") {
		const text = record.message.trim();
		if (text && text !== GENERIC_EFFECT_PROMISE_FAILURE) return text;
	}
	return "";
}
