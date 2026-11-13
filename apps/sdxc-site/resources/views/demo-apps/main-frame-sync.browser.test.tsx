/**
 * Runs the swap-sync island in a real browser: it points in-app links at `main` the moment
 * they are used and leaves other shells, other sites and other frames alone, and after a swap
 * it brings the title, current nav item, crumb, focus, announcement and toasts in line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { pageToaster } from "@sdxc/ui/app/toast";
import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";

let mounted: RenderResult | undefined;

beforeEach(async () => {
	document.title = "Alpha — Demo";
	mounted = render(
		<div>
			<nav>
				<a data-main-nav="alpha" href="/demo/apps/demo/alpha" aria-current="page">
					Alpha
				</a>
				<a data-main-nav="beta" href="/demo/apps/demo/beta">
					Beta
				</a>
				<a href="/demo/apps/demo/settings/general">Settings</a>
				<a href="/demo/docs/elsewhere">Elsewhere</a>
				<a href="/demo/apps/demo/alpha?sheet=1" data-rmx-target="sheet">
					Sheet
				</a>
				<span data-main-crumb="">Alpha</span>
			</nav>
			<div data-main-region="">
				<div
					data-main-screen=""
					data-title="Alpha"
					data-nav="alpha"
					data-crumb="Alpha"
					data-url="/demo/apps/demo/alpha"
				>
					<h1>Alpha</h1>
				</div>
			</div>
			<MainFrameSync root="/demo/apps/demo" shells={["settings"]} />
		</div>,
	);
	await vi.waitFor(() => expect(document.querySelector("[data-main-frame-sync]")).not.toBeNull());
	await new Promise((resolve) => setTimeout(resolve, 50));
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	pageToaster().dispose();
	document.querySelector("[data-main-announcer]")?.remove();
});

/** The link whose text is `text`. */
function link(text: string): HTMLAnchorElement {
	let found = [...document.querySelectorAll("a")].find((anchor) => anchor.textContent === text);
	if (found === undefined) throw new Error(`No link ${text}`);
	return found;
}

/** Rests the pointer on a link, as a visitor does before pressing it. */
function hover(anchor: HTMLAnchorElement) {
	anchor.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
}

/** Swaps the screen in `main` for another, the way a frame reload reconciles it in place. */
function swapTo(title: string, nav: string) {
	let screen = document.querySelector<HTMLElement>("[data-main-screen]")!;
	screen.dataset.title = title;
	screen.dataset.nav = nav;
	screen.dataset.crumb = title;
	screen.dataset.url = `/demo/apps/demo/${nav}`;
	screen.querySelector("h1")!.textContent = title;
}

describe("MainFrameSync claims links at use time", () => {
	test("points an in-app link at main and leaves the reset of focus to the island", () => {
		hover(link("Beta"));

		expect(link("Beta").getAttribute("data-rmx-target")).toBe("main");
		expect(link("Beta").getAttribute("data-rmx-reset-focus")).toBe("manual");
	});

	test("leaves a link into another shell, another site or another frame alone", () => {
		for (let text of ["Settings", "Elsewhere", "Sheet"]) hover(link(text));

		expect(link("Settings").hasAttribute("data-rmx-target")).toBe(false);
		expect(link("Elsewhere").hasAttribute("data-rmx-target")).toBe(false);
		expect(link("Sheet").getAttribute("data-rmx-target")).toBe("sheet");
	});
});

describe("MainFrameSync on load", () => {
	test("marks the entry the visitor landed on as a main navigation, so Back to it stays in main", () => {
		let state = navigation.currentEntry?.getState() as
			| { target?: string; src?: string }
			| undefined;

		expect(state?.target).toBe("main");
		expect(state?.src).toBe(location.href);
	});
});

describe("MainFrameSync after a swap", () => {
	test("sets the title, the current nav item and the crumb, and focuses the new heading", async () => {
		swapTo("Beta", "beta");

		await vi.waitFor(() => expect(document.title).toBe("Beta — Demo"));
		expect(link("Beta").getAttribute("aria-current")).toBe("page");
		expect(link("Alpha").hasAttribute("aria-current")).toBe(false);
		expect(document.querySelector("[data-main-crumb]")?.textContent).toBe("Beta");
		await vi.waitFor(() => expect(document.activeElement?.textContent).toBe("Beta"));
	});

	test("keeps focus on the control the visitor used when only the query changes", async () => {
		link("Beta").focus();
		let screen = document.querySelector<HTMLElement>("[data-main-screen]")!;
		screen.dataset.url = "/demo/apps/demo/alpha?sort=name";

		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(document.activeElement).toBe(link("Beta"));
	});

	test("focuses the screen itself when its heading is hidden, as a list pane is on a phone", async () => {
		let screen = document.querySelector<HTMLElement>("[data-main-screen]")!;
		swapTo("Beta", "beta");
		screen.querySelector("h1")!.hidden = true;

		await vi.waitFor(() => expect(document.activeElement).toBe(screen));
	});

	test("announces the new screen in a live region it owns", async () => {
		swapTo("Beta", "beta");

		await vi.waitFor(() => {
			let region = document.querySelector("[data-main-announcer]");
			expect(region?.getAttribute("aria-live")).toBe("polite");
			expect(region?.textContent).toBe("Beta");
		});
	});

	test("scrolls to the element a post's redirect named and puts its hash in the address", async () => {
		let screen = document.querySelector<HTMLElement>("[data-main-screen]")!;
		let spacer = document.createElement("div");
		spacer.style.blockSize = "3000px";
		let post = document.createElement("article");
		post.id = "post-n-1";
		post.textContent = "New post";
		let marker = document.createElement("template");
		marker.setAttribute("data-main-anchor", "post-n-1");
		for (let node of [spacer, post, marker]) screen.appendChild(node);

		await vi.waitFor(() => expect(location.hash).toBe("#post-n-1"));
		await vi.waitFor(() => {
			let box = post.getBoundingClientRect();
			expect(box.top).toBeGreaterThanOrEqual(0);
			expect(box.bottom).toBeLessThanOrEqual(innerHeight);
		});
		history.replaceState(history.state, "", location.pathname);
	});

	test("raises a toast the swapped screen carries, once", async () => {
		let marker = document.createElement("template");
		marker.setAttribute("data-main-toast", "toast-1");
		marker.setAttribute("data-toast", JSON.stringify({ title: "Service paused" }));
		swapTo("Beta", "beta");
		document.querySelector("[data-main-screen]")!.appendChild(marker);

		await vi.waitFor(() => expect(pageToaster().size).toBe(1));
		swapTo("Gamma", "gamma");
		await vi.waitFor(() => expect(document.title).toBe("Gamma — Demo"));
		expect(pageToaster().size).toBe(1);
	});
});
