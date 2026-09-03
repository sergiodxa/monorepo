/**
 * Tests the JSX grammar: tags and their attributes, the expressions written in
 * a container, and the text between tags that stays plain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer.js";

import { jsx } from "./jsx.js";

describe("jsx", () => {
	test("paints a tag, its attribute and its children", () => {
		let tokens = scan('<a href="/about">About</a>', jsx);

		expect(tokens).toEqual([
			{ type: "punctuation", value: "<" },
			{ type: "tag", value: "a" },
			{ type: "plain", value: " " },
			{ type: "attr-name", value: "href" },
			{ type: "punctuation", value: "=" },
			{ type: "attr-value", value: '"/about"' },
			{ type: "punctuation", value: ">" },
			{ type: "plain", value: "About" },
			{ type: "punctuation", value: "</" },
			{ type: "tag", value: "a" },
			{ type: "punctuation", value: ">" },
		]);
	});

	test("closes a self-closing tag", () => {
		let tokens = scan('<img src="a.png" />', jsx);

		expect(tokens.at(-1)).toEqual({ type: "punctuation", value: "/>" });
	});

	test("paints a component and a member tag by name", () => {
		let tags = scan("<Menu.Item disabled>x</Menu.Item>", jsx)
			.filter((token) => token.type === "tag")
			.map((token) => token.value);

		expect(tags).toEqual(["Menu.Item", "Menu.Item"]);
	});

	test("keeps the text between tags plain", () => {
		let tokens = scan("<p>let const return 2 + 2</p>", jsx);

		expect(tokens).toContainEqual({ type: "plain", value: "let const return 2 + 2" });
	});

	test("recognizes an inline tag after a word of text", () => {
		let tags = scan("<p>hello <em>world</em> ok</p>", jsx)
			.filter((token) => token.type === "tag")
			.map((token) => token.value);

		expect(tags).toEqual(["p", "em", "em", "p"]);
	});

	test("highlights the expression inside a container", () => {
		let tokens = scan("<p>{count + 1}</p>", jsx);

		expect(tokens).toContainEqual({ type: "number", value: "1" });
		expect(tokens).toContainEqual({ type: "operator", value: "+" });
	});

	test("returns from a nested brace to the container that opened it", () => {
		let tokens = scan('<div style={{ color: "red" }}>after</div>', jsx);

		expect(tokens).toContainEqual({ type: "property", value: "color" });
		expect(tokens).toContainEqual({ type: "string", value: '"red"' });
		expect(tokens).toContainEqual({ type: "plain", value: "after" });
	});

	test("highlights a spread attribute as code", () => {
		let tokens = scan("<Foo {...props} />", jsx);

		expect(tokens).toContainEqual({ type: "operator", value: "..." });
	});

	test("paints a fragment as punctuation", () => {
		let tokens = scan("<>\n\t<A />\n</>", jsx);

		expect(tokens.at(0)).toEqual({ type: "punctuation", value: "<>" });
		expect(tokens.at(-1)).toEqual({ type: "punctuation", value: "</>" });
	});

	test("highlights a comment written in a container", () => {
		let tokens = scan("<div>{/* note */}</div>", jsx);

		expect(tokens).toContainEqual({ type: "comment", value: "/* note */" });
	});

	test("keeps painting the JavaScript around an element", () => {
		let tokens = scan('let el = <b class="x">hi</b>;', jsx);

		expect(tokens.at(0)).toEqual({ type: "keyword", value: "let" });
		expect(tokens).toContainEqual({ type: "attr-value", value: '"x"' });
	});

	test("covers a fragment of markup exactly", () => {
		let code = `<ul role="list" mix={[u.vstack(), u.divide(), u.rounded("lg"), u.clip(), u.border("neutral")]}>
	{items.map((item) => (
		<li key={item.id} mix={[u.p(3)]}>
			{item.label}
		</li>
	))}
</ul>
`;
		let tokens = scan(code, jsx);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens.filter((token) => token.type === "tag").map((token) => token.value)).toEqual([
			"ul",
			"li",
			"li",
			"ul",
		]);
		expect(tokens).toContainEqual({ type: "attr-name", value: "role" });
		expect(tokens).toContainEqual({ type: "attr-value", value: '"list"' });
		expect(tokens).toContainEqual({ type: "function", value: "map" });
		expect(tokens).toContainEqual({ type: "string", value: '"neutral"' });
	});
});
