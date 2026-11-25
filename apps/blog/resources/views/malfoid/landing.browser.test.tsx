/**
 * Measures Malfoid Stickers' landing in a real browser under its own theme: at 320px nothing
 * reaches past the page's edge, every mood's ten stickers fill whole rows with none left alone
 * on the last, and the App Store call is a link only once the listing has a URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { STICKER_CATEGORIES } from "~/resources/content/malfoid/stickers";
import { MalfoidLandingContent } from "~/resources/views/malfoid/landing";
import { AppStoreCall } from "~/resources/views/malfoid/parts";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";
import "~/resources/css/malfoid.css";

/** What the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.documentElement.className = "";
});

/** Mounts the landing into a host `width` pixels wide under the pack's scope. */
function mountLanding(width: number): HTMLElement {
	document.documentElement.className = "system malfoid";
	let host = document.createElement("div");
	host.style.inlineSize = `${width}px`;
	document.body.appendChild(host);
	mounted = render(<MalfoidLandingContent />, { container: host });
	return host;
}

describe("MalfoidLandingContent", () => {
	test("keeps every box inside a 320px page", () => {
		let host = mountLanding(320);

		let edge = host.getBoundingClientRect().right;
		let escaping = Array.from(host.querySelectorAll("*"))
			.filter((element) => element.getBoundingClientRect().right > edge + 1)
			.map((element) => `${element.tagName.toLowerCase()} ${element.textContent?.slice(0, 40)}`);

		expect(escaping).toEqual([]);
		expect(host.scrollWidth).toBeLessThanOrEqual(320);
		host.remove();
	});

	test("lays every mood's ten stickers out in full rows", () => {
		let host = mountLanding(1024);

		for (let category of STICKER_CATEGORIES) {
			let tiles = Array.from(host.querySelectorAll(`#${category} li`));
			let rows = new Map<number, number>();
			for (let tile of tiles) {
				let top = Math.round(tile.getBoundingClientRect().top);
				rows.set(top, (rows.get(top) ?? 0) + 1);
			}

			expect(tiles).toHaveLength(10);
			expect(new Set(rows.values()).size).toBe(1);
		}
		host.remove();
	});
});

describe("AppStoreCall", () => {
	test("reads as a status before release and links the listing after", () => {
		mounted = render(<AppStoreCall href={null} />);
		expect(mounted.container.querySelector('[data-app-store="coming-soon"]')).not.toBeNull();
		expect(mounted.container.querySelector("a")).toBeNull();
		mounted.cleanup();

		mounted = render(<AppStoreCall href="https://apps.apple.com/app/id6740000000" />);
		expect(mounted.container.querySelector("a")?.getAttribute("href")).toBe(
			"https://apps.apple.com/app/id6740000000",
		);
	});
});
