import {
	AUTHOR_LABELS,
	DIRECT_MODEL_ENDPOINTS,
	directModelProvider,
} from "./browse-models";
import {
	type PublicModelConnection,
	parseModelRouteId,
} from "./model-connection";

export function providerKeyConnection(author: string, apiKey: string) {
	if (apiKey.trim().startsWith("sk-or-"))
		return {
			provider: "openrouter" as const,
			label: "OpenRouter",
			apiKey: apiKey.trim(),
		};
	const provider = directModelProvider(author);
	if (!provider)
		throw new Error(
			"Direct keys for this provider are not supported yet. Use an OpenRouter key.",
		);
	return {
		provider,
		label: AUTHOR_LABELS[author],
		apiKey: apiKey.trim(),
		...(provider === "compatible"
			? { baseUrl: DIRECT_MODEL_ENDPOINTS[author] }
			: {}),
	};
}

export function providerConnections(
	author: string,
	connections: readonly PublicModelConnection[],
) {
	return connections.filter(
		(connection) =>
			connection.provider === "openrouter" ||
			connection.provider === author ||
			(connection.provider === "compatible" &&
				connection.baseUrl === DIRECT_MODEL_ENDPOINTS[author]),
	);
}

export function selectedProviderConnection(
	available: readonly PublicModelConnection[],
	selectedRoute: string,
	chosenConnectionId?: string,
): PublicModelConnection | undefined {
	const routeConnectionId = parseModelRouteId(selectedRoute)?.connectionId;
	return (
		available.find((row) => row.id === chosenConnectionId) ??
		available.find((row) => row.id === routeConnectionId) ??
		available[0]
	);
}
