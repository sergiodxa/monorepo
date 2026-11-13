/**
 * Holds Chorus in a real browser: the rail's cards land at their placeholders' height, phone
 * and tablet layouts hold, and every link or form aimed at a frame names a mounted one whose
 * reload fetches that frame alone, leaving the nav and the rest of the page as they were.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FrameHandle, Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";
import { CharacterCount } from "@sdxc/ui/character-count";
import { themeScope } from "@sdxc/ui/styles";
import { renderToStream } from "remix/component/server";
import { render } from "remix/component/test";
import { afterAll, describe, expect, onTestFinished, test } from "vitest";
import { page } from "vitest/browser";

import { blockSize } from "~/app/test/frame-size";
import { demoThemeTokens } from "~/resources/components/demo-theme";
import chorus from "~/resources/views/demo-apps/chorus";
import { CopyLink } from "~/resources/views/demo-apps/chorus/copy-link";
import { COLUMN_FRAME, href, pollFrame } from "~/resources/views/demo-apps/chorus/data";
import { FeedKeys } from "~/resources/views/demo-apps/chorus/feed-keys";
import { FollowCard, TrendsCard } from "~/resources/views/demo-apps/chorus/rail";
import { readState } from "~/resources/views/demo-apps/chorus/state";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** The rail's widths: a 1024px screen's and a 1280px screen's. */
const RAIL_WIDTHS = [296, 344];

/** Wraps a node in Chorus's theme tokens, so type and spacing match the page. */
function themed(node: RemixNode): RemixNode {
	return (
		<div
			mix={[
				themeScope(),
				raw({ ...demoThemeTokens(chorus.theme), fontFamily: "var(--ui-font-sans)" }),
			]}
		>
			{node}
		</div>
	);
}

/** The islands a column holds, by export name, so frame content hydrates in the test page. */
const ISLANDS: Record<string, Function> = { CharacterCount, CopyLink, FeedKeys, OptimisticToggle };

/** Every frame load the page asked for, in order, with the frame name it was aimed at. */
let requests: Array<{ src: string; target: string | undefined }> = [];

/** The frames of the screen mounted last, as its components reach them. */
let frames: Handle["frames"] | undefined;

/** Catches the mounted root's frames, so a test can reload one as a link aimed at it would. */
function FrameProbe(handle: Handle) {
	frames = handle.frames;
	return () => null;
}

/**
 * Answers a frame as the app's page route does: a name Chorus owns renders through its
 * `target`, with nested frames inlined as the server inlines them. The rail's unnamed frames
 * never answer, so their placeholders stay, as on first paint.
 */
function answer(src: string, target: string | undefined): ReadableStream<Uint8Array> | null {
	if (target === undefined) return null;
	let url = new URL(src, location.origin);
	let page = url.pathname.replace(/^\/demo\/apps\/chorus\/?/, "");
	let node = chorus.target?.(target, { page, url, cookie: null });
	if (node === null || node === undefined || node instanceof Promise) return null;
	return renderToStream(node, {
		resolveFrame: (nested, name) => answer(nested, name) ?? "",
	});
}

/** Render options whose frames answer through Chorus, recording every load. */
const ANSWERING_FRAMES = {
	frameInit: {
		resolveFrame(src: string, options?: { target?: string }) {
			requests.push({ src, target: options?.target });
			return answer(src, options?.target) ?? new Promise<never>(() => {});
		},
		loadModule: (_url: string, name: string) => ISLANDS[name]!,
	},
};

/** Waits until `ready` holds, a frame at a time, for up to two seconds. */
async function until(ready: () => boolean): Promise<void> {
	let deadline = performance.now() + 2000;
	while (!ready() && performance.now() < deadline) {
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}
}

/** Expects the content to take the placeholder's height, to a pixel. */
function expectSameSize(content: number, fallback: number) {
	expect(content).toBeGreaterThan(0);
	expect(Math.abs(content - fallback)).toBeLessThanOrEqual(1);
}

/**
 * Mounts one screen of the app at the current viewport and waits for its column frame to
 * land; the rail's frames stay pending. The column must draw, so a render that throws fails.
 */
async function mountScreen(screen: string): Promise<HTMLElement> {
	let [path = "", query = ""] = screen.split("?");
	let url = new URL(`${location.origin}${href(screen)}`);
	let rendered = chorus.render({ page: path, url, cookie: null });
	requests = [];
	let mounted = render(
		themed(
			<>
				<FrameProbe />
				{rendered.body}
			</>,
		),
		{ ...ANSWERING_FRAMES, frameInit: { ...ANSWERING_FRAMES.frameInit, src: url.href } },
	);
	onTestFinished(() => mounted.cleanup());
	let column = () => mounted.container.querySelector('[data-slot="chorus-header"]');
	await until(() => column() !== null);
	expect(column(), `${screen}${query}`).not.toBeNull();
	return mounted.container;
}

/** The frame a name points at on the mounted screen, failing when none is mounted. */
function mountedFrame(name: string): FrameHandle {
	let frame = frames?.get(name);
	expect(frame, name).toBeDefined();
	return frame!;
}

afterAll(async () => {
	await page.viewport(414, 896);
});

describe("Chorus rail cards keep their placeholder's size", () => {
	describe.each(RAIL_WIDTHS)("at %ipx", (width) => {
		test("trends", () => {
			expectSameSize(
				blockSize(<TrendsCard />, width, themed),
				blockSize(<TrendsCard ghost />, width, themed),
			);
		});

		test("who to follow", () => {
			expectSameSize(
				blockSize(<FollowCard state={readState(null)} />, width, themed),
				blockSize(<FollowCard ghost />, width, themed),
			);
		});
	});
});

describe("Chorus on a phone", () => {
	test.each(chorus.screens)("screen %j never scrolls sideways at 375px", async (screen) => {
		await page.viewport(375, 812);
		await mountScreen(screen);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("a profile's avatar is drawn over its banner", async () => {
		await page.viewport(375, 812);
		let root = await mountScreen("u/meilin");
		let tile = [...root.querySelectorAll<HTMLElement>("span[aria-hidden='true']")].find(
			(element) => element.textContent === "ML" && element.getBoundingClientRect().width > 80,
		)!;
		let box = tile.getBoundingClientRect();
		let hit = document.elementFromPoint(box.left + box.width / 2, box.top + 8);

		expect(tile.contains(hit)).toBe(true);
	});

	test("shows the compose button and the tab bar", async () => {
		await page.viewport(375, 812);
		let root = await mountScreen("");

		expect(getComputedStyle(root.querySelector('[data-slot="chorus-fab"]')!).display).not.toBe(
			"none",
		);
		expect(getComputedStyle(root.querySelector('[data-slot="tab-bar"]')!).display).not.toBe("none");
	});

	test("a post's page gives the foot to its reply box, not the compose button", async () => {
		await page.viewport(375, 812);
		let root = await mountScreen("post/p-leonids");

		expect(root.querySelector('[data-slot="chorus-fab"]')).toBeNull();
	});
});

describe("Chorus from a tablet up", () => {
	test("hides the phone's compose button and tab bar at 768px", async () => {
		await page.viewport(768, 1024);
		let root = await mountScreen("");

		expect(getComputedStyle(root.querySelector('[data-slot="chorus-fab"]')!).display).toBe("none");
		expect(getComputedStyle(root.querySelector('[data-slot="tab-bar"]')!).display).toBe("none");
	});

	test("keeps names out of the icon rail at 768px, account row included", async () => {
		await page.viewport(768, 1024);
		let root = await mountScreen("");
		let header = root.querySelector('[data-slot="chorus"] > header')!;

		for (let label of header.querySelectorAll<HTMLElement>("[data-nav-label]")) {
			expect(label.getBoundingClientRect().width, label.textContent ?? "").toBe(0);
		}
	});

	test("shows every name and hides the compose button at 1280px", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("");
		let header = root.querySelector('[data-slot="chorus"] > header')!;

		expect(getComputedStyle(root.querySelector('[data-slot="chorus-fab"]')!).display).toBe("none");
		for (let label of header.querySelectorAll<HTMLElement>("[data-nav-label]")) {
			expect(label.getBoundingClientRect().width, label.textContent ?? "").toBeGreaterThan(0);
		}
	});
});

describe("Chorus from the keyboard", () => {
	test("j and k walk the timeline's posts, k stopping at the first", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("");
		let press = (key: string) =>
			document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
		let posts = [...root.querySelectorAll<HTMLElement>("article[data-post]")];
		window.scrollTo(0, 0);

		press("j");
		let first = document.activeElement;
		press("j");
		let second = document.activeElement;
		press("k");

		expect(posts).toContain(first);
		expect(posts.indexOf(second as HTMLElement)).toBe(posts.indexOf(first as HTMLElement) + 1);
		expect(document.activeElement).toBe(first);
	});
});

describe("Chorus's Copy link", () => {
	test("is a link to the post that copies instead of leaving when script runs", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("");
		let link = root.querySelector<HTMLAnchorElement>(
			"#share-p-leonids a[href$='/post/p-leonids']",
		)!;
		let followed = true;
		let watch = (event: Event) => {
			followed = !event.defaultPrevented;
			event.preventDefault();
		};
		document.addEventListener("click", watch);
		onTestFinished(() => document.removeEventListener("click", watch));

		link.click();

		expect(link.getAttribute("href")).toBe("/demo/apps/chorus/post/p-leonids");
		expect(followed).toBe(false);
	});
});

describe("Chorus's frame targets", () => {
	test.each(["", "u/noorhaddad", "notifications", "explore", "messages", "messages/kofibuilds"])(
		"every link and form aimed at a frame on %j reloads that frame alone",
		async (screen) => {
			await page.viewport(1280, 860);
			let root = await mountScreen(screen);
			let nav = root.querySelector('[data-slot="chorus"] > header');
			let aimed = [...root.querySelectorAll<HTMLElement>("[data-rmx-target]")];
			expect(aimed.length).toBeGreaterThan(0);

			let seen = new Set<string>();
			for (let element of aimed) {
				let target = element.dataset.rmxTarget!;
				let frame = mountedFrame(target);
				let src = element.getAttribute("href") ?? element.getAttribute("action")!;
				if (element instanceof HTMLFormElement && element.method === "get") continue;
				if (element instanceof HTMLFormElement || seen.has(`${target} ${src}`)) continue;
				seen.add(`${target} ${src}`);

				requests = [];
				await frame.reload({ src });

				expect(requests, src).toEqual([{ src, target }]);
				expect(nav?.isConnected, src).toBe(true);
				expect(root.querySelector('[data-slot="chorus"] > header'), src).toBe(nav);
			}
		},
	);

	test("For you to Following swaps the column and keeps the nav and rail", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("");
		let nav = root.querySelector('[data-slot="chorus"] > header');
		let rail = root.querySelector('[data-slot="chorus"] > aside');
		let following = root.querySelector<HTMLAnchorElement>(
			'nav[aria-label="Timelines"] a[href$="feed=following"]',
		)!;

		await mountedFrame(COLUMN_FRAME).reload({ src: following.getAttribute("href")! });

		expect(root.querySelector("h1")?.textContent).toBe("Home: Following");
		expect(
			root.querySelector('nav[aria-label="Timelines"] [aria-current="page"]')?.textContent,
		).toBe("Following");
		expect(root.querySelector('[data-slot="chorus"] > header')).toBe(nav);
		expect(root.querySelector('[data-slot="chorus"] > aside')).toBe(rail);
	});

	test("a vote is aimed at its own poll, so the posts around it stay the same nodes", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("post/p-friday-poll");
		let form = root.querySelector<HTMLFormElement>(
			`form[data-rmx-target="${pollFrame("p-friday-poll")}"]`,
		)!;
		let article = root.querySelector("article");

		requests = [];
		await mountedFrame(pollFrame("p-friday-poll")).reload({ src: form.getAttribute("action")! });

		expect(requests).toEqual([
			{ src: href("post/p-friday-poll"), target: pollFrame("p-friday-poll") },
		]);
		expect(root.querySelector("article")).toBe(article);
		expect(
			root.querySelector(`form[data-rmx-target="${pollFrame("p-friday-poll")}"]`),
		).not.toBeNull();
	});
});
