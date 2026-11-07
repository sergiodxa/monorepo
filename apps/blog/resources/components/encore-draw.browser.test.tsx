/**
 * Plays a round on Encore's playable card in a real browser: the first card waits face down
 * and names itself with the app's hint, a tap turns it over, and drawing deals the next card
 * face up while the count of cards left goes down.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { EncoreDraw } from "~/resources/components/encore-draw";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";
import "~/resources/css/encore.css";

/** What the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.documentElement.className = "";
});

/** Three cards, enough to draw past the first. */
const CARDS = [
	{
		title: "GUILTY PLEASURE",
		prompt: "Sing a song you're slightly embarrassed to admit you love.",
	},
	{ title: "ROAD TRIP", prompt: "Sing a song you play loudly in a car with the windows down." },
	{ title: "ENCORE", prompt: "You earned it. Sing whatever you want." },
];

/** The labels the landing passes in English. */
const LABELS = {
	reveal: "Tap to reveal",
	draw: "Draw another",
	shuffle: "Shuffle",
	left: "Card {count} of {total}",
};

/** Waits for the island's next render. */
function frame(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 300));
}

describe("EncoreDraw", () => {
	test("starts face down, turns over on a tap, and deals the next card face up", async () => {
		document.documentElement.className = "system encore";
		mounted = render(<EncoreDraw cards={CARDS} labels={LABELS} />);
		let card = mounted.container.querySelector<HTMLButtonElement>("button");

		expect(card?.getAttribute("aria-label")).toBe("Tap to reveal");
		expect(mounted.container.textContent).toContain("Card 1 of 3");

		card?.click();
		await frame();
		expect(card?.hasAttribute("aria-label")).toBe(false);
		expect(card?.textContent).toContain("GUILTY PLEASURE");

		let draw = Array.from(mounted.container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Draw another"),
		);
		draw?.click();
		await frame();
		expect(card?.textContent).toContain("ROAD TRIP");
		expect(mounted.container.textContent).toContain("Card 2 of 3");
	});
});
