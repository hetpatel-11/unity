import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "#/demo/client-action";
import { Check, ChevronDown, Search, Star } from "lucide-react";
import "./model-picker.css";
import { type ReactNode, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { Switch } from "#/components/ui/switch";
import {
	type AgentProviderId,
	offeredAgentProviders,
} from "#/domain/agent-provider";
import { AUTHOR_LABELS, recentModelGenerations } from "#/domain/browse-models";
import { parseModelRouteId } from "#/domain/model-connection";
import {
	expandModelRuns,
	type ModelRun,
	selectModelRun,
} from "#/domain/parallel-models";
import { authClient } from "#/features/auth/client";
import { AgentProviderMark } from "./agent-provider-mark";
import { ApiModelBrowser } from "./api-model-browser";
import {
	type SessionModel,
	sessionModelsFromListed,
} from "./model-capabilities";
import { getAgentModelCatalog } from "#/demo/catalog-actions";
import {
	favoriteModelKey,
	readModelFavorites,
	writeModelFavorites,
} from "./model-picker-favorites";
import { ModelPickerSettings } from "./model-picker-settings";
import { ModelProviderLogo } from "./model-provider-logo";
import { ModelRunCount } from "./model-run-count";
import { ProviderApiKeyInput } from "./provider-api-key-input";

export function HarnessPicker({
	connectionContent,
	harnessId,
	onHarnessIdChange,
	models,
	modelId,
	onModelIdChange,
	modelsEnabled,
	onConnect,
	catalogStatus = "ready",
	providerConnected = false,
	reasoningId = "",
	onReasoningIdChange,
	fast = false,
	onFastChange,
	parallelAvailable = false,
	multipleModels = false,
	modelRuns = [],
	onMultipleModelsChange,
	onModelRunsChange,
}: {
	connectionContent?: ReactNode;
	harnessId: AgentProviderId;
	onHarnessIdChange: (id: AgentProviderId) => void;
	models: readonly SessionModel[];
	modelId: string;
	onModelIdChange: (id: string) => void;
	modelsEnabled: boolean;
	onConnect?: () => void;
	catalogStatus?: "loading" | "error" | "ready";
	providerConnected?: boolean;
	reasoningId?: string;
	onReasoningIdChange?: (id: string) => void;
	fast?: boolean;
	onFastChange?: (value: boolean) => void;
	parallelAvailable?: boolean;
	multipleModels?: boolean;
	modelRuns?: readonly ModelRun[];
	onMultipleModelsChange?: (enabled: boolean) => void;
	onModelRunsChange?: (runs: ModelRun[]) => void;
}) {
	const options = offeredAgentProviders();
	const selected =
		options.find((option) => option.id === harnessId) ?? options[0];
	const [open, setOpen] = useState(false);
	const [browse, setBrowse] = useState(
		harnessId === "api" || harnessId === "claude",
	);
	const [apiProvider, setApiProvider] = useState(
		harnessId === "claude" ? "anthropic" : "openai",
	);
	const [search, setSearch] = useState("");
	const [favoritesOnly, setFavoritesOnly] = useState(false);
	const [favorites, setFavorites] = useState<readonly string[]>([]);
	const searching = Boolean(search.trim());
	const model = models.find((candidate) => candidate.id === modelId);
	const runCount = expandModelRuns(modelRuns).length;
	function chooseModel(id: string) {
		if (multipleModels) {
			onModelRunsChange?.(selectModelRun(modelRuns, id));
			return;
		}
		onModelIdChange(id);
		setOpen(false);
	}
	const visibleModels = recentModelGenerations(models).filter(
		(candidate) =>
			candidate.label.toLowerCase().includes(search.trim().toLowerCase()) &&
			(!favoritesOnly ||
				favorites.includes(favoriteModelKey(harnessId, candidate.id))),
	);
	if (!selected) return null;

	function toggleFavorite(id: string) {
		const key = favoriteModelKey(harnessId, id);
		const next = favorites.includes(key)
			? favorites.filter((value) => value !== key)
			: [...favorites, key];
		setFavorites(next);
		writeModelFavorites(next);
	}

	return (
		<Popover
			open={open}
			onOpenChange={(value) => {
				setOpen(value);
				if (value) {
					setFavorites(readModelFavorites());
					setSearch("");
				}
			}}
		>
			<PopoverTrigger
				id="session-harness-select"
				className="composer-select harness-select"
				aria-label="Model"
				title={
					multipleModels
						? `${modelRuns.length} models · ${runCount} runs`
						: `${selected.name}${model ? ` · ${model.label}` : ""}`
				}
			>
				{harnessId === "api" ? (
					<ModelProviderLogo
						provider={
							parseModelRouteId(modelId)?.modelId.split("/")[0] ?? "openrouter"
						}
						size={16}
					/>
				) : (
					<AgentProviderMark provider={selected.id} size={16} />
				)}
				<span>
					{multipleModels && modelRuns.length > 1
						? `${modelRuns.length} models · ${runCount} runs`
						: `${model?.label ?? "Select model"}${multipleModels && runCount > 1 ? ` · ${runCount} runs` : ""}`}
				</span>
				<ChevronDown className="size-3" />
			</PopoverTrigger>
			<PopoverContent
				collisionPadding={12}
				side="top"
				align="start"
				className="harness-picker"
				aria-label="Choose model"
			>
				<label className="model-picker-search">
					<Search size={16} aria-hidden="true" />
					<input
						aria-label="Search models"
						placeholder="Search models"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</label>
				{parallelAvailable ? (
					<div className="model-picker-multiple">
						<div>
							<strong>Use multiple models</strong>
							<p>
								Independent attempts at one task. A judge compares results. Up
								to five runs use more compute.
							</p>
						</div>
						<Switch
							aria-label="Use multiple models for independent attempts"
							checked={multipleModels}
							disabled={!modelId}
							onCheckedChange={onMultipleModelsChange}
						/>
					</div>
				) : null}
				{model && !multipleModels ? (
					<ModelPickerSettings
						model={model}
						reasoningId={reasoningId}
						onReasoningIdChange={onReasoningIdChange}
						fast={fast}
						onFastChange={onFastChange}
					/>
				) : null}
				<div className="model-picker-body">
					<nav className="model-provider-rail" aria-label="Model providers">
						<button
							type="button"
							aria-label={`Favorites in ${selected.name}`}
							title={`Favorites in ${selected.name}`}
							aria-pressed={favoritesOnly}
							onClick={() => {
								setBrowse(false);
								setFavoritesOnly(!favoritesOnly);
							}}
						>
							<Star size={19} />
						</button>
						{options
							.filter((option) => option.id === "codex")
							.map((option) => (
								<button
									key={option.id}
									className="model-provider-subscription"
									type="button"
									title={`${option.name} · ChatGPT subscription`}
									aria-label={option.name}
									aria-pressed={
										!browse && !favoritesOnly && harnessId === option.id
									}
									onClick={() => {
										setFavoritesOnly(false);
										setBrowse(false);
										setSearch("");
										if (option.id !== harnessId) onHarnessIdChange(option.id);
									}}
								>
									<AgentProviderMark provider={option.id} size={21} />
								</button>
							))}
						{Object.entries(AUTHOR_LABELS).map(([id, label]) => (
							<button
								type="button"
								key={id}
								title={label}
								aria-label={label}
								aria-pressed={browse && apiProvider === id}
								onClick={() => {
									if (harnessId !== "api" && multipleModels)
										onMultipleModelsChange?.(false);
									setBrowse(true);
									setApiProvider(id);
									setFavoritesOnly(false);
									setSearch("");
								}}
							>
								<ModelProviderLogo provider={id} size={21} />
							</button>
						))}
					</nav>
					<section
						className="model-picker-catalog"
						aria-label={
							searching
								? "Search all models"
								: browse
									? (AUTHOR_LABELS[apiProvider] ?? "OpenRouter")
									: selected.name
						}
					>
						{searching ? (
							<>
								<CodexModelSearch
									search={search}
									fallbackModels={harnessId === "codex" ? models : []}
									onSelect={(id) => {
										if (multipleModels && harnessId !== "codex")
											onMultipleModelsChange?.(false);
										if (harnessId !== "codex") onHarnessIdChange("codex");
										onModelIdChange(id);
										setOpen(false);
									}}
								/>
								<ApiModelBrowser
									author={null}
									search={search}
									onBrowseProvider={(author) => {
										setApiProvider(author);
										setBrowse(true);
										setSearch("");
									}}
									selectedRoute={modelId}
									onSelect={(id) => {
										if (harnessId !== "api") {
											if (multipleModels) onMultipleModelsChange?.(false);
											onHarnessIdChange("api");
										}
										onModelIdChange(id);
										setOpen(false);
									}}
								/>
							</>
						) : browse ? (
							<ApiModelBrowser
								key={apiProvider}
								author={apiProvider}
								search={search}
								selectedRoute={modelId}
								onSelect={(id) => {
									if (harnessId !== "api") {
										onHarnessIdChange("api");
										onModelIdChange(id);
										setOpen(false);
									} else chooseModel(id);
								}}
								multipleModels={multipleModels && harnessId === "api"}
								modelRuns={modelRuns}
								onModelRunsChange={onModelRunsChange}
							/>
						) : (
							<>
								<h3>
									{favoritesOnly
										? `Favorites · ${selected.name}`
										: selected.name}
								</h3>
								{harnessId === "codex" ? (
									<p className="model-browser-caption">ChatGPT subscription</p>
								) : null}
								<div className="model-picker-list">
									{harnessId === "claude" ? (
										<ProviderApiKeyInput onSaved={onConnect} />
									) : (
										connectionContent
									)}
									{visibleModels.map((candidate) => {
										const favorite = favorites.includes(
											favoriteModelKey(harnessId, candidate.id),
										);
										const selectedRun = modelRuns.find(
											(run) => run.modelId === candidate.id,
										);
										return (
											<div
												className="model-picker-row"
												key={candidate.id}
												data-selected={
													multipleModels
														? Boolean(selectedRun)
														: candidate.id === modelId
												}
											>
												<button
													type="button"
													className="model-picker-option"
													disabled={!modelsEnabled}
													aria-pressed={
														multipleModels
															? Boolean(selectedRun)
															: candidate.id === modelId
													}
													title={candidate.notice ?? candidate.label}
													onClick={() => {
														chooseModel(candidate.id);
													}}
												>
													{multipleModels ? (
														<span
															className="model-run-check"
															aria-hidden="true"
														>
															{selectedRun ? (
																<Check size={12} strokeWidth={2.4} />
															) : null}
														</span>
													) : (
														<AgentProviderMark provider={harnessId} size={18} />
													)}
													<span>{candidate.label}</span>
													{!multipleModels && candidate.id === modelId ? (
														<Check size={14} aria-hidden="true" />
													) : null}
												</button>
												{multipleModels && selectedRun ? (
													<ModelRunCount
														modelId={candidate.id}
														modelLabel={candidate.label}
														runs={modelRuns}
														onChange={(runs) => onModelRunsChange?.(runs)}
													/>
												) : null}
												<button
													type="button"
													className="model-favorite"
													aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${candidate.label}`}
													aria-pressed={favorite}
													onClick={() => toggleFavorite(candidate.id)}
												>
													<Star
														size={15}
														fill={favorite ? "currentColor" : "none"}
													/>
												</button>
											</div>
										);
									})}
									{visibleModels.length === 0 && models.length > 0 ? (
										<p className="model-picker-status" role="status">
											{search.trim()
												? "No matching models"
												: "No favorites for this provider yet"}
										</p>
									) : null}
									{models.length === 0 && harnessId !== "claude" ? (
										<div aria-busy={catalogStatus === "loading"}>
											<p className="model-picker-status" role="status">
												{catalogStatus === "loading"
													? "Fetching available models…"
													: catalogStatus === "error"
														? "Could not load saved models"
														: providerConnected
															? "No saved model list yet"
															: "Connect this provider once to discover its models"}
											</p>
											{onConnect && catalogStatus !== "loading" ? (
												<button
													type="button"
													className="model-picker-connect"
													onClick={() => {
														onConnect();
													}}
												>
													{catalogStatus === "error"
														? "Retry"
														: providerConnected
															? "Refresh models"
															: "Connect provider"}
												</button>
											) : null}
										</div>
									) : null}
								</div>
							</>
						)}
					</section>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function CodexModelSearch({
	search,
	fallbackModels,
	onSelect,
}: {
	search: string;
	fallbackModels: readonly SessionModel[];
	onSelect: (id: string) => void;
}) {
	const identity = authClient.useSession();
	const loadCatalog = useServerFn(getAgentModelCatalog);
	const catalog = useQuery({
		queryKey: ["agent-model-catalog", identity.data?.user.id, "codex"],
		enabled: Boolean(identity.data?.user.id),
		queryFn: () => loadCatalog({ data: { provider: "codex" } }),
		staleTime: 60_000,
	});
	const models = catalog.data
		? sessionModelsFromListed(catalog.data)
		: fallbackModels;
	const results = models.filter(
		(model) =>
			model.label.toLowerCase().includes(search.trim().toLowerCase()) ||
			"codex".includes(search.trim().toLowerCase()),
	);
	if (!results.length) return null;
	return (
		<>
			<h3>Codex · ChatGPT subscription</h3>
			{results.map((model) => (
				<button
					type="button"
					className="model-browser-option"
					key={model.id}
					onClick={() => onSelect(model.id)}
				>
					<AgentProviderMark provider="codex" size={18} />
					<span>{model.label}</span>
				</button>
			))}
		</>
	);
}
