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

import { WakabaLandingContent } from "~/resources/views/wakaba/landing";
import { AppStoreCall } from "~/resources/views/wakaba/parts";

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
