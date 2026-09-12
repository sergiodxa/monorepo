/**
 * Checks the markup every node type turns into, since the rendered page is the
 * only place a mapping mistake shows up. Trees are written out by hand so the
 * assertions stand on the AST contract rather than on the parser's output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/* @jsxImportSource remix/ui */

import type { Handle, RemixNode } from "remix/ui";

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Markdown } from "../index.js";

import { toRemix } from "./index.js";

/** Every node needs one, and nothing here asserts on it, so one value serves the whole file. */
function position(): Markdown.Position {
	return {
		start: { line: 1, column: 1, offset: 0 },
		end: { line: 1, column: 1, offset: 0 },
	};
}

/** Inline text, which is what most of the trees below are made of. */
function text(value: string): Markdown.Text {
	return { type: "text", value, position: position() };
}

/** Wraps blocks in the root every document-level behavior needs. */
function document(...children: Markdown.Block[]): Markdown.Document {
	return { type: "document", children, position: position() };
}

/** A paragraph of plain words, which is the cheapest block to put somewhere. */
function paragraph(value: string): Markdown.Paragraph {
	return { type: "paragraph", attributes: {}, children: [text(value)], position: position() };
}

/** Renders a node the way a view does and returns the HTML for inspection. */
function render(node: Markdown.Node, options?: Parameters<typeof toRemix>[1]): Promise<string> {
	return renderToString(toRemix(node, options));
}

describe("toRemix", () => {
	test("renders a document's blocks in order", async () => {
		let html = await render(document(paragraph("First."), paragraph("Second.")));

		expect(html).toContain("First.");
		expect(html).toContain("Second.");
		expect(html.indexOf("First.")).toBeLessThan(html.indexOf("Second."));
	});

	test("renders each heading level as its own element, with the annotation's id and class", async () => {
		let heading: Markdown.Heading = {
			type: "heading",
			level: 3,
			attributes: { id: "setup", class: "anchored" },
			children: [text("Setup")],
			position: position(),
		};

		let html = await render(heading);

		expect(html).toContain("<h3");
		expect(html).toContain('id="setup"');
		expect(html).toContain("anchored");
		expect(html).toContain("Setup");
	});

	test("gives every level from one to six its own tag", async () => {
		for (let level of [1, 2, 3, 4, 5, 6] as const) {
			let html = await render({
				type: "heading",
				level,
				attributes: {},
				children: [text(`Level ${level}`)],
				position: position(),
			});

			expect(html).toContain(`<h${level}`);
		}
	});

	test("renders the inline marks as the elements they stand for", async () => {
		let html = await render({
			type: "paragraph",
			attributes: {},
			children: [
				{ type: "emphasis", children: [text("soft")], position: position() },
				{ type: "strong", children: [text("loud")], position: position() },
				{ type: "strikethrough", children: [text("gone")], position: position() },
				{ type: "inlineCode", value: "DEBUG=1", position: position() },
			],
			position: position(),
		});

		expect(html).toContain("<em");
		expect(html).toContain("soft");
		expect(html).toContain("<strong");
		expect(html).toContain("loud");
		expect(html).toContain("<s>gone</s>");
		expect(html).toContain("<code");
		expect(html).toContain("DEBUG=1");
	});

	test("renders a link with its destination and title", async () => {
		let html = await render({
			type: "link",
			href: "https://example.com",
			title: "Home",
			children: [text("docs")],
			position: position(),
		});

		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('title="Home"');
		expect(html).toContain("docs");
	});

	test("takes an image's alternative text from the inline content under it", async () => {
		let html = await render({
			type: "image",
			src: "/chart.png",
			title: "Uptime",
			children: [text("Uptime over "), { type: "inlineCode", value: "30d", position: position() }],
			position: position(),
		});

		expect(html).toContain('src="/chart.png"');
		expect(html).toContain('alt="Uptime over 30d"');
		expect(html).toContain('title="Uptime"');
	});

	test("renders the two breaks and the thematic rule", async () => {
		let html = await render({
			type: "paragraph",
			attributes: {},
			children: [
				text("one"),
				{ type: "softBreak", position: position() },
				text("two"),
				{ type: "hardBreak", position: position() },
				text("three"),
			],
			position: position(),
		});

		expect(html).toContain("<br");
		expect(html).toContain("one\ntwo");
		expect(await render({ type: "thematicBreak", attributes: {}, position: position() })).toContain(
			"<hr",
		);
	});

	test("renders a block quote around its blocks", async () => {
		let html = await render({
			type: "blockquote",
			attributes: {},
			children: [paragraph("Quoted.")],
			position: position(),
		});

		expect(html).toContain("<blockquote");
		expect(html).toContain("Quoted.");
	});

	test("numbers an ordered list from where the source started it", async () => {
		let html = await render({
			type: "list",
			ordered: true,
			start: 3,
			tight: true,
			attributes: {},
			children: [
				{
					type: "listItem",
					attributes: {},
					children: [paragraph("Third.")],
					position: position(),
				},
			],
			position: position(),
		});

		expect(html).toContain("<ol");
		expect(html).toContain('start="3"');
		expect(html).toContain("<li");
		expect(html).toContain("Third.");
	});

	test("bullets an unordered list", async () => {
		let html = await render({
			type: "list",
			ordered: false,
			tight: true,
			attributes: {},
			children: [
				{ type: "listItem", attributes: {}, children: [paragraph("Loose.")], position: position() },
			],
			position: position(),
		});

		expect(html).toContain("<ul");
		expect(html).toContain("Loose.");
	});

	test("draws a task list item's box, disabled, in the state the source checked", async () => {
		let html = await render({
			type: "listItem",
			checked: true,
			attributes: {},
			children: [paragraph("Ship it.")],
			position: position(),
		});

		expect(html).toContain('<input type="checkbox" checked disabled');
		expect(html).toContain("Ship it.");
	});

	test("splits a table at its header row and honours the column alignment", async () => {
		let cell = (value: string): Markdown.TableCell => ({
			type: "tableCell",
			attributes: {},
			children: [text(value)],
			position: position(),
		});

		let html = await render({
			type: "table",
			align: ["left", "center", "right"],
			attributes: {},
			children: [
				{
					type: "tableRow",
					header: true,
					attributes: {},
					children: [cell("Name"), cell("Plan"), cell("Cost")],
					position: position(),
				},
				{
					type: "tableRow",
					header: false,
					attributes: {},
					children: [cell("Team"), cell("Pro"), cell("42")],
					position: position(),
				},
			],
			position: position(),
		});

		expect(html).toContain("<thead");
		expect(html).toContain("<th");
		expect(html).toContain("<tbody");
		expect(html).toContain("<td");
		expect(html).toContain("Name");
		expect(html).toContain("42");
		expect(html).toContain("text-align: center");
		expect(html).toContain("text-align: right");
	});

	test("renders a code block's raw content when nothing painted it", async () => {
		let html = await render({
			type: "code",
			language: "ts",
			content: "let answer = 42;",
			attributes: { path: "app/main.ts", title: "Entry" },
			position: position(),
		});

		expect(html).toContain("<pre");
		expect(html).toContain('class="language-ts"');
		expect(html).toContain("let answer = 42;");
		expect(html).toContain("app/main.ts");
		expect(html).toContain("Entry");
	});

	test("paints a code block from the tokens a highlighter left on the node", async () => {
		let code = {
			type: "code",
			language: "ts",
			content: 'let x = "y";',
			attributes: {},
			position: position(),
			tokens: [
				{ type: "keyword", value: "let" },
				{ type: "plain", value: " x = " },
				{ type: "string", value: '"y"' },
			],
		} as Markdown.Code;

		let html = await render(code);

		expect(html).toContain('class="token keyword"');
		expect(html).toContain('class="token string"');
		expect(html).toContain("let");
		expect(html).not.toContain('class="token plain"');
	});

	test("draws an alert as an aside carrying the kind it parsed as", async () => {
		let html = await render({
			type: "alert",
			kind: "warning",
			attributes: {},
			children: [paragraph("History goes with it.")],
			position: position(),
		});

		expect(html).toContain("<aside");
		expect(html).toContain('data-kind="warning"');
		expect(html).toContain("History goes with it.");
	});

	test("hands an alert to the component a caller supplied for it", async () => {
		function Alert({ props }: Handle<{ kind: string; children: RemixNode }>) {
			return () => <section data-alert={props.kind}>{props.children}</section>;
		}

		let html = await render(
			{
				type: "alert",
				kind: "note",
				attributes: {},
				children: [paragraph("Billed per check.")],
				position: position(),
			},
			{ components: { alert: Alert } },
		);

		expect(html).toContain('data-alert="note"');
		expect(html).toContain("Billed per check.");
		expect(html).not.toContain("<aside");
	});

	test("gives a tag's component its attributes and its rendered children", async () => {
		function Callout({ props }: Handle<{ type: string; children: RemixNode }>) {
			return () => <aside data-type={props.type}>{props.children}</aside>;
		}

		let html = await render(
			{
				type: "tag",
				name: "callout",
				attributes: { type: "warning" },
				children: [
					{
						type: "paragraph",
						attributes: {},
						children: [
							text("Deleting a monitor also deletes its "),
							{ type: "strong", children: [text("history")], position: position() },
						],
						position: position(),
					},
				],
				position: position(),
			},
			{ components: { callout: Callout } },
		);

		expect(html).toContain('data-type="warning"');
		expect(html).toContain("<strong");
		expect(html).toContain("history");
	});

	test("keeps a tag's content when no component claims its name", async () => {
		let html = await render({
			type: "tag",
			name: "callout",
			attributes: { type: "warning" },
			children: [paragraph("Still readable.")],
			position: position(),
		});

		expect(html).toContain("Still readable.");
		expect(html).not.toContain("callout");
	});

	test("shows raw HTML as the text it was written as", async () => {
		let html = await render(
			document(
				{
					type: "html",
					value: "<div class='raw'>block</div>",
					attributes: {},
					position: position(),
				},
				{
					type: "paragraph",
					attributes: {},
					children: [{ type: "inlineHtml", value: "<span>inline</span>", position: position() }],
					position: position(),
				},
			),
		);

		expect(html).toContain("&lt;div class='raw'&gt;block&lt;/div&gt;");
		expect(html).toContain("&lt;span&gt;inline&lt;/span&gt;");
		expect(html).not.toContain("<div class='raw'>");
	});

	test("collects footnote definitions into one list at the end of the document", async () => {
		let html = await render(
			document(
				{
					type: "paragraph",
					attributes: {},
					children: [
						text("Cron monitors bill per check"),
						{ type: "footnoteReference", identifier: "1", position: position() },
						text("."),
					],
					position: position(),
				},
				{
					type: "footnoteDefinition",
					identifier: "1",
					attributes: {},
					children: [paragraph("Billing is per executed check.")],
					position: position(),
				},
				paragraph("Closing words."),
			),
		);

		expect(html).toContain("<sup");
		expect(html).toContain('href="#fn-1"');
		expect(html).toContain('id="fn-1"');
		expect(html).toContain("Billing is per executed check.");
		expect(html.indexOf("Closing words.")).toBeLessThan(
			html.indexOf("Billing is per executed check."),
		);
	});

	test("renders an unresolved variable as the hole the source wrote", async () => {
		let html = await render({
			type: "paragraph",
			attributes: {},
			children: [
				text("Status page for "),
				{ type: "variable", name: "team", position: position() },
			],
			position: position(),
		});

		expect(html).toContain("{% $team %}");
	});
});
