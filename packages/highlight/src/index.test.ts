/**
 * Tests the package's own contract: alias resolution, the shape a language with
 * no grammar comes back as, the markup form's escaping, and the properties
 * every registered grammar has to hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { highlight, languages, normalizeLanguage, tokenize } from "./index";

const SAMPLE = 'let a = "b"; // c\n<x y="z">\n- d\n@e f(1)\n#g\n';

describe("normalizeLanguage", () => {
	test("follows an alias to the grammar that serves it", () => {
		expect(normalizeLanguage("ts")).toBe("typescript");
		expect(normalizeLanguage("YML")).toBe("yaml");
		expect(normalizeLanguage("jsonc")).toBe("json");
		expect(normalizeLanguage("gql")).toBe("graphql");
		expect(normalizeLanguage("svg")).toBe("html");
	});

	test("sends the names that mean unhighlighted to plain", () => {
		for (let name of ["text", "txt", "plaintext", "dotenv", "env"]) {
			expect(normalizeLanguage(name)).toBe("plain");
		}
	});

	test("returns an unknown language unchanged", () => {
		expect(normalizeLanguage("HCL")).toBe("hcl");
	});

	/**
	 * A lookup that reached the prototype would resolve `constructor` to a
	 * function and hand it on as a language name.
	 */
	test("resolves only the table's own entries", () => {
		expect(normalizeLanguage("constructor")).toBe("constructor");
		expect(normalizeLanguage("toString")).toBe("tostring");
	});
});

describe("tokenize", () => {
	test("returns one plain token for a language with no grammar", () => {
		expect(tokenize("resource {}", "hcl")).toEqual([{ type: "plain", value: "resource {}" }]);
	});

	test("returns nothing for empty source", () => {
		expect(tokenize("", "typescript")).toEqual([]);
		expect(tokenize("", "hcl")).toEqual([]);
	});

	test("keeps values raw, leaving escaping to whoever renders markup", () => {
		let tokens = tokenize('let a = "<b>&c</b>";', "typescript");

		expect(tokens.map((token) => token.value).join("")).toBe('let a = "<b>&c</b>";');
	});

	test("covers the input exactly once, in every registered language", () => {
		let lost = Object.keys(languages).filter(
			(language) =>
				tokenize(SAMPLE, language)
					.map((token) => token.value)
					.join("") !== SAMPLE,
		);

		expect(lost).toEqual([]);
	});

	test("resolves the language through its aliases", () => {
		expect(tokenize("let x", "ts")).toEqual(tokenize("let x", "typescript"));
	});
});

describe("highlight", () => {
	test("wraps every painted run in a token span", () => {
		expect(highlight("let x", "typescript")).toBe('<span class="token keyword">let</span> x');
	});

	test("escapes what it writes, painted or not", () => {
		expect(highlight("<b>&</b>", "hcl")).toBe("&lt;b&gt;&amp;&lt;/b&gt;");
		expect(highlight('"<b>"', "typescript")).toBe(
			'<span class="token string">&quot;&lt;b&gt;&quot;</span>'.replaceAll("&quot;", '"'),
		);
	});

	test("leaves no markup a renderer could execute", () => {
		let markup = highlight('let a = "<img src=x onerror=alert(1)>";', "typescript");

		expect(markup).not.toContain("<img");
		expect(markup).toContain("&lt;img");
	});
});
