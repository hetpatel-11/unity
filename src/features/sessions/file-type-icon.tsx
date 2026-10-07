import { fileTypeIconName } from "#/domain/file-kind";
import setiFileIcons from "#/domain/seti-file-icons.json";
import "./seti-file-icons.css";

const icons: Record<string, { fontCharacter: string; fontColor?: string }> =
	setiFileIcons.iconDefinitions;

export function FileTypeIcon({
	path,
	size = 16,
}: {
	path: string;
	size?: number;
}) {
	const name = fileTypeIconName(path);
	const icon = icons[name] ?? icons[setiFileIcons.file];
	return (
		<span
			style={{
				width: size,
				height: size,
				fontSize: size * 1.5,
				color: icon.fontColor,
			}}
			className="file-type-icon seti-file-icon"
			aria-hidden="true"
		>
			{String.fromCodePoint(Number.parseInt(icon.fontCharacter.slice(1), 16))}
		</span>
	);
}
