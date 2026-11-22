/**
 * Runs Murmur like a listener's browser does: a track started on an album keeps playing, on
 * the same media element and without restarting, while the listener moves through other
 * screens, because only the `main` frame swaps. The queue, Next and the Media Session follow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import murmur from "~/resources/views/demo-apps/murmur";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: MountedApp | undefined;

beforeEach(async () => {
	await page.viewport(1280, 800);
});

afterEach(() => {
	mounted?.dispose();
	mounted = undefined;
	document.documentElement.removeAttribute("data-now-context");
	document.documentElement.removeAttribute("data-audio-paused");
});

/** The player's media element. */
function media(): HTMLAudioElement {
	let element = document.getElementById("murmur-audio");
	if (!(element instanceof HTMLAudioElement)) throw new Error("Murmur drew no audio element");
	return element;
}

/** Presses a link the way a visitor does, so the frame sync claims it first. */
async function press(element: Element | null) {
	if (!(element instanceof HTMLElement)) throw new Error("Nothing to press");
	element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
	element.click();
}

/** The address of the screen now in `main`. */
function screenUrl(): string | undefined {
	return document.querySelector<HTMLElement>("[data-main-screen]")?.dataset.url;
}

/** Waits until the media has played past a time, so a test reads a moving clock. */
async function playedPast(seconds: number) {
	await vi.waitFor(
		() => {
			expect(media().paused).toBe(false);
			expect(media().currentTime).toBeGreaterThan(seconds);
		},
		{ timeout: 10_000, interval: 50 },
	);
}

describe("Murmur's player", () => {
	test("keeps playing the same track through two navigations, its time still advancing", async () => {
		mounted = await mountApp(murmur, "murmur", "album/tidelight");
		let bar = document.querySelector("[data-player-bar]");

		let play = document.querySelector('button[aria-label="Play Salt Glass by Lumen Harbor"]');
		if (!(play instanceof HTMLElement)) throw new Error("No play button for Salt Glass");
		await userEvent.click(play);
		await playedPast(0.4);
		let audio = media();
		let source = audio.currentSrc;
		let before = audio.currentTime;

		await press(document.querySelector('nav[aria-label="Primary"] a[data-main-nav="search"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/showcase/murmur/demo/search"));
		await press(document.querySelector('a[href="/showcase/murmur/demo/genre/house"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/showcase/murmur/demo/genre/house"));
		await playedPast(before + 0.3);

		expect(media()).toBe(audio);
		expect(audio.currentSrc).toBe(source);
		expect(document.querySelector("[data-player-bar]")).toBe(bar);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		expect(mounted.requests.filter((line) => line.endsWith(" main"))).toEqual([
			"GET /showcase/murmur/demo/search main",
			"GET /showcase/murmur/demo/genre/house main",
		]);
		expect(document.querySelector("[data-player-track]")?.textContent).toContain("Salt Glass");
	});

	test("marks the playing row, moves on with Next and tells the system what plays", async () => {
		mounted = await mountApp(murmur, "murmur", "album/tidelight");

		let play = document.querySelector('button[aria-label="Play Tidelight"]');
		if (!(play instanceof HTMLElement)) throw new Error("No play button for the album");
		await userEvent.click(play);
		await playedPast(0.1);

		let row = () =>
			document.querySelector('tr[aria-current="true"]')?.getAttribute("data-track-id");
		await vi.waitFor(() => expect(row()).toBe("tidelight-1"));
		expect(navigator.mediaSession.metadata?.title).toBe("First Light on the Breakwater");
		expect(document.documentElement.getAttribute("data-now-context")).toBe("album:tidelight");
		expect(play.getAttribute("aria-label")).toBe("Pause Tidelight");

		let next = document.querySelector("[data-player-bar] [data-player-next]");
		if (!(next instanceof HTMLElement)) throw new Error("No Next button");
		await userEvent.click(next);
		await vi.waitFor(() => expect(row()).toBe("tidelight-2"));
		expect(navigator.mediaSession.metadata?.title).toBe("Salt Glass");
		await playedPast(0.1);

		let toggle = document.querySelector("[data-player-bar] [data-player-toggle]");
		if (!(toggle instanceof HTMLElement)) throw new Error("No play toggle");
		await userEvent.click(toggle);
		await vi.waitFor(() => expect(media().paused).toBe(true));
		expect(document.documentElement.hasAttribute("data-audio-paused")).toBe(true);
	});
});
