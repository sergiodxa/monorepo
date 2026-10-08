/**
 * Exercises the dialect writers: each platform's marks and escapes from one Markdown
 * source, headings and tables flattened, and truncation that fits a limit without
 * splitting an entity, a tag or a grapheme.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	discordMarkdown,
	fitText,
	mrkdwn,
	plainText,
	pushoverHtml,
	teamsMarkdown,
	telegramHtml,
	whatsappText,
	writeText,
} from "./text.js";

const SOURCE = "**bold** _italic_ ~~strike~~ `code` [t](https://u.example.com/)";

describe("writeText", () => {
	test.each([
		[mrkdwn, "*bold* _italic_ ~strike~ `code` <https://u.example.com/|t>"],
		[discordMarkdown, "**bold** *italic* ~~strike~~ `code` [t](https://u.example.com/)"],
		[teamsMarkdown, "**bold** _italic_ strike code [t](https://u.example.com/)"],
		[
			telegramHtml,
			'<b>bold</b> <i>italic</i> <s>strike</s> <code>code</code> <a href="https://u.example.com/">t</a>',
		],
		[whatsappText, "*bold* _italic_ ~strike~ `code` t: https://u.example.com/"],
		[pushoverHtml, '<b>bold</b> <i>italic</i> strike code <a href="https://u.example.com/">t</a>'],
		[plainText, "bold italic strike code t: https://u.example.com/"],
	])("writes every mark in the platform's dialect (%#)", (dialect, expected) => {
		expect(writeText(SOURCE, dialect)).toBe(expected);
	});

	test("escapes literal text so a monitor name arrives as typed", () => {
		expect(writeText("<prod> & co", telegramHtml)).toBe("&lt;prod&gt; &amp; co");
		expect(writeText("<prod> & co", mrkdwn)).toBe("&lt;prod&gt; &amp; co");
		expect(writeText("a\\*b", discordMarkdown)).toBe("a\\*b");
		expect(writeText("snake\\_case", teamsMarkdown)).toBe("snake\\_case");
	});

	test("writes a heading as a bold line and a table as its plain rows", () => {
		let source = "# Status\n\n| a | b |\n| - | - |\n| 1 | 2 |";
		expect(writeText(source, mrkdwn)).toBe("*Status*\n\na | b\n1 | 2");
	});

	test("writes lists one item per line, and keeps line breaks", () => {
		expect(writeText("- one\n- two", plainText)).toBe("• one\n• two");
		expect(writeText("1. one\n2. two", plainText)).toBe("1. one\n2. two");
		expect(writeText("line one\nline two", plainText)).toBe("line one\nline two");
	});

	test("quotes in each dialect's form", () => {
		expect(writeText("> quoted", mrkdwn)).toBe("> quoted");
		expect(writeText("> quoted", telegramHtml)).toBe("<blockquote>quoted</blockquote>");
	});

	test("writes code blocks with their contents escaped once", () => {
		expect(writeText("```js\na < b\n```", telegramHtml)).toBe(
			'<pre><code class="language-js">a &lt; b</code></pre>',
		);
		expect(writeText("```\na < b\n```", mrkdwn)).toBe("```\na &lt; b\n```");
	});

	test("fits a limit with an ellipsis, never splitting an entity or a tag", () => {
		let source = "**<<<<<<<<<<** and more text after it";
		let written = writeText(source, telegramHtml, 30);
		expect(written.length).toBeLessThanOrEqual(30);
		expect(written.endsWith("…")).toBe(true);
		expect(written).not.toMatch(/&[a-z]*$|&[a-z]*…/u);
		expect(written.match(/<b>/gu)?.length ?? 0).toBe(written.match(/<\/b>/gu)?.length ?? 0);
	});

	test("leaves text under the limit untouched", () => {
		expect(writeText("short", mrkdwn, 100)).toBe("short");
	});
});

describe("fitText", () => {
	test("cuts at a grapheme boundary before escaping", () => {
		expect(fitText("a <b> c", 6, telegramHtml.escape)).toBe("a…");
		expect(fitText("👨‍👩‍👧‍👦👨‍👩‍👧‍👦", 13)).toBe("👨‍👩‍👧‍👦…");
	});

	test("answers text within the limit as is", () => {
		expect(fitText("hello", 5)).toBe("hello");
	});
});
