import type { BundledLanguage } from "shiki";
import { bundledLanguagesInfo } from "shiki/langs";
import { fileBasename } from "./file-kind";

export type SourceLanguage = BundledLanguage | "text";
const languageIds = new Map<string, BundledLanguage>(
	bundledLanguagesInfo.flatMap((language) =>
		[language.id, ...(language.aliases ?? [])].map(
			(alias) => [alias, language.id as BundledLanguage] as const,
		),
	),
);
const fileExtensions: Record<string, string> = {
	py: "python",
	rs: "rust",
	sh: "shellscript",
	yml: "yaml",
	md: "markdown",
	mts: "typescript",
	cts: "typescript",
	mjs: "javascript",
	cjs: "javascript",
};
export function sourceLanguageFromPath(path: string): SourceLanguage {
	const name = fileBasename(path).toLowerCase();
	if (name === "dockerfile") return "dockerfile";
	if (name === "makefile") return "makefile";
	const extension = name.includes(".") ? (name.split(".").at(-1) ?? "") : "";
	return sourceLanguageFromFence(fileExtensions[extension] ?? extension);
}
export function sourceLanguageFromFence(tag: string | null): SourceLanguage {
	return (
		languageIds.get(tag?.trim().split(/\s+/)[0]?.toLowerCase() ?? "") ?? "text"
	);
}
