/**
 * Tests the docs search against the real pages: question words drop out, synonyms match,
 * every content word must appear, a result jumps to its best section, and highlights mark
 * exactly the matched words.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { highlightSegments, queryTerms, searchDocs, tokenize } from "./docs-search";

describe("queryTerms", () => {
	test("drops the question words around a question's subject", () => {
		expect(queryTerms("How do I get alerts on Slack?").map((terms) => terms[0])).toEqual([
			"get",
			"alerts",
			"slack",
		]);
	});

	test("widens a word to the words readers use for the same thing", () => {
		expect(queryTerms("check")[0]).toEqual(expect.arrayContaining(["check", "monitor"]));
	});

	test("keeps a query made only of question words", () => {
		expect(queryTerms("how").map((terms) => terms[0])).toEqual(["how"]);
	});
});

describe("tokenize", () => {
	test("ignores case, accents and punctuation", () => {
		expect(tokenize("Café, TLS-certificate!")).toEqual(["cafe", "tls", "certificate"]);
	});
});

describe("highlightSegments", () => {
	test("marks the words that match and leaves their neighbours whole", () => {
		expect(highlightSegments("Webhook alerts", queryTerms("alert"))).toEqual([
			{ text: "Webhook ", match: false },
			{ text: "alerts", match: true },
		]);
	});
});

describe("searchDocs", () => {
	test("finds a page by a word only its body uses", async () => {
		let { results } = await searchDocs("webhook");

		expect(results.map((result) => result.path)).toContain("/docs/concepts/alerts");
	});

	test("points a result at the section that answers", async () => {
		let { results } = await searchDocs("webhook");
		let alerts = results.find((result) => result.path === "/docs/concepts/alerts");

		expect(alerts?.href).toMatch(/^\/docs\/concepts\/alerts#/);
		expect(alerts?.section?.toLowerCase()).toContain("webhook");
	});

	test("ranks a page titled with the word above pages that mention it", async () => {
		let { results } = await searchDocs("maintenance");

		expect(results[0]?.title.map((segment) => segment.text).join("")).toMatch(/maintenance/i);
	});

	test("finds nothing for a word no page uses", async () => {
		expect((await searchDocs("zzqx")).results).toEqual([]);
	});
});
