/**
 * Measures Wakaba's landing in a real browser under its own theme: at 320px nothing reaches
 * past the page's edge, except inside the exercise row that scrolls sideways by design, and
 * the App Store call is a link only once the listing has a URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { ES } from "~/resources/content/wakaba/es-AR";
import { WakabaHeader } from "~/resources/views/wakaba/chrome";
import { WakabaLandingContent } from "~/resources/views/wakaba/landing";
import { AppStoreCall, WakabaLanguage } from "~/resources/views/wakaba/parts";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";
import "~/resources/css/wakaba.css";

/** What the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.documentElement.className = "";
});

/** Whether `element` sits inside a box that scrolls or clips its own overflow. */
function insideScroller(element: Element, host: Element): boolean {
	for (
		let parent = element.parentElement;
		parent && parent !== host;
		parent = parent.parentElement
	) {
		let overflow = getComputedStyle(parent).overflowX;
		if (
			overflow === "auto" ||
			overflow === "scroll" ||
			overflow === "hidden" ||
			overflow === "clip"
		) {
			return true;
		}
	}
	return false;
}

describe("WakabaLandingContent", () => {
	test("keeps every box inside a 320px page", () => {
		document.documentElement.className = "system wakaba";
		let host = document.createElement("div");
		host.style.inlineSize = "320px";
		document.body.appendChild(host);
		mounted = render(<WakabaLandingContent />, { container: host });

		let edge = host.getBoundingClientRect().right;
		let escaping = Array.from(host.querySelectorAll("*"))
			.filter((element) => !insideScroller(element, host))
			.filter((element) => element.getBoundingClientRect().right > edge + 1)
			.map((element) => `${element.tagName.toLowerCase()} ${element.textContent?.slice(0, 40)}`);

		expect(escaping).toEqual([]);
		expect(host.scrollWidth).toBeLessThanOrEqual(320);
		host.remove();
	});
});

describe("Swipe rows", () => {
	test("snap one card at a time to the start, with no hint text under the row", () => {
		document.documentElement.className = "system wakaba";
		let host = document.createElement("div");
		host.style.inlineSize = "390px";
		document.body.appendChild(host);
		mounted = render(<WakabaLandingContent />, { container: host });

		let rows = Array.from(host.querySelectorAll<HTMLElement>("[data-swipe]"));
		expect(rows.length).toBeGreaterThanOrEqual(3);
		for (let row of rows) {
			let card = row.querySelector("li");
			expect(card && getComputedStyle(card).scrollSnapAlign).toContain("start");
		}
		expect(host.textContent).not.toContain("Swipe for more");
		host.remove();
	});
});

describe("Hero cards", () => {
	test("stay hidden on a phone, where they would cover the screens", () => {
		document.documentElement.className = "system wakaba";
		let host = document.createElement("div");
		host.style.inlineSize = "375px";
		document.body.appendChild(host);
		mounted = render(<WakabaLandingContent />, { container: host });

		let cards = Array.from(
			host.querySelectorAll<HTMLElement>("#top div[aria-hidden='true']"),
		).filter((element) => element.textContent?.includes("23-day streak"));
		expect(cards).toHaveLength(1);
		expect(cards.map((card) => getComputedStyle(card).display)).toEqual(["none"]);
		host.remove();
	});
});

describe("WakabaLandingContent in Spanish", () => {
	test("keeps every box inside a 320px page", () => {
		document.documentElement.className = "system wakaba";
		let host = document.createElement("div");
		host.style.inlineSize = "320px";
		document.body.appendChild(host);
		mounted = render(<WakabaLandingContent locale="es-AR" />, { container: host });

		let edge = host.getBoundingClientRect().right;
		let escaping = Array.from(host.querySelectorAll("*"))
			.filter((element) => !insideScroller(element, host))
			.filter((element) => element.getBoundingClientRect().right > edge + 1);

		expect(escaping).toHaveLength(0);
		host.remove();
	});
});

describe("WakabaHeader", () => {
	test("fits a 320px screen in the longer Spanish labels", async () => {
		await page.viewport(320, 800);
		document.documentElement.className = "system wakaba";
		mounted = render(
			<WakabaLanguage copy={ES}>
				<WakabaHeader />
			</WakabaLanguage>,
		);

		let nav = mounted.container.querySelector("nav");
		expect(nav).not.toBeNull();
		expect(nav && nav.scrollWidth).toBeLessThanOrEqual(nav?.clientWidth ?? 0);
		await page.viewport(1280, 900);
	});
});

describe("Phone frames", () => {
	test("hug their screenshot, with no bezel stretched below it in a pair", async () => {
		document.documentElement.className = "system wakaba";
		let host = document.createElement("div");
		host.style.inlineSize = "1200px";
		document.body.appendChild(host);
		mounted = render(<WakabaLandingContent />, { container: host });
		for (let image of Array.from(host.querySelectorAll<HTMLImageElement>("picture img"))) {
			image.loading = "eager";
		}

		let stretched = Array.from(host.querySelectorAll("#flashcards picture, #writing picture"))
			.map((picture) => ({
				bezel: picture.parentElement?.getBoundingClientRect().height ?? 0,
				screen: picture.getBoundingClientRect().height,
			}))
			.filter(({ bezel, screen }) => bezel - screen > 16);

		expect(host.querySelectorAll("#flashcards picture, #writing picture")).toHaveLength(4);
		expect(stretched).toEqual([]);
		host.remove();
	});
});

describe("Questions", () => {
	test("draw no rule above either column, in whatever scheme re-declares the border colour", () => {
		document.documentElement.className = "system wakaba";
		mounted = render(<WakabaLandingContent />);

		let columns = Array.from(mounted.container.querySelectorAll("#faq details")).map(
			(item) => item.parentElement,
		);
		expect(new Set(columns).size).toBe(2);
		for (let column of new Set(columns)) {
			expect(column && getComputedStyle(column).borderTopWidth).toBe("0px");
		}
	});
});

describe("AppStoreCall", () => {
	test("renders a status, not a link, before the listing exists", () => {
		mounted = render(<AppStoreCall href={null} />);

		expect(mounted.container.querySelector("a")).toBeNull();
		expect(mounted.container.querySelector('[data-app-store="coming-soon"]')?.textContent).toBe(
			"Coming soon to theApp Store",
		);
	});

	test("links the listing once it has a URL", () => {
		mounted = render(<AppStoreCall href="https://apps.apple.com/app/id6740000000" />);

		let link = mounted.container.querySelector('a[data-app-store="available"]');
		expect(link?.getAttribute("href")).toBe("https://apps.apple.com/app/id6740000000");
		expect(link?.textContent).toContain("App Store");
	});
});
