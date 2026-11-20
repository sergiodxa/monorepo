/**
 * Holds Parley to the single-page contract in a real browser: moving between conversations
 * and opening a thread swap only the main frame, and the live island marks a conversation
 * read, shows who is typing, adds each line the stream posts and reports what it saw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import parley from "~/resources/views/demo-apps/parley";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: MountedApp | undefined;

/** Every background post the live island sent, as its form body. */
let posted: string[] = [];

/**
 * The server behind the island's own fetches: each live stream as Parley's `stream` answers it,
 * with its real pauses, and every background post answered as the action route redirects.
 */
const WORKER = setupWorker(
	http.post(/\/demo\/apps\/parley\//, async ({ request }) => {
		posted.push(await request.text());
		return new HttpResponse(null, { status: 303, headers: { Location: "/demo/apps/parley" } });
	}),
	http.get(/\/demo\/apps\/parley\/streams\//, ({ request }) => {
		let url = new URL(request.url);
		let part = url.pathname.replace(/^\/demo\/apps\/parley\/streams\//, "");
		let stream = parley.stream?.(part, { page: part, url, cookie: null });
		if (stream === null || stream === undefined) return new HttpResponse(null, { status: 404 });
		return new HttpResponse(stream.pipeThrough(new TextEncoderStream()), {
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}),
);

beforeAll(async () => {
	await WORKER.start({ quiet: true, onUnhandledRequest: "bypass" });
});

afterAll(() => {
	WORKER.stop();
});

afterEach(() => {
	mounted?.dispose();
	mounted = undefined;
	posted = [];
});

/** Presses a link or button the way a visitor does, so the island claims it first. */
function press(element: Element | null) {
	if (!(element instanceof HTMLElement)) throw new Error("Nothing to press");
	element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
	element.click();
}

/** The address of the screen now in `main`. */
function screenUrl(): string | undefined {
	return document.querySelector<HTMLElement>("[data-main-screen]")?.dataset.url;
}

describe("Parley as a single-page app", () => {
	test("moves between conversations and into a thread in main alone", async () => {
		await page.viewport(1280, 800);
		mounted = await mountApp(parley, "parley", "c/general");
		let sidebar = document.querySelector("#parley-sidebar");

		press(document.querySelector('a[data-main-nav="c:launch-v3"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/parley/c/launch-v3"));
		press(document.querySelector('[data-slot="message-group-thread"][href*="thread=l3"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/parley/c/launch-v3?thread=l3"));

		expect(document.querySelector("#parley-sidebar")).toBe(sidebar);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		expect(document.querySelector('[data-live-log="thread-l3"]')?.textContent).toContain(
			"AVFoundation",
		);
		expect(mounted.requests.slice(-2)).toEqual([
			"GET /demo/apps/parley/c/launch-v3 main",
			"GET /demo/apps/parley/c/launch-v3?thread=l3 main",
		]);
	});
});

describe("Parley live", () => {
	test("marks the conversation read, shows who types, then adds their line", async () => {
		await page.viewport(1280, 800);
		mounted = await mountApp(parley, "parley", "d/theo");

		await vi.waitFor(() => expect(posted).toContain("intent=read"));
		let row = document.querySelector('[data-conversation="d:theo"]');
		expect(row?.hasAttribute("data-unread")).toBe(false);
		expect(row?.querySelector("[data-slot=app-shell-count]")).toBeNull();

		let typing = document.querySelector<HTMLElement>("[data-slot=typing-indicator]");
		await vi.waitFor(() => expect(typing?.textContent).toContain("Theo is typing…"), {
			timeout: 8000,
		});
		await vi.waitFor(
			() =>
				expect(document.querySelector('[data-live-log="log"]')?.textContent).toContain(
					"Redeploy is green",
				),
			{ timeout: 8000 },
		);
		expect(typing?.hasAttribute("data-empty")).toBe(true);
		await vi.waitFor(() => expect(posted).toContain("intent=seen&live=0"));
	}, 20_000);
});

describe("Parley emoji", () => {
	test("a quick reaction flips in place and posts in the background", async () => {
		await page.viewport(1280, 800);
		mounted = await mountApp(parley, "parley", "c/general");
		let requests = mounted.requests.length;
		let message = document.querySelector('[data-message="g5"]')!;
		let quick = message.querySelector<HTMLButtonElement>('[data-quick-react] button[value="🎉"]');
		quick?.click();
		let chip = message.querySelector('[data-slot=reaction][data-emoji="🎉"]');
		expect(chip?.getAttribute("aria-pressed")).toBe("true");
		expect(chip?.querySelector("[data-reaction-count]")?.textContent).toBe("1");
		await vi.waitFor(() => expect(posted.some((body) => body.includes("intent=react"))).toBe(true));
		expect(mounted.requests).toHaveLength(requests);
	});

	test("the shared picker adds a reaction, custom emoji included", async () => {
		await page.viewport(1280, 800);
		mounted = await mountApp(parley, "parley", "c/launch-v3");
		document.querySelector<HTMLElement>('[data-message="l5"] [data-emoji-react="l5"]')?.click();
		let panel = document.getElementById("parley-emoji")!;
		await vi.waitFor(() =>
			expect(panel.querySelector('[data-emoji-cell][data-name="shipit"]')).not.toBeNull(),
		);
		expect(panel.matches(":popover-open")).toBe(true);
		panel.querySelector<HTMLButtonElement>('[data-emoji-cell][data-name="shipit"]')!.click();
		let chip = document.querySelector(
			'[data-message="l5"] [data-slot=reaction][data-emoji=":shipit:"]',
		);
		expect(chip?.getAttribute("aria-pressed")).toBe("true");
		expect(chip?.querySelector("img")?.getAttribute("src")).toBe("/demos/parley/emoji/shipit.svg");
		expect(panel.matches(":popover-open")).toBe(false);
		await vi.waitFor(() =>
			expect(posted.some((body) => body.includes("emoji=%3Ashipit%3A"))).toBe(true),
		);
	});

	test("the composer inserts a picked emoji and completes a typed shortcode", async () => {
		await page.viewport(1280, 800);
		mounted = await mountApp(parley, "parley", "c/design");
		let field = document.querySelector<HTMLTextAreaElement>("#composer-c-design")!;
		document.querySelector<HTMLElement>('[data-emoji-insert="composer-c-design"]')?.click();
		let panel = document.getElementById("parley-emoji")!;
		await vi.waitFor(() =>
			expect(panel.querySelector('[data-emoji-cell][data-name="tada"]')).not.toBeNull(),
		);
		panel.querySelector<HTMLButtonElement>('[data-emoji-cell][data-name="tada"]')!.click();
		expect(field.value).toBe("🎉");

		await userEvent.type(field, " ship :tad");
		let suggest = document.getElementById("composer-c-design-emoji-suggest")!;
		await vi.waitFor(() => expect(suggest.textContent).toContain("tada"));
		await userEvent.keyboard("{Enter}");
		await vi.waitFor(() => expect(field.value).toBe("🎉 ship 🎉"));
	});
});
