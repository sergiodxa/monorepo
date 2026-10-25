/**
 * The Atom and RSS feeds declare themselves complete (RFC 5005 `fh:complete`), since each
 * lists every post it covers, so a reader treats a post missing from one as removed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Atom } from "@sdxc/atom";
import { unwrap } from "@sdxc/result";
import { RSS } from "@sdxc/rss";
import { expect, test } from "vitest";

import type { Syndication } from "~/app/http/view-models/syndication";

import { atomResponse } from "~/app/http/controllers/feeds/atom";
import { rssResponse } from "~/app/http/controllers/feeds/rss";

const CHANNEL: Syndication.Channel = {
	title: "Articles",
	description: "Every article",
	home: "https://sergiodxa.com/articles",
};

const ENTRIES: Syndication.Entry[] = [
	{
		id: "0192f1a0-0000-7000-8000-000000000001",
		title: "Hello",
		summary: "A first post",
		url: "https://sergiodxa.com/articles/hello",
		published: "2026-10-01T00:00:00.000Z",
		updated: "2026-10-02T00:00:00.000Z",
	},
];

test("the Atom feed is marked complete", async () => {
	let response = atomResponse(
		"https://sergiodxa.com/articles.atom",
		CHANNEL,
		ENTRIES,
		"https://sergiodxa.com",
	);
	let body = await response.text();

	expect(body).toContain("<fh:complete/>");
	expect(unwrap(Atom.parse(body)).feed.complete).toBe(true);
});

test("the RSS feed is marked complete", async () => {
	let response = rssResponse("https://sergiodxa.com/articles.rss", CHANNEL, ENTRIES);
	let body = await response.text();

	expect(body).toContain("<fh:complete/>");
	expect(unwrap(RSS.parse(body)).channel.fhComplete).toBe(true);
});
