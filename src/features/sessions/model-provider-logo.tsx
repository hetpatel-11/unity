import { Icon } from "@iconify/react";
import { Box } from "lucide-react";
import { ClaudeMark } from "./claude-mark";
import icons from "./model-provider-icons.json";
import { XaiMark } from "./xai-mark";

// Curated local subset of Simple Icons 1.2.97 (CC0); no remote image requests.
export function ModelProviderLogo({
	provider,
	size = 18,
}: {
	provider: string;
	size?: number;
}) {
	if (provider === "anthropic") return <ClaudeMark size={size} />;
	if (provider === "x-ai") return <XaiMark size={size} />;
	if (provider === "z-ai")
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 30 30"
				fill="currentColor"
				aria-hidden="true"
			>
				<path d="M15.47 7.1l-1.3 1.85c-.2.29-.54.47-.9.47h-7.1V7.09C6.16 7.1 15.47 7.1 15.47 7.1z" />
				<path d="M24.3 7.1L13.14 22.91H5.7L16.86 7.1z" />
				<path d="M14.53 22.91l1.31-1.86c.2-.29.54-.47.9-.47h7.09v2.33z" />
			</svg>
		);
	const key = provider === "google" ? "googlegemini" : provider;
	const icon = icons[key as keyof typeof icons];
	return icon ? (
		<Icon icon={icon} width={size} height={size} aria-hidden="true" />
	) : (
		<Box size={size} aria-hidden="true" />
	);
}
