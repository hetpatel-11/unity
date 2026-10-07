import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	availableModelRunCounts,
	type ModelRun,
	setModelRunCount,
} from "#/domain/parallel-models";

export function ModelRunCount({
	modelId,
	modelLabel,
	runs,
	onChange,
}: {
	modelId: string;
	modelLabel: string;
	runs: readonly ModelRun[];
	onChange: (runs: ModelRun[]) => void;
}) {
	const count = runs.find((run) => run.modelId === modelId)?.count;
	if (!count) return null;

	return (
		<Select
			value={String(count)}
			onValueChange={(value) =>
				onChange(setModelRunCount(runs, modelId, Number(value)))
			}
		>
			<SelectTrigger
				size="sm"
				className="model-run-trigger"
				aria-label={`Runs for ${modelLabel}`}
			>
				<SelectValue>
					{count} {count === 1 ? "run" : "runs"}
				</SelectValue>
			</SelectTrigger>
			<SelectContent
				position="popper"
				side="bottom"
				align="end"
				className="model-run-menu"
			>
				{availableModelRunCounts(runs, modelId).map((option) => (
					<SelectItem
						key={option}
						value={String(option)}
						textValue={`${option} ${option === 1 ? "run" : "runs"}`}
					>
						{option} {option === 1 ? "run" : "runs"}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
