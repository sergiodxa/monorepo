/**
 * Tests the plain-text derivation: that link targets survive, that structure turns
 * into readable line breaks, and that markup a reader cannot act on — document
 * head, styles, and hidden preheaders — is dropped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { htmlToText } from "./html-to-text.js";

describe("htmlToText", () => {
	test("separates paragraphs with a blank line", () => {
		expect(htmlToText("<p>First</p><p>Second</p>")).toBe("First\n\nSecond");
	});

	test("keeps a link target beside its label, since text has no other way to reach it", () => {
		expect(htmlToText('<p>Open <a href="https://example.com/x">the invite</a></p>')).toBe(
			"Open the invite (https://example.com/x)",
		);
	});

	test("prints a link once when the label already is the target", () => {
		expect(htmlToText('<a href="https://example.com/x">https://example.com/x</a>')).toBe(
			"https://example.com/x",
		);
	});

	test("keeps the address of a mailto link without repeating the scheme", () => {
		expect(htmlToText('<a href="mailto:a@example.com">a@example.com</a>')).toBe("a@example.com");
	});

	test("reads a link target through the markup nested inside the label", () => {
		expect(htmlToText('<a href="https://example.com"><strong>Accept</strong></a>')).toBe(
			"Accept (https://example.com)",
		);
	});

	test("turns an explicit break into a single newline", () => {
		expect(htmlToText("One<br />Two")).toBe("One\nTwo");
	});

	test("drops the document head, styles, and scripts", () => {
		let html = "<head><title>T</title><style>p{color:red}</style></head><body><p>Hi</p></body>";
		expect(htmlToText(html)).toBe("Hi");
	});

	test("drops a hidden preheader so the text part does not repeat it", () => {
		let html = '<div style="display:none;max-height:0;">Preview copy</div><p>Body copy</p>';
		expect(htmlToText(html)).toBe("Body copy");
	});

	test("bullets list items and separates them with a single newline", () => {
		expect(htmlToText("<ul><li>One</li><li>Two</li></ul>")).toBe("- One\n- Two");
	});

	test("reads a table row as a line rather than a paragraph", () => {
		let html = "<table><tbody><tr><td>One</td></tr><tr><td>Two</td></tr></tbody></table>";
		expect(htmlToText(html)).toBe("One\nTwo");
	});

	test("decodes named, decimal, and hexadecimal character references", () => {
		expect(htmlToText("<p>Ben &amp; Jerry&#39;s &#x2014; caf&eacute;</p>")).toBe(
			"Ben & Jerry's — caf&eacute;",
		);
	});

	test("does not treat escaped markup as a tag", () => {
		expect(htmlToText("<p>&lt;script&gt;</p>")).toBe("<script>");
	});

	test("collapses whitespace and runs of blank lines produced by nested layout", () => {
		let html = "<div><div><p>  One  </p></div></div>\n\n\n<div><p>Two</p></div>";
		expect(htmlToText(html)).toBe("One\n\nTwo");
	});

	test("returns an empty string for markup with no readable content", () => {
		expect(htmlToText("<head><style>p{}</style></head>")).toBe("");
	});

	test("drops comments, the doctype, and elements marked to skip in text", () => {
		let html =
			'<!DOCTYPE html><!-- note --><hr data-skip-in-text /><img data-skip-in-text alt="Logo">' +
			"<div data-skip-in-text>Spacer</div><p>Body<!-- inline -->copy</p>";
		expect(htmlToText(html)).toBe("Bodycopy");
	});

	test("leaves no tag or comment behind when removing one would join its neighbours", () => {
		let html =
			"<p>a<scr<script>x</script>ipt>alert(1)</script>b</p><!<!-- x -->-- c --><scrip<b>t>d";
		let text = htmlToText(html);
		expect(text).toBe("axipt>alert(1)b\n\n-- c -->t>d");
		expect(text).not.toMatch(/<script|<!--/i);
	});

	test("converts many unclosed comments and tags in linear time", () => {
		let started = performance.now();
		expect(htmlToText("<!--".repeat(50_000))).toBe("");
		expect(htmlToText(`${"<script>".repeat(50_000)}x`)).toBe("x");
		expect(performance.now() - started).toBeLessThan(1000);
	});
});
