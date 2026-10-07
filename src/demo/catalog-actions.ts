import type { ListedModel } from "#/domain/listed-model";
export const previewModels: ListedModel[] = [
	{ id: "unity-preview", label: "Frontend preview" },
];
export async function getAgentModelCatalog(_input: {
	data: { provider: string };
}) {
	return previewModels;
}
