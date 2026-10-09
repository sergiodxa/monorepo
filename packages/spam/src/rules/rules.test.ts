/**
 * Tests each built-in rule on its own, including the boundaries its options set and the
 * legitimate shapes it must leave alone, so a weight change is caught by the rule it touches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Signal, SpamCheck, Submission } from "../check.js";

import {
	authorName,
	contactBait,
	language,
	links,
	linkSyntax,
	linkTargets,
	shouting,
	timing,
	unicode,
} from "./index.js";

/** The signal identifiers a local rule emits for `submission`. */
function fired(rule: SpamCheck, submission: Submission): string[] {
	let answer = rule.check(submission, {
		signal: new AbortController().signal,
		score: 0,
		signals: [],
	});
	if (!Array.isArray(answer)) throw new TypeError("local rules answer synchronously");
	return (answer as Signal[]).map((signal) => signal.check);
}

/** A submission rendered at a fixed time and sent `seconds` later. */
function sentAfter(seconds: number): Submission {
	let renderedAt = new Date("2026-09-28T12:00:00Z");
	return {
		content: "hello",
		renderedAt,
		submittedAt: new Date(renderedAt.getTime() + seconds * 1000),
	};
}

describe("timing", () => {
	test("scores nothing without a render time", () => {
		expect(fired(timing(), { content: "hello" })).toEqual([]);
	});

	test.each([
		[1, ["timing.fast"]],
		[3, []],
		[-5, ["timing.future"]],
		[86_401, ["timing.stale"]],
	] as const)("a submission after %ds fires %j", (seconds, expected) => {
		expect(fired(timing(), sentAfter(seconds))).toEqual(expected);
	});

	test("reads minSeconds from its options", () => {
		expect(fired(timing({ minSeconds: 10 }), sentAfter(5))).toEqual(["timing.fast"]);
	});
});

describe("links", () => {
	test("allows one link", () => {
		expect(fired(links(), { content: "see https://example.com for details" })).toEqual([]);
	});

	test("counts duplicate links once", () => {
		expect(fired(links(), { content: "https://a.example https://a.example" })).toEqual([]);
	});

	test("scores extra links and link-heavy text", () => {
		let content = "go https://a.example https://b.example https://c.example";
		expect(fired(links(), { content })).toEqual(["links.count", "links.density"]);
	});

	test("caps the count score", () => {
		let content = Array.from({ length: 30 }, (_, i) => `https://${i}.example`).join(" ");
		let answer = links().check(
			{ content },
			{ signal: new AbortController().signal, score: 0, signals: [] },
		);
		expect((answer as Signal[])[0]?.score).toBe(10);
	});
});

describe("linkSyntax", () => {
	test("scores BBCode in every format", () => {
		for (let format of ["text", "markdown", "html"] as const) {
			expect(fired(linkSyntax(), { content: "[url=https://x.example]x[/url]", format })).toEqual([
				"link-syntax.bbcode",
			]);
		}
	});

	test("scores HTML anchors outside an HTML field", () => {
		let content = '<a href="https://x.example">x</a>';
		expect(fired(linkSyntax(), { content })).toEqual(["link-syntax.html"]);
		expect(fired(linkSyntax(), { content, format: "html" })).toEqual([]);
	});

	test("scores Markdown links only in a text field", () => {
		let content = "[docs](https://x.example)";
		expect(fired(linkSyntax(), { content })).toEqual(["link-syntax.markdown"]);
		expect(fired(linkSyntax(), { content, format: "markdown" })).toEqual([]);
	});

	test.each([
		["[URL]https://x.example[/URL]", ["link-syntax.bbcode"]],
		["[url=https://x.example", []],
		['<A\tclass="x" HREF = "https://x.example">x</A>', ["link-syntax.html"]],
		['<a class="x">x</a> href="https://x.example"', []],
		["[a [b](https://x.example)", ["link-syntax.markdown"]],
		["[](https://x.example)", []],
		["[docs] (https://x.example)", []],
	])("reads %j as its markup", (content, expected) => {
		expect(fired(linkSyntax(), { content })).toEqual(expected);
	});

	test.each([
		["[url=".repeat(50_000), []],
		["<a\t".repeat(50_000), []],
		["[".repeat(50_000), []],
		[`${"<a\t".repeat(50_000)}href=`, ["link-syntax.html"]],
		[`${"[".repeat(50_000)}](https://x.example)`, ["link-syntax.markdown"]],
	])("scans a long run of unclosed markup in linear time (case %#)", (content, expected) => {
		let started = performance.now();
		expect(fired(linkSyntax(), { content })).toEqual(expected);
		expect(performance.now() - started).toBeLessThan(1_000);
	});
});

describe("linkTargets", () => {
	test.each([
		["https://bit.ly/abc", "link-targets.shortener"],
		["http://203.0.113.9/x", "link-targets.ip-address"],
		["http://[2001:db8::1]/x", "link-targets.ip-address"],
		["https://xn--pypal-4ve.com", "link-targets.punycode"],
		["https://pаypal.com", "link-targets.punycode"],
		["https://deals.xyz", "link-targets.abused-tld"],
	])("%s fires %s", (url, expected) => {
		expect(fired(linkTargets(), { content: `visit ${url}` })).toEqual([expected]);
	});

	test("checks the author's URL", () => {
		expect(fired(linkTargets(), { content: "hi", author: { url: "https://bit.ly/x" } })).toEqual([
			"link-targets.shortener",
		]);
	});

	test("leaves an ordinary domain alone", () => {
		expect(fired(linkTargets(), { content: "https://developer.mozilla.org/en-US/" })).toEqual([]);
	});

	test("caps its total", () => {
		let content = Array.from({ length: 10 }, (_, i) => `https://bit.ly/${i}`).join(" ");
		let answer = linkTargets().check(
			{ content },
			{ signal: new AbortController().signal, score: 0, signals: [] },
		);
		let total = (answer as Signal[]).reduce((sum, signal) => sum + signal.score, 0);
		expect(total).toBe(12);
	});
});

describe("unicode", () => {
	test("scores a word mixing Latin and Cyrillic", () => {
		expect(fired(unicode(), { content: "log in to Pаypal" })).toEqual(["unicode.mixed-script"]);
	});

	test("leaves separate Latin and Cyrillic words alone", () => {
		expect(fired(unicode(), { content: "Привет, Paypal" })).toEqual([]);
	});

	test("scores a zero-width space inside a word", () => {
		expect(fired(unicode(), { content: "via​gra" })).toEqual(["unicode.hidden"]);
	});

	test("leaves the joiner inside an emoji sequence alone", () => {
		expect(fired(unicode(), { content: "family 👨‍👩‍👧" })).toEqual([]);
	});

	test("leaves a Persian non-joiner alone", () => {
		expect(fired(unicode(), { content: "می‌خواهم" })).toEqual([]);
	});

	test("scores styled letters from three on", () => {
		expect(fired(unicode(), { content: "𝗙𝗥" })).toEqual([]);
		expect(fired(unicode(), { content: "𝗙𝗥𝗘𝗘" })).toEqual(["unicode.styled"]);
		expect(fired(unicode(), { content: "ＦＲＥＥ" })).toEqual(["unicode.styled"]);
	});

	test("scores stacked combining marks", () => {
		expect(fired(unicode(), { content: "hé̂̃̄̅llo" })).toEqual(["unicode.mark-stack"]);
	});
});

describe("contactBait", () => {
	test.each([
		["message me at t.me/dealer", "contact-bait.messaging"],
		["Telegram @fast_money", "contact-bait.messaging"],
		["WhatsApp +44 7700 900123", "contact-bait.messaging"],
		["send to 0x52908400098527886E0F7030069857D2E4169EE7", "contact-bait.wallet"],
		["send to bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "contact-bait.wallet"],
	])("%s fires %s", (content, expected) => {
		expect(fired(contactBait(), { content })).toContain(expected);
	});

	test("scores an international phone number", () => {
		expect(fired(contactBait(), { content: "call +1 415 555 0134" })).toEqual([
			"contact-bait.phone",
		]);
	});

	test("leaves order numbers and prices alone", () => {
		expect(fired(contactBait(), { content: "Order 48213 cost $1,250.00 on 2026-09-28" })).toEqual(
			[],
		);
	});
});

describe("shouting", () => {
	test("scores long text in capitals, but not a short word", () => {
		expect(fired(shouting(), { content: "OK THANKS" })).toEqual([]);
		expect(fired(shouting(), { content: "THIS IS THE BEST OFFER YOU WILL EVER SEE" })).toEqual([
			"shouting.caps",
		]);
	});

	test("scores a run of one character from six on", () => {
		expect(fired(shouting(), { content: "wow!!!!!" })).toEqual([]);
		expect(fired(shouting(), { content: "wow!!!!!!" })).toEqual(["shouting.run"]);
	});

	test("scores a phrase said three times", () => {
		let content = "buy now today buy now today buy now today";
		expect(fired(shouting(), { content })).toEqual(["shouting.repetition"]);
	});

	test("scores emoji outnumbering words", () => {
		expect(fired(shouting(), { content: "🔥💰🚀✅🔥💰🚀✅ wow" })).toEqual(["shouting.emoji"]);
		expect(fired(shouting(), { content: "Congrats on the launch 🎉🎉" })).toEqual([]);
	});
});

describe("language", () => {
	let russian = "Продвижение сайтов в топ поисковых систем недорого";

	test("scores nothing without expected languages", () => {
		expect(fired(language(), { content: russian })).toEqual([]);
	});

	test("scores content in a script none of the site's languages use", () => {
		expect(fired(language(), { content: russian, languages: ["en"] })).toEqual(["language.script"]);
		expect(fired(language(), { content: russian, languages: ["en", "ru"] })).toEqual([]);
	});

	test("reads the script of a region-qualified tag", () => {
		expect(fired(language(), { content: russian, languages: ["sr-Cyrl"] })).toEqual([]);
	});

	test("expects kana and kanji for Japanese", () => {
		expect(
			fired(language(), {
				content: "とても分かりやすい記事でした。ありがとうございます。",
				languages: ["ja"],
			}),
		).toEqual([]);
	});

	test("skips a tag it cannot resolve to a known script", () => {
		expect(fired(language(), { content: russian, languages: ["not a tag"] })).toEqual([]);
	});

	test("skips short content", () => {
		expect(fired(language(), { content: "Привет", languages: ["en"] })).toEqual([]);
	});
});

describe("authorName", () => {
	test("leaves ordinary names alone", () => {
		for (let name of ["Dana Whitfield", "Priya N.", "José María de la Cruz"]) {
			expect(fired(authorName(), { content: "hi", author: { name } })).toEqual([]);
		}
	});

	test("scores a domain and a keyword list", () => {
		let name = "Best Online Casino Bonus 2026 casino.example";
		expect(fired(authorName(), { content: "hi", author: { name } })).toEqual([
			"author-name.domain",
			"author-name.length",
		]);
	});
});
