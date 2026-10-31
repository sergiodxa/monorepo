/**
 * Checks the records behind every `/for/:slug` and `/use-cases/:slug` page: each one pairs
 * its hero mockup with a spotlight showing another part of the product, and its figure
 * strip holds figures a reader can check, never words set at display size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { MockupArea } from "~/resources/components/marketing/product-mockups";
import type { MarketingContent } from "~/resources/content/marketing";

import {
	AUDIENCE_MOCKUPS,
	USE_CASE_MOCKUPS,
} from "~/resources/components/marketing/product-mockups";
import { audiences, useCases } from "~/resources/content/marketing";

/**
 * The product area each spotlight scene draws, so it can be compared with the hero's. The
 * flow scene is an animated run of one check, a picture no hero mockup draws.
 */
const SCENE_AREAS: Record<MarketingContent.SpotlightScene, MockupArea | null> = {
	monitors: "dashboard",
	alerts: "alerts",
	"status-page": "status-page",
	flow: null,
	"alert-channels": "alerts",
	maintenance: "maintenance",
};

/** One solution page and the mockup its hero shows. */
interface SolutionPage {
	path: string;
	page: MarketingContent.Page;
	heroArea: MockupArea | undefined;
}

/** Every solution page with the mockup its hero shows. */
const PAGES: SolutionPage[] = [
	...Object.entries(audiences).map(([slug, page]) => ({
		path: `/for/${slug}`,
		page,
		heroArea: AUDIENCE_MOCKUPS[slug],
	})),
	...Object.entries(useCases).map(([slug, page]) => ({
		path: `/use-cases/${slug}`,
		page,
		heroArea: USE_CASE_MOCKUPS[slug],
	})),
];

describe.each(PAGES)("$path", ({ page, heroArea }) => {
	test("spotlights a different part of the product than its hero", () => {
		expect(page.spotlight).toBeDefined();
		expect(SCENE_AREAS[page.spotlight!.scene]).not.toBe(heroArea);
	});

	test("shows four figures, each one a number", () => {
		expect(page.trustIndicators).toHaveLength(4);
		for (let indicator of page.trustIndicators ?? []) {
			expect(indicator.value).toMatch(/^[\d$∞]/);
		}
	});
});
