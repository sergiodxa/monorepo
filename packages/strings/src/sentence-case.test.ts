/**
 * Tests for sentence-style capitalization, focused on what a title carries into
 * running text: proper nouns and phrases a caller lists, identifiers and inline
 * code, and possessives of a listed name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createSentenceCaser, sentenceCase } from "./sentence-case.js";

describe("sentenceCase", () => {
	test("capitalizes the first word and lowercases the rest", () => {
		expect(sentenceCase("Structuring A Monorepo With Shared Packages")).toBe(
			"Structuring a monorepo with shared packages",
		);
		expect(sentenceCase("the remix way")).toBe("The remix way");
	});

	test("keeps a listed name as written, single words and phrases", () => {
		expect(
			sentenceCase("Make Regional Requests with Durable Objects in Remix", {
				special: ["Remix", "Durable Objects"],
			}),
		).toBe("Make regional requests with Durable Objects in Remix");
		expect(sentenceCase("add middleware in react router", { special: ["React Router"] })).toBe(
			"Add middleware in React Router",
		);
	});

	test("prefers the longest listed phrase", () => {
		expect(sentenceCase("Think in Remix UI Today", { special: ["Remix", "Remix UI"] })).toBe(
			"Think in Remix UI today",
		);
	});

	test("matches a listed name inside a possessive", () => {
		expect(sentenceCase("Read React Router's Data", { special: ["React Router"] })).toBe(
			"Read React Router's data",
		);
		expect(sentenceCase("Why Remix's Loaders Work", { special: ["Remix"] })).toBe(
			"Why Remix's loaders work",
		);
	});

	test("matches a phrase only when its words are adjacent", () => {
		expect(sentenceCase("React, Router And More", { special: ["React Router"] })).toBe(
			"React, router and more",
		);
	});

	test("keeps the built-in names and the pronoun I", () => {
		expect(sentenceCase("Everything I Know About Good API Design")).toBe(
			"Everything I know about good API design",
		);
		expect(sentenceCase("Why I'm Using JavaScript")).toBe("Why I'm using JavaScript");
	});

	test("keeps identifiers and inline code as typed", () => {
		expect(sentenceCase("Use waitUntil for Non-Blocking Writes")).toBe(
			"Use waitUntil for non-blocking writes",
		);
		expect(sentenceCase("Add an MCP Server to a Remix v3 App")).toBe(
			"Add an MCP server to a remix v3 app",
		);
		expect(sentenceCase("Read Data in entry.client With `useLoaderData` Calls")).toBe(
			"Read data in entry.client with `useLoaderData` calls",
		);
	});

	test("handles empty and punctuation-only input", () => {
		expect(sentenceCase("")).toBe("");
		expect(sentenceCase("...")).toBe("...");
	});
});

describe("createSentenceCaser", () => {
	test("binds a vocabulary so call sites do not repeat it", () => {
		let sentence = createSentenceCaser({ special: ["Bun", "Durable Objects"] });

		expect(sentence("Running Bun On Durable Objects")).toBe("Running Bun on Durable Objects");
	});
});
