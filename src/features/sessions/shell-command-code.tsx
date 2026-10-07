import { HighlightedTokens, useHighlightedLines } from "./highlighted-code";

export function ShellCommandCode({ command }: { command: string }) {
	const tokens = useHighlightedLines(command, "shellscript");
	return (
		<pre className="session-command-source">
			<code>
				{command.split("\n").map((line, index) => (
					// Each source line retains its identity while output streams below it.
					// biome-ignore lint/suspicious/noArrayIndexKey: Line positions identify command source lines.
					<span key={index}>
						<HighlightedTokens text={line} tokens={tokens?.[index]} />
						{"\n"}
					</span>
				))}
			</code>
		</pre>
	);
}
