import { createCodePlugin } from "@streamdown/code";

export const codeHighlighter = createCodePlugin({
	themes: ["github-light", "github-dark"],
});
