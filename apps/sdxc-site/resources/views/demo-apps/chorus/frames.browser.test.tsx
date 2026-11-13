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
import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { renderToStream } from "remix/component/server";
import { render } from "remix/component/test";
import { afterAll, beforeAll, describe, expect, onTestFinished, test } from "vitest";
import { page } from "vitest/browser";

import { blockSize } from "~/app/test/frame-size";
import { demoThemeTokens } from "~/resources/components/demo-theme";
import chorus from "~/resources/views/demo-apps/chorus";
import { ComposeReturn } from "~/resources/views/demo-apps/chorus/compose-return";
import { ComposeSubmit } from "~/resources/views/demo-apps/chorus/compose-submit";
import { CopyLink } from "~/resources/views/demo-apps/chorus/copy-link";
import { href, pollFrame } from "~/resources/views/demo-apps/chorus/data";
import { FeedKeys } from "~/resources/views/demo-apps/chorus/feed-keys";
import { FollowCard, TrendsCard } from "~/resources/views/demo-apps/chorus/rail";
import { readState } from "~/resources/views/demo-apps/chorus/state";
import { MAIN_FRAME } from "~/resources/views/demo-apps/main-frame";

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
const ISLANDS: Record<string, Function> = {
	CharacterCount,
	ComposeReturn,
	ComposeSubmit,
	CopyLink,
	FeedKeys,
	OptimisticToggle,
};

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

/**
 * The server a toggle posts to in the background: every post answers `204`, as the app's
 * action does for a request carrying `X-Optimistic-Toggle`, and is kept for the test to read.
 */
const WORKER = setupWorker(
	http.post(/\/demo\/apps\/chorus\//, ({ request }) => {
		posted.push({
			url: new URL(request.url).pathname,
			toggle: request.headers.has("x-optimistic-toggle"),
		});
		return new HttpResponse(null, { status: 204 });
	}),
);

/** Every background post the toggles sent, oldest first. */
let posted: Array<{ url: string; toggle: boolean }> = [];

beforeAll(async () => {
	await WORKER.start({ quiet: true, onUnhandledRequest: "bypass" });
});

afterAll(async () => {
	WORKER.stop();
	await page.viewport(414, 896);
});

/**
 * Records whether each submit on the page was taken over by script, and stops any that was
 * not, so a form that would load a document fails the test instead of leaving it.
 */
function watchSubmits(): Array<{ form: HTMLFormElement; handled: boolean }> {
	let submits: Array<{ form: HTMLFormElement; handled: boolean }> = [];
	let watch = (event: Event) => {
		submits.push({ form: event.target as HTMLFormElement, handled: event.defaultPrevented });
		event.preventDefault();
	};
	window.addEventListener("submit", watch);
	onTestFinished(() => window.removeEventListener("submit", watch));
	return submits;
}

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

describe("Chorus fills the screen's height", () => {
	test.each([
		[375, 812],
		[1280, 860],
	])("a short conversation keeps its reply box at the bottom at %ipx", async (width, height) => {
		await page.viewport(width, height);
		let root = await mountScreen("messages/kofibuilds");
		let form = root.querySelector<HTMLFormElement>("form:has(textarea[name='text'])")!;

		expect(Math.abs(form.getBoundingClientRect().bottom - window.innerHeight)).toBeLessThanOrEqual(
			1,
		);
	});
});

describe("Chorus's New post dialog", () => {
	test.each([
		[
			"the nav's Post button",
			"",
			1280,
			"[data-slot='chorus'] > header button[commandfor='chorus-compose']",
		],
		[
			"a profile's New post",
			"u/noorhaddad",
			1280,
			"#chorus-main button[commandfor='chorus-compose']",
		],
		["the phone's compose button", "", 375, "[data-slot='chorus-fab']"],
	])("%s opens it in place with the field focused", async (_, screen, width, trigger) => {
		await page.viewport(width, 860);
		let root = await mountScreen(screen);
		let nav = root.querySelector('[data-slot="chorus"] > header');
		let dialog = root.querySelector<HTMLDialogElement>("#chorus-compose")!;
		requests = [];

		root.querySelector<HTMLButtonElement>(trigger)!.click();

		expect(dialog.open).toBe(true);
		expect(dialog.matches(":modal")).toBe(true);
		expect(document.activeElement?.id).toBe("chorus-draft-dialog");
		expect(requests).toEqual([]);
		expect(root.querySelector('[data-slot="chorus"] > header')).toBe(nav);
		dialog.close();
	});

	test.each([
		["Reply", "a[href$='compose?reply=p-leonids']", "Reply to Mei Lin", "replyTo"],
		["Quote", "[href$='compose?quote=p-leonids']", "Quote post", "quote"],
	])("%s opens it loaded for that post, the page staying put", async (_, trigger, title, field) => {
		await page.viewport(1280, 860);
		let root = await mountScreen("");
		let nav = root.querySelector('[data-slot="chorus"] > header');
		let dialog = root.querySelector<HTMLDialogElement>("#chorus-compose")!;
		requests = [];

		root.querySelector<HTMLElement>(trigger)!.click();
		await until(() => dialog.open);

		expect(requests).toEqual([
			{
				src: expect.stringContaining(field === "replyTo" ? "reply=" : "quote="),
				target: "chorus-compose-body",
			},
		]);
		expect(dialog.querySelector("h2")?.textContent).toBe(title);
		expect(dialog.querySelector<HTMLInputElement>(`input[name='${field}']`)?.value).toBe(
			"p-leonids",
		);
		expect(document.activeElement?.id).toBe("chorus-draft-dialog");
		expect(root.querySelector('[data-slot="chorus"] > header')).toBe(nav);
		dialog.close();
	});

	test("it floats near the top on a desktop and fills a phone", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("");
		let dialog = root.querySelector<HTMLDialogElement>("#chorus-compose")!;
		dialog.showModal();
		let wide = dialog.getBoundingClientRect();
		dialog.close();
		await page.viewport(375, 812);
		dialog.showModal();
		let narrow = dialog.getBoundingClientRect();
		dialog.close();

		expect(Math.round(wide.width)).toBe(600);
		expect(Math.round(wide.top)).toBe(43);
		expect(wide.height).toBeLessThan(320);
		expect([narrow.top, narrow.left, narrow.width, narrow.height].map(Math.round)).toEqual([
			0, 0, 375, 812,
		]);
	});

	test("sending posts in the background, closes it and opens the new post's page", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("");
		let submits = watchSubmits();
		let permalink = href("post/n-1a2b3c4d");
		let sent: string[] = [];
		let opened: string[] = [];
		WORKER.use(
			http.post(/\/demo\/apps\/chorus\/compose$/, async ({ request }) => {
				let text = (await request.formData()).get("text");
				sent.push(typeof text === "string" ? text : "");
				return new HttpResponse(null, {
					status: 303,
					headers: { Location: `${permalink}?toast=posted` },
				});
			}),
			http.get(/\/demo\/apps\/chorus\/post\//, () => HttpResponse.html("<div></div>")),
		);
		let hold = (event: Event) => {
			opened.push((event as Event & { destination: { url: string } }).destination.url);
			event.preventDefault();
		};
		let aborted = (event: PromiseRejectionEvent) => {
			if (event.reason instanceof DOMException && event.reason.name === "AbortError") {
				event.preventDefault();
			}
		};
		globalThis.navigation?.addEventListener("navigate", hold);
		window.addEventListener("unhandledrejection", aborted);
		onTestFinished(() => {
			window.removeEventListener("unhandledrejection", aborted);
			globalThis.navigation?.removeEventListener("navigate", hold);
			WORKER.resetHandlers();
		});
		let dialog = root.querySelector<HTMLDialogElement>("#chorus-compose")!;
		dialog.showModal();
		let field = root.querySelector<HTMLTextAreaElement>("#chorus-draft-dialog")!;
		field.value = "Hello";
		field.dispatchEvent(new Event("input", { bubbles: true }));

		field.form!.requestSubmit();
		await until(() => opened.length > 0);

		expect(submits.map((submit) => submit.handled)).toEqual([true]);
		expect(dialog.open).toBe(false);
		expect(sent).toEqual(["Hello"]);
		expect(opened.map((url) => new URL(url).pathname)).toEqual([permalink]);
		expect(field.value).toBe("");
	});
});

describe("Chorus's message box", () => {
	test("a shared post's message box comes back empty once the thread redraws without it", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("messages/kofibuilds?share=p-leonids");
		let box = () => root.querySelector<HTMLTextAreaElement>("textarea[name='text']")!;
		expect(box().value).toBe(href("post/p-leonids"));

		await mountedFrame(MAIN_FRAME).reload({ src: href("messages/kofibuilds") });

		expect(box().value).toBe("");
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

describe("Chorus keeps its shell across screens", () => {
	test.each(["", "explore", "notifications", "messages", "u/noorhaddad", "post/p-leonids"])(
		"links in the column on %j load into main and leave the nav and rail as they are",
		async (screen) => {
			await page.viewport(1280, 860);
			let root = await mountScreen(screen);
			let nav = root.querySelector('[data-slot="chorus"] > header')!;
			let rail = root.querySelector('[data-slot="chorus"] > aside')!;
			Object.assign(nav, { marker: screen });
			let addresses = [
				...new Set(
					[...root.querySelectorAll<HTMLAnchorElement>("#chorus-main a[href^='/demo/apps/chorus']")]
						.map((link) => link.getAttribute("href")!)
						.filter((address) => !address.includes("#")),
				),
			].slice(0, 5);
			expect(addresses.length).toBeGreaterThan(0);

			for (let src of addresses) {
				requests = [];
				await mountedFrame(MAIN_FRAME).reload({ src });

				expect(requests, src).toEqual([{ src, target: MAIN_FRAME }]);
				expect(root.querySelector('[data-slot="chorus"] > header'), src).toBe(nav);
				expect(Reflect.get(nav, "marker"), src).toBe(screen);
				expect(root.querySelector('[data-slot="chorus"] > aside'), src).toBe(rail);
				expect(root.querySelector("[data-main-screen]")?.getAttribute("data-url"), src).toBe(src);
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

		await mountedFrame(MAIN_FRAME).reload({ src: following.getAttribute("href")! });

		expect(root.querySelector("h1")?.textContent).toBe("Home: Following");
		expect(
			root.querySelector('nav[aria-label="Timelines"] [aria-current="page"]')?.textContent,
		).toBe("Following");
		expect(root.querySelector('[data-slot="chorus"] > header')).toBe(nav);
		expect(root.querySelector('[data-slot="chorus"] > aside')).toBe(rail);
	});

	test("Explore in main hides the rail's search box, which returns on the next screen", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("");
		let search = () => getComputedStyle(root.querySelector("[data-rail-search]")!).display;
		expect(search()).not.toBe("none");

		await mountedFrame(MAIN_FRAME).reload({ src: href("explore") });
		expect(search()).toBe("none");

		await mountedFrame(MAIN_FRAME).reload({ src: href("notifications") });
		expect(search()).not.toBe("none");
	});
});

describe("Chorus's reactions never leave the page", () => {
	test.each([
		["", "article[data-post]"],
		["post/p-leonids", "article"],
		["u/meilin", "#chorus-main"],
		["explore?tab=people", "#chorus-main"],
		["notifications?tab=mentions", "#chorus-main"],
	])(
		"every like, repost, save and follow on %j posts in the background and keeps scroll and focus",
		async (screen, within) => {
			await page.viewport(375, 812);
			let root = await mountScreen(screen);
			let submits = watchSubmits();
			let marker = Symbol("page");
			Object.assign(window, { chorusMarker: marker });
			let toggles = [
				...root.querySelectorAll<HTMLButtonElement>(
					`${within} form[data-slot="optimistic-toggle"] button[type="submit"]`,
				),
			].slice(0, 8);
			expect(toggles.length).toBeGreaterThan(0);
			window.scrollTo(0, 200);
			await new Promise((resolve) => requestAnimationFrame(resolve));

			for (let button of toggles) {
				button.focus();
				let y = window.scrollY;
				let pressed = button.getAttribute("aria-pressed");
				requests = [];
				posted = [];
				button.click();
				await until(() => posted.length > 0);

				expect(submits.at(-1)?.handled, button.title).toBe(true);
				expect(posted, button.title).toEqual([{ url: expect.any(String), toggle: true }]);
				expect(button.getAttribute("aria-pressed"), button.title).not.toBe(pressed);
				expect(requests, button.title).toEqual([]);
				expect(window.scrollY, button.title).toBe(y);
				expect(document.activeElement, button.title).toBe(button);
				expect(Reflect.get(window, "chorusMarker")).toBe(marker);
			}
		},
	);

	test("a vote reloads its own poll alone, keeping the post around it and the scroll", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("post/p-friday-poll");
		let submits = watchSubmits();
		let name = pollFrame("p-friday-poll");
		let form = root.querySelector<HTMLFormElement>(`form[data-rmx-target="${name}"]`)!;
		let article = root.querySelector("article");
		window.scrollTo(0, 120);
		let y = window.scrollY;
		requests = [];

		form.querySelector<HTMLButtonElement>("button[name='option']")!.click();
		await until(() => requests.length > 0);

		expect(submits.map((submit) => submit.handled)).toEqual([true]);
		expect(requests).toEqual([{ src: form.action, target: name }]);
		expect(root.querySelector("article")).toBe(article);
		expect(window.scrollY).toBe(y);
	});
});
