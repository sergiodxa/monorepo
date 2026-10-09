/**
 * Exercises robots.txt reading, writing and evaluation against RFC 9309: its own §5 examples,
 * group selection and merging, longest-match with `*` and `$`, percent-encoding normalization,
 * line endings and the parsing limit, plus the ported Google conformance cases.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { GOOGLE_CASES } from "./fixtures/google-robotstxt.js";

import type { Robots } from "./index.js";

import { crawlDelay, isAllowed, parse, productToken, robotsUrl, stringify } from "./index.js";

/** RFC 9309 §5.1, verbatim. */
const RFC_SIMPLE = `User-Agent: *
Disallow: *.gif$
Disallow: /example/
Allow: /publications/

User-Agent: foobot
Disallow:/
Allow:/example/page.html
Allow:/example/allowed.gif

User-Agent: barbot
User-Agent: bazbot
Disallow: /example/page.html

User-Agent: quxbot

EOF
`;

/** RFC 9309 §5.2, verbatim. */
const RFC_LONGEST = `User-Agent: foobot
Allow: /example/page/
Disallow: /example/page/disallowed.gif
`;

/** Whether an agent may fetch a URL under a robots.txt given as text. */
function allowed(source: string, userAgent: string, url: string) {
	return isAllowed(parse(source), userAgent, url);
}

describe("RFC 9309 §5 examples", () => {
	test("5.1: the wildcard group refuses .gif files and /example/, and allows /publications/", () => {
		expect(allowed(RFC_SIMPLE, "OtherBot", "https://example.com/image.gif")).toBe(false);
		expect(allowed(RFC_SIMPLE, "OtherBot", "https://example.com/a/b/image.gif")).toBe(false);
		expect(allowed(RFC_SIMPLE, "OtherBot", "https://example.com/image.gif?x")).toBe(true);
		expect(allowed(RFC_SIMPLE, "OtherBot", "https://example.com/example/x")).toBe(false);
		expect(allowed(RFC_SIMPLE, "OtherBot", "https://example.com/publications/x")).toBe(true);
		expect(allowed(RFC_SIMPLE, "OtherBot", "https://example.com/elsewhere")).toBe(true);
	});

	test("5.1: foobot reaches only its two allowed paths", () => {
		expect(allowed(RFC_SIMPLE, "foobot", "https://example.com/example/page.html")).toBe(true);
		expect(allowed(RFC_SIMPLE, "foobot", "https://example.com/example/allowed.gif")).toBe(true);
		expect(allowed(RFC_SIMPLE, "foobot", "https://example.com/publications/")).toBe(false);
		expect(allowed(RFC_SIMPLE, "foobot", "https://example.com/")).toBe(false);
	});

	test("5.1: barbot and bazbot share one group", () => {
		for (let agent of ["barbot", "bazbot"]) {
			expect(allowed(RFC_SIMPLE, agent, "https://example.com/example/page.html")).toBe(false);
			expect(allowed(RFC_SIMPLE, agent, "https://example.com/example/other.gif")).toBe(true);
		}
	});

	test("5.1: quxbot's empty group allows everything, ignoring the wildcard group", () => {
		expect(allowed(RFC_SIMPLE, "quxbot", "https://example.com/example/x.gif")).toBe(true);
	});

	test("5.2: the longest matching rule decides", () => {
		expect(allowed(RFC_LONGEST, "foobot", "https://example.com/example/page/")).toBe(true);
		expect(allowed(RFC_LONGEST, "foobot", "https://example.com/example/page/disallowed.gif")).toBe(
			false,
		);
	});
});

describe("Google's robots.txt conformance cases", () => {
	for (let testCase of GOOGLE_CASES) {
		test(testCase.name, () => {
			let document = parse(testCase.robotstxt);
			for (let [agent, url, expected] of testCase.expectations) {
				expect([agent, url, isAllowed(document, agent, url)]).toEqual([agent, url, expected]);
			}
		});
	}
});

describe(productToken, () => {
	test.each([
		["SergioReader/1.0 (+https://sergiodxa.com/bot)", "sergioreader"],
		["ExampleBot", "examplebot"],
		["Googlebot-Image/1.0", "googlebot-image"],
		["foo_bar baz", "foo_bar"],
		["  PaddedBot/2", "paddedbot"],
		["*", "*"],
		["", ""],
	])("reduces %j to %j", (userAgent, token) => {
		expect(productToken(userAgent)).toBe(token);
	});
});

describe("choosing groups", () => {
	test("merges every group naming the same agent (§2.2.1, figure 2)", () => {
		let source = `user-agent: ExampleBot
disallow: /foo
disallow: /bar

user-agent: ExampleBot
disallow: /baz
`;

		for (let path of ["/foo", "/bar", "/baz"]) {
			expect(allowed(source, "ExampleBot/0.1", `https://example.com${path}`)).toBe(false);
		}
		expect(allowed(source, "ExampleBot", "https://example.com/qux")).toBe(true);
	});

	test("falls back to the wildcard group when none names the agent (figure 3)", () => {
		let source = "user-agent: *\ndisallow: /foo\n\nuser-agent: BazBot\ndisallow: /baz\n";

		expect(allowed(source, "ExampleBot", "https://example.com/foo")).toBe(false);
		expect(allowed(source, "ExampleBot", "https://example.com/baz")).toBe(true);
	});

	test("matches a user-agent line by its product token, ignoring a version suffix", () => {
		let source = "User-agent: ExampleBot/2.0\nDisallow: /\n";
		expect(allowed(source, "examplebot", "https://example.com/")).toBe(false);
	});
});

describe("matching", () => {
	test("always allows /robots.txt itself", () => {
		let document = parse("User-agent: *\nDisallow: /\n");
		expect(isAllowed(document, "AnyBot", "https://example.com/robots.txt")).toBe(true);
		expect(isAllowed(document, "AnyBot", "https://example.com/robots.txt.bak")).toBe(false);
	});

	test("reads a path-only string as the path to match", () => {
		let document = parse("User-agent: *\nDisallow: /private\n");
		expect(isAllowed(document, "AnyBot", "/private/x")).toBe(false);
		expect(isAllowed(document, "AnyBot", new URL("https://example.com/public"))).toBe(true);
	});

	test("ignores the fragment", () => {
		let document = parse("User-agent: *\nDisallow: /a$\n");
		expect(isAllowed(document, "AnyBot", "https://example.com/a#section")).toBe(false);
	});

	test("matches a literal star or dollar through its percent-encoding (figure 6)", () => {
		let document = parse(
			"User-agent: *\nDisallow: /path/file-with-a-%2A.html\nDisallow: /path/foo-%24\n",
		);

		expect(isAllowed(document, "AnyBot", "https://example.com/path/file-with-a-*.html")).toBe(
			false,
		);
		expect(isAllowed(document, "AnyBot", "https://example.com/path/foo-$")).toBe(false);
		expect(isAllowed(document, "AnyBot", "https://example.com/path/foo-x")).toBe(true);
	});

	test("normalizes percent-encoding in both the pattern and the path (figure 4)", () => {
		let document = parse("User-agent: *\nDisallow: /foo/bar/ツ\nDisallow: /qux/%62%61%7A\n");

		expect(isAllowed(document, "AnyBot", "https://example.com/foo/bar/%E3%83%84")).toBe(false);
		expect(isAllowed(document, "AnyBot", "https://example.com/foo/bar/%e3%83%84")).toBe(false);
		expect(isAllowed(document, "AnyBot", "https://example.com/foo/bar/ツ")).toBe(false);
		expect(isAllowed(document, "AnyBot", "https://example.com/qux/baz")).toBe(false);
		expect(isAllowed(document, "AnyBot", "https://example.com/qux/%62%61%7A")).toBe(false);
	});

	test("keeps a percent-encoded reserved character distinct from the character", () => {
		let document = parse("User-agent: *\nDisallow: /a%2Fb\n");

		expect(isAllowed(document, "AnyBot", "https://example.com/a%2fb")).toBe(false);
		expect(isAllowed(document, "AnyBot", "https://example.com/a/b")).toBe(true);
	});

	test("stays fast on a pattern full of stars against a long path", () => {
		let document = parse(`User-agent: *\nDisallow: /${"*a".repeat(200)}b$\n`);
		let started = performance.now();

		expect(isAllowed(document, "AnyBot", `https://example.com/${"a".repeat(5_000)}`)).toBe(true);
		expect(performance.now() - started).toBeLessThan(1_000);
	});
});

describe(parse, () => {
	test("trims long runs of spaces and tabs in linear time", () => {
		let started = performance.now();
		let padding = "\t".repeat(50_000);
		let document = parse(`User-agent: *\nDisallow:${padding}/private${padding}x\n${padding}\n`);
		expect(document.groups[0]?.rules).toEqual([{ allow: false, pattern: `/private${padding}x` }]);
		expect(performance.now() - started).toBeLessThan(500);
	});

	test("reads groups, rules, sitemaps and other records", () => {
		let document = parse(`# comment
User-agent: FooBot
User-agent: BarBot # trailing comment
Disallow: /private
Allow: /private/public
Crawl-delay: 2.5
Content-Signal: search=yes, ai-input=yes, ai-train=no

Sitemap: https://example.com/sitemap.xml
Host: example.com
`);

		expect(document).toEqual<Robots.Document>({
			groups: [
				{
					userAgents: ["FooBot", "BarBot"],
					rules: [
						{ allow: false, pattern: "/private" },
						{ allow: true, pattern: "/private/public" },
					],
					crawlDelay: 2.5,
					contentSignals: { search: true, "ai-input": true, "ai-train": false },
				},
			],
			sitemaps: ["https://example.com/sitemap.xml"],
			records: [{ name: "host", value: "example.com" }],
		});
	});

	test("keeps an empty Disallow, the classic allow-all, as a rule", () => {
		expect(parse("User-agent: *\nDisallow:\n").groups[0]?.rules).toEqual([
			{ allow: false, pattern: "" },
		]);
	});

	test("drops rules outside any group", () => {
		expect(parse("Disallow: /\nUser-agent: *\nAllow: /x\n").groups).toEqual([
			{ userAgents: ["*"], rules: [{ allow: true, pattern: "/x" }] },
		]);
	});

	test("keeps a group open across a sitemap or unknown record (§2.2.4)", () => {
		let document = parse("User-agent: a\nSitemap: https://x/s.xml\nUser-agent: b\nDisallow: /\n");
		expect(document.groups).toHaveLength(1);
		expect(document.groups[0]?.userAgents).toEqual(["a", "b"]);
	});

	test.each([
		["LF", "\n"],
		["CRLF", "\r\n"],
		["CR", "\r"],
	])("reads %s line ends", (_name, eol) => {
		let source = [
			"User-Agent: foo",
			"Allow: /some/path",
			"User-Agent: bar",
			"",
			"",
			"Disallow: /",
		].join(eol);
		let document = parse(source);

		expect(document.groups.map((group) => group.userAgents)).toEqual([["foo"], ["bar"]]);
		expect(document.groups[1]?.rules).toEqual([{ allow: false, pattern: "/" }]);
	});

	test("drops a leading byte order mark", () => {
		let document = parse("﻿User-Agent: foo\nAllow: /AnyValue\n");
		expect(document.groups).toEqual([
			{ userAgents: ["foo"], rules: [{ allow: true, pattern: "/AnyValue" }] },
		]);
	});

	test("reads a byte order mark in the middle of the file as a broken line", () => {
		let document = parse("User-Agent: foo\n﻿Allow: /AnyValue\n");
		expect(document.groups[0]?.rules).toEqual([]);
		expect(document.records).toHaveLength(1);
	});

	test("reads a file of HTML as a document with no groups", () => {
		let document = parse("<!doctype html><html><body>Not found</body></html>");
		expect(document).toEqual({ groups: [], sitemaps: [], records: [] });
		expect(isAllowed(document, "AnyBot", "https://example.com/x")).toBe(true);
	});

	test("reads a sitemap anywhere in the file", () => {
		let document = parse(
			"Sitemap: https://x/1.xml\nUser-agent: *\nDisallow: /\nSitemap: https://x/2.xml\n",
		);
		expect(document.sitemaps).toEqual(["https://x/1.xml", "https://x/2.xml"]);
	});

	test("lets the last Crawl-delay of a group win and skips one that is not a number", () => {
		let document = parse("User-agent: *\nCrawl-delay: 5\nCrawl-delay: 10\nCrawl-delay: soon\n");
		expect(document.groups[0]?.crawlDelay).toBe(10);
	});

	test("parses the whole lines within 500 KiB and ignores the rest (§2.5)", () => {
		let filler = `# ${"x".repeat(98)}\n`.repeat(5_119);
		let head = "User-agent: *\nDisallow: /early\n";
		let source = `${head}${filler}Disallow: /late\nDisallow: /later\n`;

		let document = parse(source);
		expect(
			new TextEncoder().encode(`${head}${filler}Disallow: /late\n`).byteLength,
		).toBeGreaterThan(512_000);
		expect(document.groups[0]?.rules).toEqual([{ allow: false, pattern: "/early" }]);
	});

	test("honours a custom maxBytes, cutting at the last line boundary within it", () => {
		let document = parse("User-agent: *\nDisallow: /a\nDisallow: /bcdef\n", { maxBytes: 30 });
		expect(document.groups[0]?.rules).toEqual([{ allow: false, pattern: "/a" }]);
	});
});

describe(stringify, () => {
	test("writes groups, then sitemaps, then other records, with LF line ends", () => {
		let text = stringify({
			groups: [
				{
					userAgents: ["*"],
					rules: [
						{ allow: true, pattern: "/" },
						{ allow: false, pattern: "/cms" },
					],
				},
				{
					userAgents: ["GPTBot", "CCBot"],
					rules: [{ allow: false, pattern: "/" }],
					crawlDelay: 10,
					contentSignals: { search: true, "ai-train": false },
				},
			],
			sitemaps: ["https://example.com/sitemap.xml"],
			records: [{ name: "host", value: "example.com" }],
		});

		expect(text).toBe(`User-agent: *
Allow: /
Disallow: /cms

User-agent: GPTBot
User-agent: CCBot
Disallow: /
Crawl-delay: 10
Content-Signal: search=yes, ai-train=no

Sitemap: https://example.com/sitemap.xml

Host: example.com
`);
	});

	test("writes an empty document as an empty string", () => {
		expect(stringify({ groups: [], sitemaps: [], records: [] })).toBe("");
	});

	test("round-trips what it writes", () => {
		let document: Robots.Document = {
			groups: [
				{
					userAgents: ["*"],
					rules: [{ allow: false, pattern: "" }],
					crawlDelay: 1.5,
					contentSignals: { search: true, "ai-input": false, "ai-train": false },
				},
				{ userAgents: ["FooBot"], rules: [{ allow: false, pattern: "/*.pdf$" }] },
			],
			sitemaps: ["https://example.com/a.xml", "https://example.com/b.xml"],
			records: [{ name: "host", value: "example.com" }],
		};

		expect(parse(stringify(document))).toEqual(document);
	});

	test("round-trips a group-scoped record that came before every group", () => {
		let document = parse("Crawl-delay: 3\nUser-agent: *\nDisallow: /x\n");
		expect(document.records).toEqual([{ name: "crawl-delay", value: "3" }]);
		expect(parse(stringify(document))).toEqual(document);
	});
});

describe(crawlDelay, () => {
	let document = parse(
		"User-agent: *\nCrawl-delay: 1\n\nUser-agent: SlowBot\nCrawl-delay: 30\nDisallow: /x\n",
	);

	test("reads the delay of the agent's own group", () => {
		expect(crawlDelay(document, "SlowBot/1.0")).toBe(30);
	});

	test("falls back to the wildcard group", () => {
		expect(crawlDelay(document, "OtherBot")).toBe(1);
	});

	test("answers undefined where no applicable group sets one", () => {
		expect(crawlDelay(parse("User-agent: *\nDisallow: /\n"), "OtherBot")).toBeUndefined();
	});
});

describe(robotsUrl, () => {
	test("answers the origin's /robots.txt for any URL on it", () => {
		expect(robotsUrl("https://example.com:8443/a/b?c#d")).toBe(
			"https://example.com:8443/robots.txt",
		);
		expect(robotsUrl(new URL("http://www.example.com/"))).toBe("http://www.example.com/robots.txt");
	});

	test("answers null for text that is not a URL, or a URL with no origin", () => {
		expect(robotsUrl("not a url")).toBeNull();
		expect(robotsUrl("data:text/plain,hi")).toBeNull();
	});
});
