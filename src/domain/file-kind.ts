import setiFileIcons from "./seti-file-icons.json";

export type FileKind =
	| "typescript"
	| "tsx"
	| "javascript"
	| "jsx"
	| "json"
	| "markdown"
	| "css"
	| "html"
	| "python"
	| "yaml"
	| "shell"
	| "rust"
	| "go"
	| "toml"
	| "svg"
	| "image"
	| "lock"
	| "config"
	| "test"
	| "unknown";

const EXTENSION_KIND: Record<string, FileKind> = {
	ts: "typescript",
	mts: "typescript",
	cts: "typescript",
	tsx: "tsx",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsx: "jsx",
	json: "json",
	md: "markdown",
	mdx: "markdown",
	css: "css",
	scss: "css",
	sass: "css",
	less: "css",
	html: "html",
	htm: "html",
	py: "python",
	yml: "yaml",
	yaml: "yaml",
	sh: "shell",
	bash: "shell",
	zsh: "shell",
	rs: "rust",
	go: "go",
	toml: "toml",
	svg: "svg",
	png: "image",
	jpg: "image",
	jpeg: "image",
	gif: "image",
	webp: "image",
	ico: "image",
	lock: "lock",
};

const BASENAME_KIND: Record<string, FileKind> = {
	dockerfile: "config",
	makefile: "config",
	license: "markdown",
	".gitignore": "config",
	".npmrc": "config",
	".nvmrc": "config",
	"package.json": "json",
	"tsconfig.json": "json",
	"pnpm-lock.yaml": "lock",
	"package-lock.json": "lock",
	"bun.lock": "lock",
	"cargo.lock": "lock",
	"yarn.lock": "lock",
};

export function fileBasename(path: string): string {
	const trimmed = path.replace(/\\/g, "/");
	const parts = trimmed.split("/");
	return parts[parts.length - 1] ?? path;
}

export function fileTypeIconName(path: string): string {
	const basename = fileBasename(path).toLowerCase();
	const names: Record<string, string> = setiFileIcons.fileNames;
	const extensions: Record<string, string> = setiFileIcons.fileExtensions;
	if (names[basename]) return names[basename];
	const parts = basename.split(".");
	for (let index = 1; index < parts.length; index += 1) {
		const icon = extensions[parts.slice(index).join(".")];
		if (icon) return icon;
	}
	const languages: Record<string, string> = setiFileIcons.languageIds;
	const kind = EXTENSION_KIND[parts.at(-1) ?? ""];
	const language =
		kind === "tsx"
			? "typescriptreact"
			: kind === "jsx"
				? "javascriptreact"
				: kind === "shell"
					? "shellscript"
					: kind;
	return (language ? languages[language] : undefined) ?? setiFileIcons.file;
}

export function fileKindFromPath(path: string): FileKind {
	const basename = fileBasename(path);
	const lower = basename.toLowerCase();
	if (
		/\.(?:test|spec)\.[^.]+$/i.test(basename) ||
		path.includes("/__tests__/")
	) {
		return "test";
	}
	const named = BASENAME_KIND[lower];
	if (named) return named;
	const dot = lower.lastIndexOf(".");
	if (dot <= 0) return "unknown";
	return EXTENSION_KIND[lower.slice(dot + 1)] ?? "unknown";
}

export function fileKindBadge(kind: FileKind): string {
	switch (kind) {
		case "typescript":
			return "TS";
		case "tsx":
			return "TX";
		case "javascript":
			return "JS";
		case "jsx":
			return "JX";
		case "json":
			return "{}";
		case "markdown":
			return "MD";
		case "css":
			return "CSS";
		case "html":
			return "<>";
		case "python":
			return "PY";
		case "yaml":
			return "YML";
		case "shell":
			return ">_";
		case "rust":
			return "RS";
		case "go":
			return "GO";
		case "toml":
			return "TM";
		case "svg":
			return "SVG";
		case "image":
			return "IMG";
		case "lock":
			return "LCK";
		case "config":
			return "CFG";
		case "test":
			return "TST";
		case "unknown":
			return "";
	}
}
