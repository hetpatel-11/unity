import { Brain, Zap } from "lucide-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Toggle } from "#/components/ui/toggle";
import {
	reasoningLevelLabel,
	resolveReasoningLevel,
	type SessionModel,
} from "./model-capabilities";

export function ModelPickerSettings({
	model,
	reasoningId,
	onReasoningIdChange,
	fast,
	onFastChange,
}: {
	model: SessionModel;
	reasoningId: string;
	onReasoningIdChange?: (id: string) => void;
	fast: boolean;
	onFastChange?: (value: boolean) => void;
}) {
	const reasoning = resolveReasoningLevel(model, reasoningId);
	return (
		<div className="model-picker-settings">
			<p className="model-picker-current">{model.label}</p>
			{model.reasoning && onReasoningIdChange ? (
				<div className="model-picker-setting">
					<Brain size={17} aria-hidden="true" />
					<span>Reasoning</span>
					<Select
						value={reasoning?.id ?? ""}
						onValueChange={onReasoningIdChange}
					>
						<SelectTrigger
							className="model-reasoning-select"
							aria-label="Reasoning level"
						>
							<SelectValue>
								{reasoning ? reasoningLevelLabel(reasoning.id) : null}
							</SelectValue>
						</SelectTrigger>
						<SelectContent position="popper" side="right">
							{model.reasoning.levels.map((option) => (
								<SelectItem
									key={option.id}
									value={option.id}
									textValue={reasoningLevelLabel(option.id)}
								>
									{reasoningLevelLabel(option.id)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			) : null}
			{model.supportsFastMode && onFastChange ? (
				<div className="model-picker-setting">
					<Zap size={17} aria-hidden="true" />
					<span>Fast mode</span>
					<Toggle
						aria-label="Fast mode"
						pressed={fast}
						onPressedChange={onFastChange}
					>
						{fast ? "On" : "Off"}
					</Toggle>
				</div>
			) : null}
		</div>
	);
}
