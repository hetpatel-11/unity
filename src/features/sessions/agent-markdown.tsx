import { Children, isValidElement, type ReactNode, useMemo } from "react";
import "streamdown/styles.css";
import {
	CodeBlock,
	type Components,
	defaultRehypePlugins,
	defaultUrlTransform,
	Streamdown,
} from "streamdown";
import type { FileChangeEntry } from "#/domain/session-item";
import { workspaceFileMention } from "#/domain/workspace-file-mention";
import { codeHighlighter } from "./code-highlighter";
import { FileMentionButton, mentionedFileChange } from "./file-mention";

// Workspace-relative links use our IDE handler; keep sanitization and apply
// the link/image policy below instead of harden's web-only URL resolution.
const markdownPlugins = [
	defaultRehypePlugins.raw,
	defaultRehypePlugins.sanitize,
];

export function AgentMarkdown({
	text,
	streaming = false,
	fileChanges = [],
	onOpenFile,
}: {
	text: string;
	streaming?: boolean;
	fileChanges?: readonly FileChangeEntry[];
	onOpenFile?: (path: string) => void;
}) {
	const components = useMemo<Components>(() => {
		function fileLink(path: string, label: string) {
			const change = mentionedFileChange(path, fileChanges);
			return (
				<FileMentionButton
					path={change?.path ?? path}
					name={label}
					onOpenFile={onOpenFile}
				/>
			);
		}
		return {
			a: ({ href, children }) => {
				const file = workspaceFileMention(href ?? "");
				if (file)
					return fileLink(file, typeof children === "string" ? children : file);
				const safe = safeExternalLink(href);
				return safe ? (
					<a href={safe} target="_blank" rel="noopener noreferrer">
						{children}
					</a>
				) : (
					<span>{children}</span>
				);
			},
			code: (props) => {
				const { children, className } = props;
				const text = markdownChildText(children);
				if (!("data-block" in props)) {
					const file = workspaceFileMention(text);
					return file ? fileLink(file, text) : <code>{children}</code>;
				}
				return (
					<CodeBlock
						code={text}
						lineNumbers={false}
						language={className?.replace(/^language-/, "") ?? "text"}
					/>
				);
			},
			img: ({ src, alt }) => {
				const safe = safeExternalLink(
					typeof src === "string" ? src : undefined,
				);
				return safe ? (
					<a href={safe} target="_blank" rel="noopener noreferrer">
						{alt || "View image"}
					</a>
				) : (
					<span>{alt || "Image"}</span>
				);
			},
		};
	}, [fileChanges, onOpenFile]);
	return (
		<Streamdown
			className="session-markdown"
			mode={streaming ? "streaming" : "static"}
			isAnimating={streaming}
			animated={streaming}
			components={components}
			plugins={{ code: codeHighlighter }}
			rehypePlugins={markdownPlugins}
			controls={false}
			skipHtml
			urlTransform={defaultUrlTransform}
		>
			{text}
		</Streamdown>
	);
}

function safeExternalLink(href: string | undefined) {
	return href && /^(https?:\/\/|mailto:|#)/i.test(href) ? href : null;
}

function markdownChildText(children: ReactNode): string {
	return Children.toArray(children)
		.map((child) =>
			typeof child === "string" || typeof child === "number"
				? String(child)
				: isValidElement<{ children?: ReactNode }>(child)
					? markdownChildText(child.props.children)
					: "",
		)
		.join("");
}
