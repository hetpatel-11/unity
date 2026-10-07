import {
	Brain,
	FilePenLine,
	Files,
	FileText,
	Globe,
	ListChecks,
	Plug,
	Search,
	SquareTerminal,
	TriangleAlert,
	Wrench,
} from "lucide-react";
import type { SessionActivityGlyph } from "#/domain/session-activity";

const icons = {
	thinking: Brain,
	plan: ListChecks,
	shell: SquareTerminal,
	search: Search,
	read: FileText,
	edit: FilePenLine,
	files: Files,
	web: Globe,
	mcp: Plug,
	error: TriangleAlert,
	tool: Wrench,
} as const;

export function ActivityIcon({ glyph }: { glyph: SessionActivityGlyph }) {
	const Icon = icons[glyph];
	return <Icon size={14} strokeWidth={1.5} aria-hidden="true" />;
}
