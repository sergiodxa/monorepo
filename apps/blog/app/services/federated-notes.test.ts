/**
 * Tests a short post as an ActivityPub `Note`: Mastodon shows a Note's content whole and
 * ignores a name, so the object carries the rendered Markdown, its tags as hashtags, and the
 * canonical permalink as both id and URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PUBLIC } from "@sdxc/activitypub";
import { describe, expect, test } from "vitest";

import { ACTOR_ID, FOLLOWERS_ID } from "~/config/activitypub";

import { note } from "./federated-posts";

describe("note", () => {
	test("is a public, untitled Note under the canonical permalink", () => {
		let published = new Date("2026-10-12T12:00:00.000Z");
		let object = note({
			postType: "notes",
			slug: "t3zq5c",
			content: "Hello **there**",
			tags: [],
			published,
		});

		expect(object).toMatchObject({
			id: "https://sergiodxa.com/notes/t3zq5c",
			type: "Note",
			url: "https://sergiodxa.com/notes/t3zq5c",
			attributedTo: [ACTOR_ID],
			to: [PUBLIC],
			cc: [FOLLOWERS_ID],
			name: null,
			summary: null,
			published,
			updated: null,
		});
		expect(object.content).toContain("<strong>there</strong>");
	});

	test("carries its tags as hashtags and the edit time an Update names", () => {
		let updated = new Date("2026-10-13T00:00:00.000Z");
		let object = note(
			{
				postType: "til",
				slug: "x",
				content: "TIL something",
				tags: ["Remix v3", "web"],
				published: null,
			},
			updated,
		);

		expect(object.tag).toEqual([
			{ type: "Hashtag", name: "#Remixv3", href: null },
			{ type: "Hashtag", name: "#web", href: null },
		]);
		expect(object.updated).toBe(updated);
	});
});
