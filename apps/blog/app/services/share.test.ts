/**
 * Tests for the X share text: the weighting has to match X's own count, since a text the CMS
 * accepts that X then rejects leaves the author trimming in the composer, and the builders
 * have to keep a typed teaser exact while shortening a standing-in excerpt.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	checkTeaser,
	discussIntent,
	postIntent,
	postShareText,
	releaseShareText,
	ShareTextOverflow,
	shareIntent,
	teaserBudget,
	X_LIMIT,
	xLength,
} from "~/app/services/share";

/** A permalink as the CMS builds them. */
const PERMALINK = "https://sergiodxa.com/articles/hello-world";

describe("xLength", () => {
	test("counts Latin text, punctuation and line breaks 1 per character", () => {
		expect(xLength("Hello, world!\n")).toBe(14);
		expect(xLength("“quoted” — ‘text’")).toBe(17);
	});

	test("counts the ellipsis 2, since it sits past X's light punctuation range", () => {
		expect(xLength("…")).toBe(2);
	});

	test("counts CJK and other text outside the light ranges 2 per character", () => {
		expect(xLength("日本語")).toBe(6);
		expect(xLength("a→b")).toBe(4);
	});

	test("counts any URL as 23, whatever its length", () => {
		expect(xLength("https://x.co")).toBe(23);
		expect(xLength(`read ${PERMALINK}`)).toBe(28);
		expect(xLength(`http://example.com/${"a".repeat(100)}`)).toBe(23);
	});

	test("leaves sentence punctuation after a URL out of the link", () => {
		expect(xLength(`(see ${PERMALINK}).`)).toBe(1 + 4 + 23 + 2);
	});

	test("counts an emoji sequence 2 once", () => {
		expect(xLength("📝")).toBe(2);
		expect(xLength("🛠️")).toBe(2);
		expect(xLength("👩‍💻")).toBe(2);
		expect(xLength("👍🏽")).toBe(2);
		expect(xLength("🇦🇷")).toBe(2);
	});

	test("reads text NFC-normalized, so a decomposed accent counts once", () => {
		expect(xLength("é")).toBe(1);
	});
});

describe("teaserBudget", () => {
	test("is 250 minus the title's weight", () => {
		expect(teaserBudget({ kind: "article", title: "Hello" })).toBe(245);
		expect(teaserBudget({ kind: "tutorial", title: "日本" })).toBe(246);
	});

	test("reaches zero or less for a title that leaves no room", () => {
		expect(teaserBudget({ kind: "article", title: "a".repeat(250) })).toBe(0);
		expect(teaserBudget({ kind: "article", title: "a".repeat(260) })).toBe(-10);
	});
});

describe("postShareText", () => {
	test("puts the emoji and title, the teaser and the permalink on their own lines", () => {
		let built = postShareText({
			kind: "article",
			title: "Hello world",
			teaser: "Why I wrote this",
			excerpt: "Ignored",
			permalink: PERMALINK,
		});
		expect(built).toEqual({
			status: "success",
			data: `📝 Hello world\n\nWhy I wrote this\n\n${PERMALINK}`,
		});
	});

	test("opens a tutorial with its own emoji", () => {
		let built = postShareText({ kind: "tutorial", title: "T", teaser: "x", permalink: PERMALINK });
		expect(isSuccess(built) && built.data.startsWith("🛠️ T\n\n")).toBe(true);
	});

	test("accepts a teaser that fills the budget exactly", () => {
		let title = "Hello";
		let teaser = "a".repeat(teaserBudget({ kind: "article", title }));
		let built = postShareText({ kind: "article", title, teaser, permalink: PERMALINK });
		expect(isSuccess(built) && xLength(built.data)).toBe(X_LIMIT);
	});

	test("rejects a typed teaser past the budget, naming how much to cut", () => {
		let title = "Hello";
		let teaser = "a".repeat(teaserBudget({ kind: "article", title }) + 7);
		let built = postShareText({ kind: "article", title, teaser, permalink: PERMALINK });
		expect(isFailure(built)).toBe(true);
		if (!isFailure(built)) return;
		expect(built.error).toBeInstanceOf(ShareTextOverflow);
		expect(built.error.field).toBe("teaser");
		expect(built.error.over).toBe(7);
	});

	test("lets the excerpt stand in for a blank teaser", () => {
		let built = postShareText({
			kind: "article",
			title: "Hello",
			teaser: "  ",
			excerpt: "A short\nexcerpt",
			permalink: PERMALINK,
		});
		expect(built).toEqual({
			status: "success",
			data: `📝 Hello\n\nA short excerpt\n\n${PERMALINK}`,
		});
	});

	test("shortens a long excerpt with an ellipsis to fit, never failing", () => {
		let excerpt = "word ".repeat(100);
		let built = postShareText({ kind: "article", title: "Hello", excerpt, permalink: PERMALINK });
		expect(isSuccess(built)).toBe(true);
		if (!isSuccess(built)) return;
		expect(xLength(built.data)).toBeLessThanOrEqual(X_LIMIT);
		expect(built.data).toContain(" word…\n\n");
	});

	test("cuts a single overlong word mid-word when no word boundary fits", () => {
		let excerpt = "a".repeat(400);
		let built = postShareText({ kind: "article", title: "Hello", excerpt, permalink: PERMALINK });
		expect(isSuccess(built) && xLength(built.data)).toBe(X_LIMIT);
	});

	test("leaves the line out when there is no excerpt or no room for one", () => {
		let empty = postShareText({ kind: "article", title: "Hello", permalink: PERMALINK });
		expect(empty).toEqual({ status: "success", data: `📝 Hello\n\n${PERMALINK}` });

		let title = "a".repeat(250);
		let full = postShareText({ kind: "article", title, excerpt: "More", permalink: PERMALINK });
		expect(full).toEqual({ status: "success", data: `📝 ${title}\n\n${PERMALINK}` });
	});

	test("fails on the title when even the title alone is past the limit", () => {
		let built = postShareText({ kind: "article", title: "a".repeat(260), permalink: PERMALINK });
		expect(isFailure(built) && built.error.field).toBe("title");
	});
});

describe("checkTeaser", () => {
	test("passes a blank teaser and stores a fitting one on one line", () => {
		expect(checkTeaser({ kind: "article", title: "Hi", teaser: "" })).toEqual({
			status: "success",
			data: "",
		});
		expect(checkTeaser({ kind: "article", title: "Hi", teaser: " One\nline " })).toEqual({
			status: "success",
			data: "One line",
		});
	});

	test("re-runs against a changed title, so a longer title rejects the same teaser", () => {
		let teaser = "a".repeat(240);
		expect(isSuccess(checkTeaser({ kind: "article", title: "Short", teaser }))).toBe(true);

		let checked = checkTeaser({ kind: "article", title: "A much longer title", teaser });
		expect(isFailure(checked) && checked.error.over).toBe(9);
	});
});

describe("intents", () => {
	test("opens X's composer with the text percent-encoded", () => {
		expect(shareIntent("a b&c\n")).toBe("https://x.com/intent/post?text=a%20b%26c%0A");
	});

	test("builds the author's link from the share text, overflow included", () => {
		let post = { kind: "article" as const, title: "Hi", teaser: "Yo", permalink: PERMALINK };
		expect(postIntent(post)).toBe(shareIntent(`📝 Hi\n\nYo\n\n${PERMALINK}`));

		let long = { ...post, teaser: "a".repeat(300) };
		expect(postIntent(long)).toBe(shareIntent(`📝 Hi\n\n${"a".repeat(300)}\n\n${PERMALINK}`));
	});

	test("prefills a reader's link with the title and permalink only", () => {
		expect(discussIntent({ title: "Hello world", permalink: PERMALINK })).toBe(
			shareIntent(`Hello world ${PERMALINK}`),
		);
	});
});

describe("releaseShareText", () => {
	/** A releases post's permalink. */
	let permalink = "https://sergiodxa.com/releases/2026-w42";

	test("names one package, or every package joined with a final and", () => {
		expect(releaseShareText({ packages: ["remix-utils"], permalink })).toBe(
			`This week I released remix-utils ${permalink}`,
		);
		expect(
			releaseShareText({ packages: ["@sdxc/result", "remix-auth", "remix-utils"], permalink }),
		).toBe(`This week I released @sdxc/result, remix-auth and remix-utils ${permalink}`);
	});

	test("counts the packages past 280 as and N more, keeping the text within it", () => {
		let packages = Array.from({ length: 40 }, (_, index) => `@sdxc/package-${String(index)}`);
		let text = releaseShareText({ packages, permalink });

		expect(xLength(text)).toBeLessThanOrEqual(X_LIMIT);
		expect(text).toMatch(/^This week I released @sdxc\/package-0, .+ and \d+ more https:\/\//);
		let shown = text.split(", ").length;
		expect(text).toContain(` and ${String(packages.length - shown)} more `);
	});
});
