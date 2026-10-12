/**
 * Tests for the share text of notes and TILs: the content X receives is the Markdown made
 * plain with every link a bare URL, and the save-time check must refuse exactly the content
 * that would push `{content} {permalink}` past 280 on X.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	checkShort,
	ShareTextOverflow,
	shortBudget,
	shortContent,
	shortIntent,
	shortShareText,
	X_LIMIT,
	xLength,
} from "~/app/services/share";

/** A note permalink as the CMS builds them. */
const PERMALINK = "https://sergiodxa.com/notes/t1a2b3";

describe("shortBudget", () => {
	test("leaves 256 for a note and 252 for a TIL", () => {
		expect(shortBudget("note")).toBe(256);
		expect(shortBudget("til")).toBe(252);
	});
});

describe("shortContent", () => {
	test("posts a link as its bare URL, whatever its text", () => {
		let content = "Read [the Remix docs](https://remix.run/docs) today.";
		expect(shortContent(content)).toBe("Read https://remix.run/docs today.");
	});

	test("posts a root-relative link on the site's origin", () => {
		expect(shortContent("See [this](/articles/x).")).toBe("See https://sergiodxa.com/articles/x.");
	});

	test("drops the Markdown around prose and keeps paragraphs apart", () => {
		expect(shortContent("Some **bold** and `code`.\n\nSecond.")).toBe(
			"Some bold and code.\n\nSecond.",
		);
	});
});

describe("checkShort", () => {
	test("accepts content that fills the budget exactly", () => {
		let checked = checkShort({ kind: "note", content: "a".repeat(256) });
		expect(isSuccess(checked) && checked.data).toBe(0);
	});

	test("rejects content past the budget, naming how much to cut", () => {
		let checked = checkShort({ kind: "til", content: "a".repeat(260) });
		expect(isFailure(checked)).toBe(true);
		if (!isFailure(checked)) return;
		expect(checked.error).toBeInstanceOf(ShareTextOverflow);
		expect(checked.error.field).toBe("content");
		expect(checked.error.over).toBe(8);
	});

	test("weighs a link 23 however long its Markdown is", () => {
		let link = `[a long link text](https://example.com/${"x".repeat(300)})`;
		let checked = checkShort({ kind: "note", content: `${"a".repeat(232)} ${link}` });
		expect(isSuccess(checked) && checked.data).toBe(0);
	});
});

describe("shortShareText", () => {
	test("is the content, a space and the permalink for a note", () => {
		let text = shortShareText({
			kind: "note",
			content: "Hello [you](https://x.com)",
			permalink: PERMALINK,
		});
		expect(text).toBe(`Hello https://x.com ${PERMALINK}`);
	});

	test("opens a TIL with TIL", () => {
		let text = shortShareText({ kind: "til", content: "about `x`", permalink: PERMALINK });
		expect(text).toBe(`TIL about x ${PERMALINK}`);
	});

	test("fits X once the content passed the check", () => {
		let content = "a".repeat(252);
		expect(isSuccess(checkShort({ kind: "til", content }))).toBe(true);
		expect(xLength(shortShareText({ kind: "til", content, permalink: PERMALINK }))).toBe(X_LIMIT);
	});

	test("opens X's composer with the share text", () => {
		let href = shortIntent({ kind: "note", content: "Hi", permalink: PERMALINK });
		expect(href).toBe(`https://x.com/intent/post?text=${encodeURIComponent(`Hi ${PERMALINK}`)}`);
	});
});
