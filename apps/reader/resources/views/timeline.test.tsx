/**
 * The row, which is the most frequently edited markup in the app and the reason three
 * layouts were declined.
 *
 * What is asserted here is that there is one of it: every row carries the same elements at
 * every width, the narrow arrangement is a media query on that one shape rather than a
 * second one, and the gesture that toggles a post is an accelerator on top — the row still
 * carries the button that works with no script at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToStream } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Timeline } from "~/resources/views/timeline";

import TimelineView from "~/resources/views/timeline";

/** The copy a list prints, which none of these assertions turn on. */
const COPY: Timeline.Copy = {
	markRead: "Mark as read",
	markUnread: "Mark as unread",
	read: "Read",
	markFailed: "Could not be marked — try again",
	save: "Save",
	unsave: "Remove from saved",
	saveFailed: "Could not be saved — try again",
	saveFull: "Your saved posts are full",
	saved: "Saved",
	flagged: "Flagged",
	readHere: "Read here",
	newer: "Newer posts",
	older: "Older posts",
	end: "That is everything",
};

/** One post, with whichever of its states the assertion is about. */
function entry(id: string, overrides: Partial<Timeline.Entry> = {}): Timeline.Entry {
	return {
		id,
		title: `Post ${id}`,
		url: `https://example.com/${id}`,
		ping: `/items/${id}/open`,
		readHref: `/reading/feed/${id}`,
		source: "Daring Fireball",
		summary: "The opening of the post",
		time: "2h",
		timeLabel: "2 January 2026",
		dateTime: "2026-01-02T12:00:00.000Z",
		isRead: false,
		isSaved: false,
		isFlagged: false,
		...overrides,
	};
}

/** A page of the list as the server sends it. */
async function render(entries: Timeline.Entry[]): Promise<string> {
	let stream = renderToStream(
		<TimelineView
			entries={entries}
			copy={COPY}
			returnTo="/reading"
			cursors={{ next: null, prev: null }}
		/>,
	);

	return await new Response(stream).text();
}

describe("Timeline", () => {
	test("draws every row from one shape, whatever state its post is in", async () => {
		let html = await render([
			entry("a"),
			entry("b", { isRead: true }),
			entry("c", { isSaved: true, isFlagged: true }),
		]);

		let rows = html.match(/<li\b/g) ?? [];
		expect(rows).toHaveLength(3);

		/** One article per row, and one heading inside each, in every state. */
		expect(html.match(/<article\b/g) ?? []).toHaveLength(3);
		expect(html.match(/<h2\b/g) ?? []).toHaveLength(3);
	});

	/**
	 * The narrow arrangement is the same row measured differently. A second arrangement would
	 * be a branch every later change to a row is made in twice.
	 */
	test("collapses at the narrow measure rather than branching into a second row", async () => {
		let html = await render([entry("a")]);

		expect(html).toContain("min-width: 34rem");
		expect(html.match(/<li\b/g) ?? []).toHaveLength(1);
	});

	/**
	 * The browser keeps the vertical axis, which is what makes the gesture safe beside a
	 * scroll container.
	 */
	test("leaves the vertical axis to the browser", async () => {
		expect(await render([entry("a")])).toContain("touch-action: pan-y");
	});

	/** The travel is the one thing a reader who asked for less motion does without. */
	test("puts the travel behind reduced motion", async () => {
		let html = await render([entry("a")]);

		expect(html).toContain("prefers-reduced-motion: no-preference");
		expect(html).toContain("will-change: transform");
	});

	/**
	 * The swipe is never the only way. Without script the mark is a form that posts to the
	 * same address the gesture reaches.
	 */
	test("keeps the read mark a form that posts without script", async () => {
		let html = await render([entry("a")]);

		expect(html).toContain(`action="/items/a/read"`);
		expect(html).toContain(`method="post"`);
		expect(html).toContain(`type="submit"`);
	});

	/** A row is one line, and a player is not, so no row carries one. */
	test("carries no player on a row", async () => {
		let html = await render([entry("a")]);

		expect(html).not.toContain("<audio");
		expect(html).not.toContain("<video");
	});

	/** The reader's own face reaches the post's words and stops there. */
	test("sets a post's words in the reading face", async () => {
		expect(await render([entry("a")])).toContain("var(--ui-font-reading");
	});
});
