/**
 * Tests markdown as an email body against the two things that make it different from
 * markdown on a page: every element has to come out with its styles inline, and the
 * plain-text half has to stay readable through the same conversion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { CodeBlock, Markdown } from "./markdown";

import { render } from "./index";

describe("Markdown", () => {
	test("renders every block with the kit's own inline styles, never a class alone", async () => {
		let { html } = await render(<Markdown>{"# Title\n\nSome copy."}</Markdown>);

		expect(html).toContain("<h1 style=");
		expect(html).toContain("font-size:24px");
		expect(html).toContain("<p style=");
		expect(html).toContain("line-height:1.6");
	});

	test("keeps inline emphasis, code, and links, with the target in the text part", async () => {
		let source = "Set `DEBUG=1` for **more**, or read the [docs](https://example.com).";

		let { html, text } = await render(<Markdown>{source}</Markdown>);

		expect(html).toContain("<code");
		expect(html).toContain("<strong");
		expect(html).toContain('href="https://example.com"');
		expect(text).toBe("Set DEBUG=1 for more, or read the docs (https://example.com).");
	});

	test("numbers an ordered list and bullets an unordered one, in both parts", async () => {
		let { html, text } = await render(<Markdown>{"1. One\n2. Two\n\n- Loose\n- Ends"}</Markdown>);

		expect(html).toContain("<ol");
		expect(html).toContain("<ul");
		expect(text).toContain("1. One");
		expect(text).toContain("2. Two");
		expect(text).toContain("- Loose");
	});

	test("drops the paragraph markdown wraps a loose list item in", async () => {
		// Without it a five-item list is five blocks: the paragraph's bottom margin is
		// designed to separate paragraphs, not the lines of a list.
		let { html } = await render(<Markdown>{"- One\n\n- Two"}</Markdown>);

		expect(html).toContain("<li");
		expect(html).not.toContain(
			'<li style="margin:0 0 6px;font-family:inherit;line-height:1.6;"><p',
		);
	});

	test("renders anything with no email-safe form as its content rather than dropping it", async () => {
		let { text } = await render(<Markdown>{"| a | b |\n| - | - |\n| 1 | 2 |"}</Markdown>);

		expect(text).toContain("a");
		expect(text).toContain("2");
	});

	test("gives up its heading levels at three, which is as many as a card holds", async () => {
		let { html } = await render(<Markdown>{"###### Deep"}</Markdown>);

		expect(html).toStartWith("<h3");
	});
});

describe("CodeBlock", () => {
	test("highlights a known language into spans that carry their own color", async () => {
		let { html } = await render(<CodeBlock language="typescript" code={'let x = "y";'} />);

		expect(html).toContain('class="mail-tok-keyword"');
		expect(html).toContain("color:#d73a49");
		expect(html).toContain('class="mail-tok-string"');
	});

	test("renders an unknown language unpainted rather than failing", async () => {
		let { html, text } = await render(<CodeBlock language="brainfuck" code="++[.]" />);

		expect(html).not.toContain("mail-tok-");
		expect(text).toBe("++[.]");
	});

	test("takes its language from the fence when rendered through markdown", async () => {
		let { html } = await render(<Markdown>{"```bash\n# deploy it\nbun run deploy\n```"}</Markdown>);

		expect(html).toContain('class="mail-tok-comment"');
	});

	test("wraps long lines, since an inbox has no horizontal scrollbar to offer", async () => {
		let { html } = await render(<CodeBlock code="x" />);

		expect(html).toContain("white-space:pre-wrap");
		expect(html).toContain("word-break:break-word");
	});

	test("takes its fill from a table cell, which Outlook paints to the full width", async () => {
		let { html } = await render(<CodeBlock code="x" />);

		expect(html).toStartWith("<table");
		expect(html).toContain('class="mail-code"');
	});
});
