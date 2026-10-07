export type FilePreviewKind = "markdown" | "svg" | "image" | "code";

export type WorkspaceFilePreview =
	| { kind: "text"; text: string }
	| { kind: "image"; dataUrl: string }
	| { kind: "unavailable"; reason: string };

export function filePreviewKind(path: string): FilePreviewKind {
	if (/\.(md|markdown|mdx)$/i.test(path)) return "markdown";
	if (/\.svg$/i.test(path)) return "svg";
	if (/\.(png|jpe?g|gif|webp|ico|avif)$/i.test(path)) return "image";
	return "code";
}
