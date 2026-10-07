import { useServerFn } from "#/demo/client-action";
import { useState } from "react";
import { saveHarnessApiKeyFn } from "#/demo/connection-actions";

export function ProviderApiKeyInput({ onSaved }: { onSaved?: () => void }) {
	const save = useServerFn(saveHarnessApiKeyFn);
	const [key, setKey] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(false);
	return (
		<form
			className="model-key-form"
			onSubmit={async (event) => {
				event.preventDefault();
				if (!key.trim() || saving) return;
				setSaving(true);
				setError(false);
				try {
					await save({ data: { harnessId: "claude", apiKey: key.trim() } });
					setKey("");
					onSaved?.();
				} catch {
					setError(true);
				} finally {
					setSaving(false);
				}
			}}
		>
			<label>
				<span>Anthropic API key</span>
				<input
					type="password"
					aria-label="Anthropic API key"
					placeholder="Paste API key"
					autoComplete="off"
					spellCheck={false}
					value={key}
					disabled={saving}
					onChange={(event) => setKey(event.target.value)}
				/>
			</label>
			<button type="submit" disabled={!key.trim() || saving}>
				{saving ? "Saving…" : "Save and connect"}
			</button>
			{error ? (
				<p role="alert">Could not save the key. Please try again.</p>
			) : null}
		</form>
	);
}
