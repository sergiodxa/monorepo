/**
 * Vitest suite benchmarks for Markdown.parse — run with `vp test bench`.
 * Comparisons with toBeFasterThan need Vitest 5's bench fixture; until then
 * this file measures throughput of the parser on a short article.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { bench, describe } from "vitest";

import { Markdown } from "./index.js";

/** A short GFM article: headings, emphasis, a list and a fenced block. */
const SAMPLE = `# Title

A short paragraph with **emphasis** and a [link](https://example.com).

- one
- two

\`\`\`ts
export const value = 1;
\`\`\`
`;

describe("Markdown.parse", () => {
	bench("parse a short article", () => {
		Markdown.parse(SAMPLE);
	});
});
