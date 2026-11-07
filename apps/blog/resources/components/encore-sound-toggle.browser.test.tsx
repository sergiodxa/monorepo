/**
 * Tests the speaker in Encore's header in a real browser: it starts on, turns off and back on
 * at a click, remembers the choice in this browser, and fits the header at 320px in the
 * longest of the page's languages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { EncoreSoundToggle } from "~/resources/components/encore-sound-toggle";
import { ENCORE_COPY } from "~/resources/content/encore";
import { EncoreHeader } from "~/resources/layouts/encore";
import { EncoreLanguage } from "~/resources/views/encore/parts";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";
import "~/resources/css/encore.css";

/** What the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	localStorage.removeItem("encore:sound");
	document.documentElement.className = "";
});

/** Waits for the island's next render. */
function frame(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 100));
}

describe("EncoreSoundToggle", () => {
	test("starts on, mutes and unmutes at a click, and remembers the choice", async () => {
		mounted = render(<EncoreSoundToggle label="Sound effects" />);
		await frame();
		let button = mounted.container.querySelector("button");

		expect(button?.getAttribute("aria-label")).toBe("Sound effects");
		expect(button?.getAttribute("aria-pressed")).toBe("true");

		button?.click();
		await frame();
		expect(button?.getAttribute("aria-pressed")).toBe("false");
		expect(localStorage.getItem("encore:sound")).toBe("off");

		button?.click();
		await frame();
		expect(button?.getAttribute("aria-pressed")).toBe("true");
		expect(localStorage.getItem("encore:sound")).toBeNull();
	});

	test("reads a muted page back as off", async () => {
		localStorage.setItem("encore:sound", "off");
		mounted = render(<EncoreSoundToggle label="Sound effects" />);
		await frame();

		expect(mounted.container.querySelector("button")?.getAttribute("aria-pressed")).toBe("false");
	});
});

describe("EncoreHeader", () => {
	test.each(["es-AR", "ja"] as const)(
		"fits a 320px screen in %s with the speaker",
		async (language) => {
			await page.viewport(320, 800);
			document.documentElement.className = "system encore";
			mounted = render(
				<EncoreLanguage copy={ENCORE_COPY[language]}>
					<EncoreHeader path="/apps/encore" />
				</EncoreLanguage>,
			);

			let nav = mounted.container.querySelector("nav");
			expect(nav?.querySelector("button[aria-pressed]")).not.toBeNull();
			expect(nav && nav.scrollWidth).toBeLessThanOrEqual(nav?.clientWidth ?? 0);
			await page.viewport(1280, 900);
		},
	);
});
