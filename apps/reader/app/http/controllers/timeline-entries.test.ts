/**
 * Tests the rows every timeline surface is built from: the address a post's title points
 * at, which stays the publisher's own, the URL beside it that the browser pings when the
 * title is followed, and the addresses a row refuses to link at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";

import { createTranslator } from "@sdxc/i18n";
import { describe, expect, test } from "vitest";

import type { UserStore } from "~/database/user-do";

import { timelineEntries } from "~/app/http/controllers/timeline-entries";
import routes from "~/routes/web";

/**
 * The two labels a row resolves, spelled here rather than read out of the app's
 * dictionaries, so these assertions are about the rows and not about the copy.
 */
const RESOURCES = {
	en: {
		translation: {
			timeline: { byAuthor: "by {{author}}", publishedOn: "Published on {{date}}" },
		},
	},
};

let { i18n: i18next } = await createTranslator({
	resources: RESOURCES,
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/** What building a row reads off the request. */
const CTX: { i18next: i18n; locale: string } = { i18next, locale: "en" };

/** Builds a stored post, defaulting every field a test is not about. */
function item(overrides: Partial<UserStore.Item> & Pick<UserStore.Item, "id">): UserStore.Item {
	return {
		feedId: "feed-df",
		title: "A post",
		url: "https://example.com/post",
		summary: null,
		author: null,
		publishedAt: Date.UTC(2026, 0, 2, 12),
		readAt: null,
		savedAt: null,
		...overrides,
	};
}

describe("timelineEntries", () => {
	test("points a title at the publisher and pings this app on the way", () => {
		let [entry] = timelineEntries(CTX, [item({ id: "item-1" })], null);

		expect(entry?.url).toBe("https://example.com/post");
		expect(entry?.ping).toBe(routes.items.open.href({ itemId: "item-1" }));
	});

	test("gives every row on a page its own post to report", () => {
		let entries = timelineEntries(
			CTX,
			[item({ id: "item-1" }), item({ id: "item-2" })],
			new Map([["feed-df", "Daring Fireball"]]),
		);

		expect(entries.map((entry) => entry.ping)).toEqual([
			routes.items.open.href({ itemId: "item-1" }),
			routes.items.open.href({ itemId: "item-2" }),
		]);
	});

	test("leaves a post the publisher gave no address unlinked, and pings for nothing", () => {
		let [entry] = timelineEntries(CTX, [item({ id: "item-1", url: null })], null);

		expect(entry?.url).toBeNull();
		expect(entry?.ping).toBeNull();
	});

	test.each([
		["a scheme no browser opens as a page", "javascript:alert(1)"],
		["a scheme of its own", "mailto:author@example.com"],
		["an address relative to the publisher's site", "/posts/five"],
		["nothing at all", ""],
	])("refuses to link %s a publisher wrote", (_label, url) => {
		let [entry] = timelineEntries(CTX, [item({ id: "item-1", url })], null);

		expect(entry?.url).toBeNull();
		expect(entry?.ping).toBeNull();
	});
});
