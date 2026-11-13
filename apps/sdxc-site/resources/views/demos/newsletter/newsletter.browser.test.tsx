/**
 * Reads Undercurrent's landing in a real browser: every in-page link lands on a section, the
 * sign-ups post as plain forms, the episode's chapters seek its player, the archive opens
 * on its first topic, and a phone neither scrolls sideways nor keeps the menu open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import demo from "~/resources/views/demos/newsletter";
import NewsletterEpisodes from "~/resources/views/demos/newsletter/episodes";
import NewsletterHeader from "~/resources/views/demos/newsletter/header";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/**
 * Clicks `link` the way a visitor's press reaches it, with navigation cancelled once the
 * click has bubbled past the page, so the page under test stays loaded.
 */
function press(link: Element, init: MouseEventInit = {}) {
	document.addEventListener("click", (event) => event.preventDefault(), { once: true });
	link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
}

describe("Undercurrent's landing", () => {
	test("sends every same-page link to a section that exists", () => {
		mounted = render(demo.render());
		let targets = [...mounted.container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')].map(
			(link) => link.getAttribute("href")!.slice(1),
		);
		expect(targets.length).toBeGreaterThan(10);
		let missing = targets.filter((id) => !document.getElementById(id));
		expect(missing).toEqual([]);
	});

	test("signs up through plain forms that post an address", () => {
		mounted = render(demo.render());
		let forms = [
			...mounted.container.querySelectorAll<HTMLFormElement>(
				'[data-slot="undercurrent-subscribe"]',
			),
		];
		expect(forms).toHaveLength(2);
		for (let form of forms) {
			expect(form.method).toBe("post");
			expect(new URL(form.action).pathname).toBe("/examples/newsletter/subscribe");
			let email = form.querySelector<HTMLInputElement>('input[name="email"]')!;
			expect(email.type).toBe("email");
			expect(email.required).toBe(true);
		}
		expect(document.getElementById("subscribe")?.contains(forms[0]!)).toBe(true);
	});

	test("opens the archive on its first topic and keeps the rest folded", () => {
		mounted = render(demo.render());
		let topics = [...mounted.container.querySelectorAll<HTMLDetailsElement>("#archive details")];
		expect(topics.map((topic) => topic.open)).toEqual([true, false, false, false, false, false]);
	});

	test("seeks the episode's player from a chapter, with captions on the audio", () => {
		mounted = render(<NewsletterEpisodes />);
		let audio = mounted.container.querySelector("audio")!;
		expect(audio.querySelector('track[kind="captions"]')?.getAttribute("src")).toBe(
			"/demos/newsletter/episode-63.vtt",
		);
		let chapter = mounted.container.querySelector<HTMLAnchorElement>(
			'[data-slot="episode-player-chapters"] a[data-start="465"]',
		)!;
		expect(chapter.getAttribute("href")).toBe("/demos/newsletter/episode-63.mp3#t=465");
		press(chapter);
		audio.pause();
		expect(audio.currentTime).toBe(465);
		expect(chapter.getAttribute("aria-current")).toBe("true");
	});

	test("fits a phone without scrolling sideways", async () => {
		await page.viewport(375, 812);
		mounted = render(demo.render());
		for (let section of mounted.container.querySelectorAll<HTMLElement>("section")) {
			section.style.contentVisibility = "visible";
		}
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("closes the phone menu when a section link in it is followed", async () => {
		await page.viewport(375, 812);
		mounted = render(<NewsletterHeader />);
		let sheet = mounted.container.querySelector<HTMLDialogElement>(
			'[data-slot="site-header-sheet"]',
		)!;
		let link = sheet.querySelector('[data-slot="site-header-sheet-nav"] a[href="#listen"]')!;
		sheet.showModal();
		press(link);
		expect(sheet.open).toBe(false);
	});
});
