/**
 * Checks the markup every node type turns into, since a response body is the
 * only place a mapping mistake shows up. Trees are written out by hand so the
 * assertions stand on the AST contract, and a few go through the parser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Markdown as MarkdownTypes } from "../index.js";

import { Markdown } from "../index.js";

import { toHTML } from "./index.js";

/** Every node needs one, and nothing here asserts on it, so one value serves the whole file. */
function position(): MarkdownTypes.Position {
	return {
		start: { line: 1, column: 1, offset: 0 },
		end: { line: 1, column: 1, offset: 0 },
	};
}

/** Inline text, which is what most of the trees below are made of. */
function text(value: string): MarkdownTypes.Text {
	return { type: "text", value, position: position() };
}

/** Wraps blocks in the root every document-level behavior needs. */
function document(...children: MarkdownTypes.Block[]): MarkdownTypes.Document {
	return { type: "document", children, position: position() };
}

/** A paragraph of plain words, which is the cheapest block to put somewhere. */
function paragraph(
	value: string,
	attributes: MarkdownTypes.Attributes = {},
): MarkdownTypes.Paragraph {
	return { type: "paragraph", attributes, children: [text(value)], position: position() };
}

/** A cell of plain words, so a table literal reads as a table. */
function cell(value: string): MarkdownTypes.TableCell {
	return { type: "tableCell", attributes: {}, children: [text(value)], position: position() };
}

/** A row of plain cells, marked as the header or as body. */
function row(header: boolean, ...values: string[]): MarkdownTypes.TableRow {
	return {
		type: "tableRow",
		header,
		attributes: {},
		children: values.map(cell),
		position: position(),
	};
}

/** Parses a source string the way a caller does, so the two halves are proven to agree. */
function parse(source: string): MarkdownTypes.Document {
	return unwrap(Markdown.parse(source)).document;
}

describe("toHTML", () => {
	test("renders a document's blocks in order, one per line", () => {
		expect(toHTML(document(paragraph("First."), paragraph("Second.")))).toBe(
			"<p>First.</p>\n<p>Second.</p>",
		);
	});

	test("gives every heading level its own element", () => {
		for (let level of [1, 2, 3, 4, 5, 6] as const) {
			let heading: MarkdownTypes.Heading = {
				type: "heading",
				level,
				attributes: {},
				children: [text("Setup")],
				position: position(),
			};

			expect(toHTML(heading)).toBe(`<h${level}>Setup</h${level}>`);
		}
	});

	test("renders a node that is not a document, so a caller can render a fragment", () => {
		let heading: MarkdownTypes.Heading = {
			type: "heading",
			level: 2,
			attributes: {},
			children: [text("Install")],
			position: position(),
		};

		expect(toHTML(heading)).toBe("<h2>Install</h2>");
	});

	test("writes an annotation's id and class onto the element", () => {
		let heading: MarkdownTypes.Heading = {
			type: "heading",
			level: 2,
			attributes: { id: "install", class: "lead" },
			children: [text("Install")],
			position: position(),
		};

		expect(toHTML(heading)).toBe('<h2 class="lead" id="install">Install</h2>');
	});

	test("merges an annotation's class with the class the element already carries", () => {
		let table: MarkdownTypes.Table = {
			type: "table",
			align: [null],
			attributes: { class: "wide" },
			children: [row(true, "Plan")],
			position: position(),
		};

		expect(toHTML(table)).toContain('<table class="md-table wide">');
	});

	test("writes any other annotation key as a data attribute, kebab-cased", () => {
		expect(toHTML(paragraph("Body.", { lastUpdated: "2026-01-01", level: 3 }))).toBe(
			'<p data-last-updated="2026-01-01" data-level="3">Body.</p>',
		);
	});

	test("writes a bare data attribute for a true annotation and nothing for a false one", () => {
		expect(toHTML(paragraph("Body.", { wide: true, compact: false }))).toBe(
			"<p data-wide>Body.</p>",
		);
	});

	test("escapes the characters that would otherwise be markup", () => {
		expect(toHTML(paragraph("a < b & c > d"))).toBe("<p>a &lt; b &amp; c &gt; d</p>");
	});

	test("escapes the quote an attribute value would close on", () => {
		let link: MarkdownTypes.Link = {
			type: "link",
			href: "/a?q=1&x=2",
			title: 'He said "go"',
			children: [text("Docs")],
			position: position(),
		};

		expect(toHTML(link)).toBe('<a href="/a?q=1&amp;x=2" title="He said &quot;go&quot;">Docs</a>');
	});

	test("renders a link with no title as an anchor with no title", () => {
		let link: MarkdownTypes.Link = {
			type: "link",
			href: "/docs",
			children: [text("Docs")],
			position: position(),
		};

		expect(toHTML(link)).toBe('<a href="/docs">Docs</a>');
	});

	describe("code", () => {
		test("writes only the first word of the info string as the language class", () => {
			let code: MarkdownTypes.Code = {
				type: "code",
				language: "tsx twoslash",
				content: "let a = 1;",
				attributes: {},
				position: position(),
			};

			expect(toHTML(code)).toBe(
				'<pre class="md-code language-tsx"><code class="language-tsx">let a = 1;</code></pre>',
			);
		});

		test("renders a fence with no language as a plain block", () => {
			let code: MarkdownTypes.Code = {
				type: "code",
				content: "plain",
				attributes: {},
				position: position(),
			};

			expect(toHTML(code)).toBe('<pre class="md-code"><code>plain</code></pre>');
		});

		test("carries the path and title an annotation wrote", () => {
			let code: MarkdownTypes.Code = {
				type: "code",
				language: "ts",
				content: "export {};",
				attributes: { path: "app/index.ts", title: "Entry" },
				position: position(),
			};

			expect(toHTML(code)).toContain('data-path="app/index.ts"');
			expect(toHTML(code)).toContain('data-title="Entry"');
		});

		test("escapes the source of a fence nobody painted", () => {
			let code: MarkdownTypes.Code = {
				type: "code",
				language: "html",
				content: "<div>&</div>",
				attributes: {},
				position: position(),
			};

			expect(toHTML(code)).toContain(
				'<code class="language-html">&lt;div&gt;&amp;&lt;/div&gt;</code>',
			);
		});

		test("draws a painted fence as token spans, plain runs staying text", () => {
			let code = {
				type: "code",
				language: "ts",
				content: "let a",
				attributes: {},
				position: position(),
				tokens: [
					{ type: "keyword", value: "let" },
					{ type: "plain", value: " a" },
				],
			} satisfies MarkdownTypes.Code & { tokens: Array<{ type: string; value: string }> };

			expect(toHTML(code)).toBe(
				'<pre class="md-code language-ts"><code class="language-ts"><span class="token keyword">let</span> a</code></pre>',
			);
		});

		test("draws the raw source when the painted field is malformed", () => {
			let code = {
				type: "code",
				language: "ts",
				content: "let a",
				attributes: {},
				position: position(),
				tokens: "painted",
			} as unknown as MarkdownTypes.Code;

			expect(toHTML(code)).toContain(">let a</code>");
		});
	});

	describe("lists", () => {
		test("renders an unordered list as a ul", () => {
			let list: MarkdownTypes.List = {
				type: "list",
				ordered: false,
				tight: true,
				attributes: {},
				children: [
					{
						type: "listItem",
						attributes: {},
						children: [paragraph("One.")],
						position: position(),
					},
				],
				position: position(),
			};

			expect(toHTML(list)).toBe("<ul><li><p>One.</p></li></ul>");
		});

		test("carries the number an ordered list starts at", () => {
			let list: MarkdownTypes.List = {
				type: "list",
				ordered: true,
				start: 3,
				tight: true,
				attributes: {},
				children: [],
				position: position(),
			};

			expect(toHTML(list)).toBe('<ol start="3"></ol>');
		});

		test("opens an unchecked task item with a disabled box", () => {
			let item: MarkdownTypes.ListItem = {
				type: "listItem",
				checked: false,
				attributes: {},
				children: [paragraph("Ship it.")],
				position: position(),
			};

			expect(toHTML(item)).toBe(
				'<li class="md-task"><input class="md-task-box" type="checkbox" disabled><p>Ship it.</p></li>',
			);
		});

		test("marks a checked task item on the box itself", () => {
			let item: MarkdownTypes.ListItem = {
				type: "listItem",
				checked: true,
				attributes: {},
				children: [paragraph("Done.")],
				position: position(),
			};

			expect(toHTML(item)).toContain(
				'<input class="md-task-box" type="checkbox" disabled checked>',
			);
		});
	});

	test("renders a block quote as a block quote", () => {
		let quote: MarkdownTypes.Blockquote = {
			type: "blockquote",
			attributes: {},
			children: [paragraph("Quoted.")],
			position: position(),
		};

		expect(toHTML(quote)).toBe("<blockquote><p>Quoted.</p></blockquote>");
	});

	test("draws an alert as an aside carrying its kind, with no label of its own", () => {
		let alert: MarkdownTypes.Alert = {
			type: "alert",
			kind: "warning",
			attributes: {},
			children: [paragraph("Careful.")],
			position: position(),
		};

		expect(toHTML(alert)).toBe(
			'<aside class="md-alert md-alert-warning" data-kind="warning"><p>Careful.</p></aside>',
		);
	});

	describe("tables", () => {
		test("splits the header row from the body", () => {
			let table: MarkdownTypes.Table = {
				type: "table",
				align: [null, null],
				attributes: {},
				children: [row(true, "Plan", "Monitors"), row(false, "Free", "5")],
				position: position(),
			};

			expect(toHTML(table)).toBe(
				'<table class="md-table"><thead><tr><th>Plan</th><th>Monitors</th></tr></thead>\n' +
					"<tbody><tr><td>Free</td><td>5</td></tr></tbody></table>",
			);
		});

		test("gives a cell the alignment of the column it sits in", () => {
			let table: MarkdownTypes.Table = {
				type: "table",
				align: ["left", "center", "right", null],
				attributes: {},
				children: [row(false, "a", "b", "c", "d")],
				position: position(),
			};

			let html = toHTML(table);

			expect(html).toContain('<td class="md-align-left">a</td>');
			expect(html).toContain('<td class="md-align-center">b</td>');
			expect(html).toContain('<td class="md-align-right">c</td>');
			expect(html).toContain("<td>d</td>");
		});

		test("renders a row and a cell on their own", () => {
			expect(toHTML(row(true, "Plan"))).toBe("<tr><th>Plan</th></tr>");
			expect(toHTML(cell("Free"))).toBe("<td>Free</td>");
		});
	});

	test("renders a thematic break as a rule", () => {
		let rule: MarkdownTypes.ThematicBreak = {
			type: "thematicBreak",
			attributes: {},
			position: position(),
		};

		expect(toHTML(rule)).toBe("<hr />");
	});

	test("renders a raw HTML block as the text it was written as", () => {
		let html: MarkdownTypes.Html = {
			type: "html",
			value: '<script>alert("x")</script>',
			attributes: {},
			position: position(),
		};

		expect(toHTML(html)).toBe('&lt;script&gt;alert("x")&lt;/script&gt;');
	});

	test("renders raw inline HTML as the text it was written as", () => {
		let inline: MarkdownTypes.InlineHtml = {
			type: "inlineHtml",
			value: "<br>",
			position: position(),
		};

		expect(toHTML(inline)).toBe("&lt;br&gt;");
	});

	describe("inline content", () => {
		test("renders each emphasis kind as its element", () => {
			expect(toHTML({ type: "emphasis", children: [text("a")], position: position() })).toBe(
				"<em>a</em>",
			);
			expect(toHTML({ type: "strong", children: [text("a")], position: position() })).toBe(
				"<strong>a</strong>",
			);
			expect(toHTML({ type: "strikethrough", children: [text("a")], position: position() })).toBe(
				"<del>a</del>",
			);
		});

		test("renders a code span as code, escaped", () => {
			expect(toHTML({ type: "inlineCode", value: "a < b", position: position() })).toBe(
				"<code>a &lt; b</code>",
			);
		});

		test("reads an image's alternative text out of its children", () => {
			let image: MarkdownTypes.Image = {
				type: "image",
				src: "/chart.png",
				title: "Chart",
				children: [text("Requests over time")],
				position: position(),
			};

			expect(toHTML(image)).toBe('<img src="/chart.png" alt="Requests over time" title="Chart" />');
		});

		test("renders the two breaks as the whitespace each stands for", () => {
			expect(toHTML({ type: "softBreak", position: position() })).toBe("\n");
			expect(toHTML({ type: "hardBreak", position: position() })).toBe("<br />");
		});

		test("leaves a variable visible rather than silently empty", () => {
			expect(toHTML({ type: "variable", name: "plan", position: position() })).toBe(
				'<span class="md-variable">{% $plan %}</span>',
			);
		});
	});

	describe("footnotes", () => {
		test("collects every definition into a trailing section, numbered in document order", () => {
			let reference = (identifier: string): MarkdownTypes.FootnoteReference => ({
				type: "footnoteReference",
				identifier,
				position: position(),
			});

			let definition = (identifier: string, body: string): MarkdownTypes.FootnoteDefinition => ({
				type: "footnoteDefinition",
				identifier,
				attributes: {},
				children: [paragraph(body)],
				position: position(),
			});

			let html = toHTML(
				document(
					{
						type: "paragraph",
						attributes: {},
						children: [text("Body"), reference("a"), text(" and "), reference("b")],
						position: position(),
					},
					definition("a", "First note."),
					definition("b", "Second note."),
				),
			);

			expect(html).toContain(
				'<sup class="md-footnote-ref"><a id="md-fnref-a" href="#md-fn-a">1</a></sup>',
			);
			expect(html).toContain(
				'<sup class="md-footnote-ref"><a id="md-fnref-b" href="#md-fn-b">2</a></sup>',
			);
			expect(html).toContain(
				'<section class="md-footnotes"><ol class="md-footnote-list">' +
					'<li id="md-fn-a"><p>First note.</p><a class="md-footnote-back" href="#md-fnref-a">↩</a></li>\n' +
					'<li id="md-fn-b"><p>Second note.</p><a class="md-footnote-back" href="#md-fnref-b">↩</a></li>' +
					"</ol></section>",
			);
			expect(html.indexOf("First note.")).toBeGreaterThan(html.indexOf("Body"));
		});

		test("renders nothing where a definition was written", () => {
			let html = toHTML(
				document(paragraph("Body."), {
					type: "footnoteDefinition",
					identifier: "a",
					attributes: {},
					children: [paragraph("Note.")],
					position: position(),
				}),
			);

			expect(html.startsWith("<p>Body.</p>\n<section")).toBe(true);
		});

		test("draws the identifier when a fragment carries no list to number against", () => {
			expect(toHTML({ type: "footnoteReference", identifier: "a", position: position() })).toBe(
				'<sup class="md-footnote-ref"><a id="md-fnref-a" href="#md-fn-a">a</a></sup>',
			);
		});
	});

	describe("tags", () => {
		test("hands a registered renderer the tag's rendered children", () => {
			let tag: MarkdownTypes.Tag = {
				type: "tag",
				name: "callout",
				attributes: { type: "warning" },
				children: [paragraph("Careful.")],
				position: position(),
			};

			let html = toHTML(tag, {
				tags: {
					callout: ({ attributes, children }) =>
						`<div class="callout" data-type="${String(attributes.type)}">${children}</div>`,
				},
			});

			expect(html).toBe('<div class="callout" data-type="warning"><p>Careful.</p></div>');
		});

		test("drops the chrome and keeps the content when no renderer is supplied", () => {
			let tag: MarkdownTypes.Tag = {
				type: "tag",
				name: "callout",
				attributes: {},
				children: [paragraph("Careful.")],
				position: position(),
			};

			expect(toHTML(tag)).toBe("<p>Careful.</p>");
		});

		test("joins an inline tag's children as a sentence", () => {
			let tag: MarkdownTypes.Tag = {
				type: "tag",
				name: "kbd",
				attributes: {},
				children: [text("Cmd")],
				position: position(),
			};

			expect(toHTML(tag, { tags: { kbd: ({ children }) => `<kbd>${children}</kbd>` } })).toBe(
				"<kbd>Cmd</kbd>",
			);
		});
	});

	describe("through the parser", () => {
		test("renders a document the parser produced", () => {
			let html = toHTML(parse("# Title\n\nSome **bold** and `code`.\n"));

			expect(html).toBe("<h1>Title</h1>\n<p>Some <strong>bold</strong> and <code>code</code>.</p>");
		});

		test("renders a fence the parser produced, with the annotation it carried", () => {
			let html = toHTML(parse('```ts {% path="app/index.ts" %}\nexport {};\n```\n'));

			expect(html).toContain('<pre class="md-code language-ts" data-path="app/index.ts">');
			expect(html).toContain('<code class="language-ts">export {};');
		});

		test("keeps raw HTML from the source out of the markup", () => {
			let html = toHTML(parse("<div>hi</div>\n"));

			expect(html.trim()).toBe("&lt;div&gt;hi&lt;/div&gt;");
		});

		test("renders a task list the parser produced", () => {
			let html = toHTML(parse("- [x] Done\n- [ ] Todo\n"));

			expect(html).toContain(
				'<li class="md-task"><input class="md-task-box" type="checkbox" disabled checked>',
			);
			expect(html).toContain('<input class="md-task-box" type="checkbox" disabled>');
		});

		test("renders a table the parser produced, alignment included", () => {
			let html = toHTML(parse("| Plan | Monitors |\n| :--- | -------: |\n| Free | 5 |\n"));

			expect(html).toContain('<table class="md-table">');
			expect(html).toContain('<th class="md-align-left">Plan</th>');
			expect(html).toContain('<td class="md-align-right">5</td>');
		});

		test("renders an alert the parser produced", () => {
			let html = toHTML(parse("> [!NOTE]\n> Billing runs per check.\n"));

			expect(html).toContain('<aside class="md-alert md-alert-note" data-kind="note">');
		});

		test("renders the footnotes the parser produced", () => {
			let html = toHTML(parse("Body[^a].\n\n[^a]: The note.\n"));

			expect(html).toContain('href="#md-fn-a">1</a>');
			expect(html).toContain('<li id="md-fn-a">');
		});

		test("renders a heading annotation the parser produced", () => {
			let html = toHTML(parse("## Install {% #install .lead %}\n"));

			expect(html).toBe('<h2 class="lead" id="install">Install</h2>');
		});
	});
});
