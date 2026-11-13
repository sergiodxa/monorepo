/**
 * Benchmarks the tokenizer against Prism on the same large inputs — run with
 * `vp test bench --run "$PWD/packages/highlight/"`. The scanner as it stood
 * before first-character dispatch runs beside them as the baseline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js";
import { bench, describe } from "vitest";

import { largeJson, largeTypeScript, longMarkdown, minifiedJavaScript } from "./fixtures/inputs.js";
import { referenceScan } from "./fixtures/reference-lexer.js";

import { languages, tokenize } from "./index.js";

loadLanguages(["typescript", "javascript", "json", "markdown"]);

/**
 * One benchmark group per input: this package with and without its line cap,
 * its previous scanner, and Prism, each tokenizing without rendering.
 */
const CASES = [
	{ name: "10,000-line TypeScript file", code: largeTypeScript(), language: "typescript" },
	{ name: "500 KB minified JavaScript line", code: minifiedJavaScript(), language: "javascript" },
	{ name: "2 MB JSON document", code: largeJson(), language: "json" },
	{ name: "10,000-line Markdown file", code: longMarkdown(), language: "markdown" },
];

for (let { name, code, language } of CASES) {
	describe(name, () => {
		bench("@sdxc/highlight", () => {
			tokenize(code, language);
		});

		bench("@sdxc/highlight (previous scanner)", () => {
			referenceScan(code, languages[language] ?? { main: [] });
		});

		bench("@sdxc/highlight (no line cap)", () => {
			tokenize(code, language, { maxLineLength: Infinity });
		});

		bench("prismjs", () => {
			Prism.tokenize(code, Prism.languages[language] ?? {});
		});
	});
}
