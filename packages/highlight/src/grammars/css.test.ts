/**
 * Tests the CSS grammar against the constructs this repository's stylesheets are
 * written with: nested rule sets, custom properties, at-rule preludes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer";

import { css } from "./css";

describe("css", () => {
	test("covers a stylesheet exactly", () => {
		let code =
			"/* u.mbe(4) */\n.host {\n\tmargin-block-end: calc(var(--ui-spacing, 0.25rem) * 4);\n}\n";
		let tokens = scan(code, css);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens).toEqual([
			{ type: "comment", value: "/* u.mbe(4) */" },
			{ type: "plain", value: "\n" },
			{ type: "tag", value: ".host" },
			{ type: "plain", value: " " },
			{ type: "punctuation", value: "{" },
			{ type: "plain", value: "\n\t" },
			{ type: "property", value: "margin-block-end" },
			{ type: "punctuation", value: ":" },
			{ type: "plain", value: " " },
			{ type: "function", value: "calc" },
			{ type: "punctuation", value: "(" },
			{ type: "function", value: "var" },
			{ type: "punctuation", value: "(" },
			{ type: "property", value: "--ui-spacing" },
			{ type: "punctuation", value: "," },
			{ type: "plain", value: " " },
			{ type: "number", value: "0.25rem" },
			{ type: "punctuation", value: ")" },
			{ type: "plain", value: " " },
			{ type: "operator", value: "*" },
			{ type: "plain", value: " " },
			{ type: "number", value: "4" },
			{ type: "punctuation", value: ");" },
			{ type: "plain", value: "\n" },
			{ type: "punctuation", value: "}" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("paints a declaration with no block around it", () => {
		expect(scan("--sidebar-width: 18rem;\n", css)).toEqual([
			{ type: "property", value: "--sidebar-width" },
			{ type: "punctuation", value: ":" },
			{ type: "plain", value: " " },
			{ type: "number", value: "18rem" },
			{ type: "punctuation", value: ";" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("paints a nested rule set as a selector, not a declaration", () => {
		let tokens = scan(".host {\n\t&[open],\n\t&:popover-open {\n\t\topacity: 1;\n\t}\n}\n", css);

		expect(tokens.filter((token) => token.type === "tag")).toEqual([
			{ type: "tag", value: ".host" },
			{ type: "tag", value: "&[open]" },
			{ type: "tag", value: "&:popover-open" },
		]);

		expect(tokens).toContainEqual({ type: "property", value: "opacity" });
	});

	test("keeps a pseudo-class selector out of the property position", () => {
		let tokens = scan("a:hover {\n\tcolor: red;\n}\n", css);

		expect(tokens[0]).toEqual({ type: "tag", value: "a:hover" });

		expect(tokens).toContainEqual({ type: "property", value: "color" });
	});

	test("paints a custom property where it is declared and where var reads it", () => {
		let tokens = scan(
			":root {\n\t--brand: oklch(0.52 0.18 250);\n\tcolor: var(--brand);\n}\n",
			css,
		);

		expect(tokens.filter((token) => token.type === "property")).toEqual([
			{ type: "property", value: "--brand" },
			{ type: "property", value: "color" },
			{ type: "property", value: "--brand" },
		]);

		expect(tokens.filter((token) => token.type === "function")).toEqual([
			{ type: "function", value: "oklch" },
			{ type: "function", value: "var" },
		]);
	});

	test("paints an at-rule and hands its body back to rule sets", () => {
		let tokens = scan(
			"@media screen and (min-width: 40rem) {\n\t.host {\n\t\tcolor: #fff;\n\t}\n}\n",
			css,
		);

		expect(tokens).toContainEqual({ type: "keyword", value: "@media" });
		expect(tokens).toContainEqual({ type: "keyword", value: "and" });
		expect(tokens).toContainEqual({ type: "property", value: "min-width" });
		expect(tokens).toContainEqual({ type: "number", value: "40rem" });
		expect(tokens).toContainEqual({ type: "tag", value: ".host" });
		expect(tokens).toContainEqual({ type: "property", value: "color" });
		expect(tokens).toContainEqual({ type: "number", value: "#fff" });
	});

	test("paints the string an import names", () => {
		expect(scan("@import './reset.css';\n", css)).toEqual([
			{ type: "keyword", value: "@import" },
			{ type: "plain", value: " " },
			{ type: "string", value: "'./reset.css'" },
			{ type: "punctuation", value: ";" },
			{ type: "plain", value: "\n" },
		]);
	});

	test("paints an override as a keyword", () => {
		let tokens = scan(".a {\n\tcolor: red !important;\n}\n", css);

		expect(tokens).toContainEqual({ type: "keyword", value: "!important" });
	});

	test("keeps a unit inside a keyword out of the number", () => {
		let tokens = scan(".a {\n\ttransform-style: preserve-3d;\n}\n", css);

		expect(tokens.filter((token) => token.type === "number")).toEqual([]);
		expect(tokens).toContainEqual({ type: "plain", value: " preserve-3d" });
	});

	test("closes a declaration the source left without a semicolon", () => {
		let tokens = scan(".a { color: red }\n.b { color: blue }\n", css);

		expect(tokens.filter((token) => token.type === "tag")).toEqual([
			{ type: "tag", value: ".a" },
			{ type: "tag", value: ".b" },
		]);

		expect(tokens.filter((token) => token.type === "property")).toEqual([
			{ type: "property", value: "color" },
			{ type: "property", value: "color" },
		]);
	});

	test("paints a comment that was never closed", () => {
		expect(scan("/* unfinished", css)).toEqual([{ type: "comment", value: "/* unfinished" }]);
	});
});
