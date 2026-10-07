import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import CodeMirror, { EditorView, type Extension } from "@uiw/react-codemirror";
import { useEffect, useMemo, useState } from "react";
import { fileEditorSaveHotkey } from "#/domain/workspace-explorer";

const editorTheme = EditorView.theme({
	"&": { backgroundColor: "#ffffff", color: "#27272a", height: "100%" },
	".cm-scroller": {
		fontFamily: "var(--font-mono, monospace)",
		overflow: "auto",
	},
	".cm-gutters": { backgroundColor: "transparent", border: "none" },
	".cm-content": { fontSize: "14px" },
	".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "#18181b08" },
	"&.cm-focused": { outline: "none" },
});
const workspaceEditorTheme = [editorTheme];

export function SourceEditor({
	path,
	value,
	onChange,
	onSave,
}: {
	path: string;
	value: string;
	onChange: (value: string) => void;
	onSave: () => void;
}) {
	const [language, setLanguage] = useState<{
		path: string;
		extension: Extension;
	}>();
	useEffect(() => {
		let cancelled = false;
		const description = LanguageDescription.matchFilename(languages, path);
		void description
			?.load()
			.then((extension) => {
				if (!cancelled) setLanguage({ path, extension });
			})
			.catch(() => {
				/* Plain text remains editable if a grammar fails to load. */
			});
		return () => {
			cancelled = true;
		};
	}, [path]);
	const extensions = useMemo(
		() => [
			EditorView.contentAttributes.of({ "aria-label": path }),
			...(language?.path === path ? [language.extension] : []),
		],
		[language, path],
	);
	return (
		<div
			className="source-editor"
			onKeyDownCapture={(event) => {
				if (fileEditorSaveHotkey(event)) {
					event.preventDefault();
					onSave();
				}
			}}
		>
			<CodeMirror
				key={path}
				value={value}
				onChange={onChange}
				theme={workspaceEditorTheme}
				extensions={extensions}
				height="100%"
				indentWithTab={false}
			/>
		</div>
	);
}
