import type { BrowseModel } from "#/domain/browse-models";
import type { PublicModelConnection } from "#/domain/model-connection";
export async function getBrowseModels(): Promise<BrowseModel[]> {
	return [];
}
export async function getModelConnections(): Promise<PublicModelConnection[]> {
	return [];
}
export async function saveModelConnectionFn(_input: {
	data: unknown;
}): Promise<PublicModelConnection[]> {
	throw new Error(
		"Provider connections require a backend. No credentials were saved.",
	);
}
