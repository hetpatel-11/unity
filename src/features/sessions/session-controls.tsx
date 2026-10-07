import { Paperclip } from "lucide-react";
import { type ReactNode, useRef } from "react";
import type { AgentProviderId } from "#/domain/agent-provider";
import type { ModelRun } from "#/domain/parallel-models";
import { HarnessPicker } from "./harness-picker";
import type { SessionModel } from "./model-capabilities";

interface SessionControlsProps {
	contextIndicator?: ReactNode;
	connectionContent?: ReactNode;
	harnessId: AgentProviderId;
	onHarnessIdChange: (id: AgentProviderId) => void;
	models: readonly SessionModel[];
	modelId: string;
	onModelIdChange: (id: string) => void;
	onAttachFiles: (files: File[]) => void;
	listedModelId?: string;
	reasoningId: string;
	onReasoningIdChange: (id: string) => void;
	fast: boolean;
	onFastChange: (fast: boolean) => void;
	onConnect: () => void;
	catalogStatus: "loading" | "error" | "ready";
	providerConnected: boolean;
	parallelAvailable: boolean;
	multipleModels: boolean;
	modelRuns: readonly ModelRun[];
	onMultipleModelsChange: (enabled: boolean) => void;
	onModelRunsChange: (runs: ModelRun[]) => void;
}

export function SessionControls({
	contextIndicator,
	connectionContent,
	harnessId,
	onHarnessIdChange,
	models,
	modelId,
	onModelIdChange,
	onAttachFiles,
	listedModelId = "",
	reasoningId,
	onReasoningIdChange,
	fast,
	onFastChange,
	onConnect,
	catalogStatus,
	providerConnected,
	parallelAvailable,
	multipleModels,
	modelRuns,
	onMultipleModelsChange,
	onModelRunsChange,
}: SessionControlsProps) {
	const fileInput = useRef<HTMLInputElement>(null);
	const model = models.find((candidate) => candidate.id === modelId);
	const selectedModelId =
		model?.id ??
		models.find((candidate) => candidate.id === listedModelId)?.id ??
		"";
	return (
		<div className="session-controls">
			<input
				ref={fileInput}
				type="file"
				multiple
				hidden
				onChange={(event) => {
					onAttachFiles(Array.from(event.currentTarget.files ?? []));
					event.currentTarget.value = "";
				}}
			/>
			<button
				type="button"
				className="composer-control attachment-control"
				aria-label="Attach files"
				title="Attach files"
				onClick={() => fileInput.current?.click()}
			>
				<Paperclip className="size-4" />
			</button>
			<div className="composer-model-controls">
				<HarnessPicker
					connectionContent={connectionContent}
					harnessId={harnessId}
					models={models}
					modelId={selectedModelId}
					modelsEnabled={models.length > 0}
					onConnect={onConnect}
					catalogStatus={catalogStatus}
					providerConnected={providerConnected}
					parallelAvailable={parallelAvailable}
					multipleModels={multipleModels}
					modelRuns={modelRuns}
					onMultipleModelsChange={onMultipleModelsChange}
					onModelRunsChange={onModelRunsChange}
					reasoningId={reasoningId}
					onReasoningIdChange={onReasoningIdChange}
					fast={fast}
					onFastChange={onFastChange}
					onModelIdChange={(id) => {
						onModelIdChange(id);
						onReasoningIdChange("");
						onFastChange(false);
					}}
					onHarnessIdChange={(id) => {
						onMultipleModelsChange(false);
						onHarnessIdChange(id);
						onModelIdChange("");
						onReasoningIdChange("");
						onFastChange(false);
					}}
				/>
				{contextIndicator}
			</div>
		</div>
	);
}
