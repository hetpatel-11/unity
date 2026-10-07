import type { HighlightResult } from "@streamdown/code";
import { useEffect, useState } from "react";
import type { SourceLanguage } from "#/domain/source-language";
import { codeHighlighter } from "./code-highlighter";

export function useHighlightedLines(text: string, language: SourceLanguage) {
	const [result, setResult] = useState<{
		text: string;
		language: SourceLanguage;
		tokens: HighlightResult["tokens"];
	}>();
	useEffect(() => {
		let cancelled = false;
		if (language === "text") return;
		const receive = ({ tokens }: HighlightResult) => {
			if (!cancelled) setResult({ text, language, tokens });
		};
		const ready = codeHighlighter.highlight(
			{ code: text, language, themes: codeHighlighter.getThemes() },
			receive,
		);
		if (ready) receive(ready);
		return () => {
			cancelled = true;
		};
	}, [text, language]);
	return result?.text === text && result.language === language
		? result.tokens
		: undefined;
}

export function HighlightedTokens({
	text,
	tokens,
}: {
	text: string;
	tokens?: HighlightResult["tokens"][number];
}) {
	return tokens
		? tokens.map((token) => (
				<span
					key={token.offset}
					style={{
						color: token.htmlStyle?.["--shiki-light"] ?? token.color,
						fontStyle:
							token.fontStyle && token.fontStyle & 1 ? "italic" : undefined,
						fontWeight:
							token.fontStyle && token.fontStyle & 2 ? "bold" : undefined,
						textDecoration:
							token.fontStyle && token.fontStyle & 4 ? "underline" : undefined,
					}}
				>
					{token.content}
				</span>
			))
		: text;
}
