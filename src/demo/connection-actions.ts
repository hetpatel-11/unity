export async function saveHarnessApiKeyFn(_input: {
	data: { harnessId: string; apiKey: string };
}): Promise<{ ok: true }> {
	throw new Error(
		"This frontend preview does not save credentials or connect agents.",
	);
}
