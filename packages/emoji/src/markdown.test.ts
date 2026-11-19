/**
 * Checks the markdown visitor expands Unicode shortcodes in text and leaves
 * code spans alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { emojis } from "./markdown.js";

import type { EmojiEntry } from "./index.js";

const CATALOG: EmojiEntry[] = [
	{ emoji: "🎉", shortcodes: ["tada"], category: "activities" },
	{ emoji: "😕", shortcodes: ["confused"], category: "smileys-emotion", emoticons: [":/"] },
	{
		shortcodes: ["blob"],
		src: "https://example.com/blob.png",
		category: "custom",
	},
];

describe("emojis visitor", () => {
	test("replaces shortcodes in text nodes", () => {
		let parsed = Markdown.parse("Ship it :tada:");
		if (isFailure(parsed)) throw parsed.error;
		let walked = Markdown.walk(parsed.data.document, emojis(CATALOG));
		if (isFailure(walked)) throw walked.error;
		let paragraph = walked.data.children[0];
		expect(paragraph).toMatchObject({ type: "paragraph" });
		if (paragraph?.type !== "paragraph") return;
		expect(paragraph.children).toMatchObject([{ type: "text", value: "Ship it 🎉" }]);
	});

	test("leaves inline code untouched", () => {
		let parsed = Markdown.parse("Use `:tada:` in docs");
		if (isFailure(parsed)) throw parsed.error;
		let walked = Markdown.walk(parsed.data.document, emojis(CATALOG));
		if (isFailure(walked)) throw walked.error;
		let paragraph = walked.data.children[0];
		if (paragraph?.type !== "paragraph") throw new Error("expected paragraph");
		expect(paragraph.children.some((child) => child.type === "inlineCode")).toBe(true);
		expect(JSON.stringify(paragraph.children)).toContain(":tada:");
	});

	test("leaves a bare URL's text as written", () => {
		expect(walkedText("Read https://example.com today :/")).toBe(
			"Read https://example.com today 😕",
		);
	});

	test("leaves a bracketed link's text as written", () => {
		expect(walkedText("[a:/b :tada: :/](https://example.com) :tada:")).toBe("a:/b :tada: :/ 🎉");
	});

	test("leaves an emoticon inside inline code as written", () => {
		expect(walkedText("Type `:/` for :/")).toBe("Type :/ for 😕");
	});
});

/** Walks `source` with the visitor and joins the first paragraph's text, link text and code. */
function walkedText(source: string): string {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) throw parsed.error;
	let walked = Markdown.walk(parsed.data.document, emojis(CATALOG));
	if (isFailure(walked)) throw walked.error;
	let paragraph = walked.data.children[0];
	if (paragraph?.type !== "paragraph") throw new Error("expected paragraph");
	return paragraph.children.map(inlineText).join("");
}

/** The characters an inline node shows, read through links. */
function inlineText(node: Markdown.Inline): string {
	if (node.type === "text" || node.type === "inlineCode") return node.value;
	if (node.type === "link") return node.children.map(inlineText).join("");
	return "";
}
