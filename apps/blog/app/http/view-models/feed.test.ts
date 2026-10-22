/**
 * Tests for the activity feed view model's labels, which join a first-person
 * sentence to a stored title and must read as one sentence-cased line whatever
 * casing the title was written in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vite-plus/test";

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
	test("sentence-cases the sentence together with the title of every kind", () => {
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
			"I published how to make regional HTTP requests with Durable Objects",
			"I wrote about the Remix way",
			"I saved everything I know about good API design",
			"I listed what I released in 2026-W41",
			"I added the definition of Durable Object",
			"TIL how to use Git worktrees",
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
			"I published how to use waitUntil for non-blocking cache writes",
			"I published how to add an MCP server to a Remix v3 app",
		]);
	});
});
