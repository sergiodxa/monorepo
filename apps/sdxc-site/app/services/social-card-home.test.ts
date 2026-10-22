/**
 * Pins that the home card follows the collection's counts: a change to the number of
 * packages, RFCs, UI components or styling utilities gives the card a new URL and a new
 * storage key, so platforms, the edge cache and storage all pick up the new card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeAll, describe, expect, test, vi } from "vite-plus/test";

import type * as SocialCardModule from "~/app/services/social-card";

/** The counts the mocked landing copy reports, changed between assertions. */
const COUNTS: Record<string, string> = {
	packageCount: "124",
	rfcCount: "48",
	componentCount: "103",
	utilityCount: "297",
};

let cards: typeof SocialCardModule;

beforeAll(async () => {
	vi.doMock("~/app/services/article", () => ({ contentVariables: () => ({ ...COUNTS }) }));
	cards = await import("~/app/services/social-card");
});

/** The home card's advertised URL and storage key for the counts as they stand. */
function homeCard() {
	let page = { title: "sdxc", description: "", path: "/" };
	let url = cards.socialCardUrl(page);
	let hash = new URL(url).searchParams.get("v") ?? "";
	return { url, key: cards.socialCardKey(hash) };
}

describe("the home card", () => {
	test.each(["packageCount", "rfcCount", "componentCount", "utilityCount"])(
		"gets a new URL and storage key when %s changes",
		(name) => {
			let before = homeCard();
			let previous = COUNTS[name] ?? "0";
			COUNTS[name] = String(Number(previous) + 1);
			let after = homeCard();
			COUNTS[name] = previous;

			expect(after.url).not.toBe(before.url);
			expect(after.key).not.toBe(before.key);
			expect(homeCard()).toEqual(before);
		},
	);
});
