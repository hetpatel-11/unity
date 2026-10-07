export async function getConversationRecoveryPoints(_input: {
	data: { projectId: string; sessionId: string };
}): Promise<{ messageId: string; codeAvailable: boolean }[]> {
	return [];
}
export async function restoreConversationPoint(_input: {
	data: {
		projectId: string;
		sessionId: string;
		messageId: string;
		mode: string;
	};
}): Promise<{ id: string; prompt: string | null }> {
	throw new Error("Recovery requires a connected backend.");
}
