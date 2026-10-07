import { z } from "zod";

export const parallelAttemptModelIds = z.array(z.string().min(1)).min(2).max(5);

export type ModelRun = { modelId: string; count: number };

export function expandModelRuns(runs: readonly ModelRun[]): string[] {
	return runs.flatMap(({ modelId, count }) =>
		Array.from({ length: count }, () => modelId),
	);
}

export function selectModelRun(
	runs: readonly ModelRun[],
	modelId: string,
): ModelRun[] {
	if (runs.some((run) => run.modelId === modelId)) {
		return runs.length > 1
			? runs
					.filter((run) => run.modelId !== modelId)
					.map((run, _, remaining) =>
						remaining.length === 1 && run.count === 1
							? { ...run, count: 2 }
							: run,
					)
			: [...runs];
	}
	return expandModelRuns(runs).length < 5
		? [...runs, { modelId, count: 1 }]
		: [...runs];
}

export function setModelRunCount(
	runs: readonly ModelRun[],
	modelId: string,
	count: number,
): ModelRun[] {
	if (!Number.isInteger(count) || count < 1) return [...runs];
	const otherCount = otherModelRunCount(runs, modelId);
	if (otherCount + count > 5 || otherCount + count < 2) return [...runs];
	return runs.map((run) => (run.modelId === modelId ? { ...run, count } : run));
}

export function availableModelRunCounts(
	runs: readonly ModelRun[],
	modelId: string,
): number[] {
	const otherCount = otherModelRunCount(runs, modelId);
	return [1, 2, 3, 4, 5].filter(
		(count) => otherCount + count >= 2 && otherCount + count <= 5,
	);
}

function otherModelRunCount(runs: readonly ModelRun[], modelId: string) {
	return runs.reduce(
		(total, run) => total + (run.modelId === modelId ? 0 : run.count),
		0,
	);
}
