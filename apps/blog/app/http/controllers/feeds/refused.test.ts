/**
 * A feed whose data its format's writer refuses answers a 500 instead of a broken document,
 * so a reader keeps the copy it already has until the data is fixed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "vitest";

import type { Syndication } from "~/app/http/view-models/syndication";

import { jsonFeedResponse } from "~/app/http/controllers/feeds/json-feed";
import { rssResponse } from "~/app/http/controllers/feeds/rss";

const CHANNEL: Syndication.Channel = {
	title: "Articles",
	description: "Every article",
	home: "https://sergiodxa.com/articles",
};

test("the RSS feed answers 500 for an item with neither a title nor a summary", () => {
	let response = rssResponse("https://sergiodxa.com/articles.rss", CHANNEL, [
		{
			id: "0192f1a0-0000-7000-8000-000000000001",
			title: "",
			summary: "",
			url: "https://sergiodxa.com/articles/hello",
			published: "2026-10-01T00:00:00.000Z",
			updated: "2026-10-02T00:00:00.000Z",
		},
	]);

	expect(response.status).toBe(500);
});

test("the JSON Feed answers 500 for a channel without a title", () => {
	let response = jsonFeedResponse(
		"https://sergiodxa.com/articles.json",
		{ ...CHANNEL, title: "" },
		[],
		"https://sergiodxa.com",
	);

	expect(response.status).toBe(500);
});
