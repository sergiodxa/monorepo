/**
 * Holds the drawn reader window to its phone contract: on a narrow media slot it scales the
 * whole composition down, so no row runs past the window's edge, and on a wide stage it
 * gains its sidebar the way the app gains its rail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { createTranslator } from "@sdxc/i18n";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import {
	ArticleView,
	FeedView,
	QueueView,
	ReaderWindow,
} from "~/resources/components/marketing/reader-window";
import en from "~/resources/locales/en";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** English copy, built here because the app's translator also wires the server logger. */
const translate = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
});

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** The three faces the hero switches between, each inside its own window. */
const FACES = {
	queue: QueueView,
	article: ArticleView,
	feed: FeedView,
} as const;

/** Mounts one face in a window `width` wide, as a media slot of that width holds it. */
function mountWindow(face: keyof typeof FACES, width: string) {
	let { t } = translate("en");
	let Face = FACES[face];
	mounted = render(
		<div style={{ inlineSize: width }}>
			<ReaderWindow t={t} title="Reading" path="/reading" label="The reader">
				<Face t={t} />
			</ReaderWindow>
		</div>,
	);
	let mockup = mounted.container.querySelector<HTMLElement>("[data-slot=product-mockup]");
	if (!mockup) throw new Error("The window drew no mockup");
	return mockup;
}

describe("ReaderWindow", () => {
	test.each(Object.keys(FACES) as (keyof typeof FACES)[])(
		"keeps the %s face inside the window on a phone",
		async (face) => {
			await page.viewport(375, 812);
			let mockup = mountWindow(face, "343px");

			expect(mockup.scrollWidth).toBeLessThanOrEqual(mockup.clientWidth);
		},
	);

	test("shows the sidebar on a wide stage and hides it on a narrow one", async () => {
		await page.viewport(1440, 900);
		expect(searchBox(mountWindow("queue", "72rem")).checkVisibility()).toBe(true);

		mounted?.cleanup();
		expect(searchBox(mountWindow("queue", "343px")).checkVisibility()).toBe(false);
	});
});

/** The sidebar's search box, found by the placeholder it prints and nothing else. */
function searchBox(mockup: HTMLElement): HTMLElement {
	let box = [...mockup.querySelectorAll<HTMLElement>("div")].find(
		(element) => element.textContent === en.search.placeholder,
	);
	if (!box) throw new Error("The window drew no search box");
	return box;
}
