/**
 * Tests for the activity feed view model's labels, which join a first-person
 * sentence to a stored title and must read as one headline-cased line whatever
 * casing the title was written in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Feed } from "~/app/models/feed";

import { FeedViewModel } from "./feed";

/** Builds a feed record with the fields every kind shares. */
function activity(item: Partial<Feed.ActivityItem> & Pick<Feed.ActivityItem, "kind">) {
	return { title: "", date: "2026-10-15T00:00:00.000Z", preview: false, ...item };
}

/** The labels `FeedViewModel.index` renders for the given records, in order. */
function labels(items: Array<Feed.ActivityItem>) {
	return FeedViewModel.index(items).activity.map((item) => item.label);
}

describe("FeedViewModel.index", () => {
	test("headline-cases the sentence together with the title of every kind", () => {
		expect(
			labels([
				activity({
					kind: "tutorial",
					slug: "a",
					title: "Make Regional HTTP Requests with Durable Objects",
				}),
				activity({ kind: "article", slug: "b", title: "The Remix Way" }),
				activity({
					kind: "bookmark",
					url: "https://example.com",
					title: "Everything I know about good API design",
				}),
				activity({ kind: "release", slug: "2026-w41" }),
				activity({ kind: "glossary", slug: "c", title: "Durable Object" }),
				activity({ kind: "til", slug: "d", title: "how to use git worktrees", content: "Body" }),
			]),
		).toEqual([
			"I Published How to Make Regional HTTP Requests with Durable Objects",
			"I Wrote about the Remix Way",
			"I Saved Everything I Know about Good API Design",
			"I Listed What I Released in 2026-W41",
			"I Added the Definition of Durable Object",
			"TIL How to Use Git Worktrees",
		]);
	});

	test("keeps identifiers in a title as typed", () => {
		expect(
			labels([
				activity({
					kind: "tutorial",
					slug: "a",
					title: "Use waitUntil for Non-Blocking Cache Writes",
				}),
				activity({ kind: "tutorial", slug: "b", title: "Add an MCP Server to a Remix v3 App" }),
			]),
		).toEqual([
			"I Published How to Use waitUntil for Non-Blocking Cache Writes",
			"I Published How to Add an MCP Server to a Remix v3 App",
		]);
	});
});
