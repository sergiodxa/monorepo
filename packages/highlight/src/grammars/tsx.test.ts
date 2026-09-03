/**
 * Tests the TSX grammar: that elements and types are both painted, which is
 * what a grammar that treats a `.tsx` fence as JSX loses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer";

import { tsx } from "./tsx";

describe("tsx", () => {
	test("paints a declared type and the builtin it is made of", () => {
		let tokens = scan("interface U { id: string }", tsx);

		expect(tokens).toContainEqual({ type: "keyword", value: "interface" });
		expect(tokens).toContainEqual({ type: "builtin", value: "string" });
	});

	test("opens a tag where TypeScript would compare", () => {
		let tokens = scan("let el = <div>{value}</div>;", tsx);

		expect(tokens).toContainEqual({ type: "tag", value: "div" });
		expect(tokens).not.toContainEqual({ type: "operator", value: "<" });
	});

	test("keeps comparing where no tag follows", () => {
		let tokens = scan("if (count < total && total > 0) return;", tsx);

		expect(tokens).toContainEqual({ type: "operator", value: "<" });
		expect(tokens.filter((token) => token.type === "tag")).toEqual([]);
	});

	test("paints a type argument list rather than a tag", () => {
		let tokens = scan("let rows: Array<string> = [];", tsx);

		expect(tokens).toContainEqual({ type: "class-name", value: "Array" });
		expect(tokens).toContainEqual({ type: "builtin", value: "string" });
		expect(tokens.filter((token) => token.type === "tag")).toEqual([]);
	});

	test("returns an element from a typed function", () => {
		let tokens = scan(
			'function App(): JSX.Element {\n\treturn <main class="x">{body}</main>;\n}',
			tsx,
		);

		expect(tokens).toContainEqual({ type: "tag", value: "main" });
		expect(tokens).toContainEqual({ type: "attr-value", value: '"x"' });
	});

	test("highlights types inside an expression container", () => {
		let tokens = scan("<Row value={total as number} />", tsx);

		expect(tokens).toContainEqual({ type: "tag", value: "Row" });
		expect(tokens).toContainEqual({ type: "builtin", value: "number" });
	});

	test("paints a decorator", () => {
		let tokens = scan("@Route()\nclass Page {}", tsx);

		expect(tokens.at(0)).toEqual({ type: "function", value: "@Route" });
	});

	test("covers a component exactly", () => {
		let code = `import { Trans } from "@sdxc/i18n/ui";

// en.json: { "feed.article": "Read <articleLink>{{title}}</articleLink>" }
function ArticleTeaser(handle: Handle<{ title: string; href: string }>) {
	return () => (
		<Trans
			i18nKey="feed.article"
			values={{ title: handle.props.title }}
			components={{ articleLink: <a href={handle.props.href} /> }}
		/>
	);
}
`;
		let tokens = scan(code, tsx);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens.filter((token) => token.type === "tag").map((token) => token.value)).toEqual([
			"Trans",
			"a",
		]);
		expect(tokens).toContainEqual({ type: "class-name", value: "Handle" });
		expect(tokens).toContainEqual({ type: "builtin", value: "string" });
		expect(tokens).toContainEqual({ type: "attr-name", value: "i18nKey" });
		expect(tokens).toContainEqual({ type: "attr-value", value: '"feed.article"' });
		expect(tokens).toContainEqual({
			type: "comment",
			value: '// en.json: { "feed.article": "Read <articleLink>{{title}}</articleLink>" }',
		});
	});
});
