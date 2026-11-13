/**
 * Checks Centered's landing in a real browser: the lesson player is a native video whose
 * clip lasts exactly as long as the lesson and whose chapters and captions load as tracks,
 * every in-page link lands on a section, the phone sheet closes, and nothing overflows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { CourseHeader } from "~/resources/views/demos/course/chrome";
import { CourseCurriculum } from "~/resources/views/demos/course/curriculum";
import {
	CHAPTERS,
	FREE_LESSONS,
	LESSONS,
	NOW,
	PREVIEW,
	TRANSCRIPT,
} from "~/resources/views/demos/course/data";
import course from "~/resources/views/demos/course/index";
import { LessonPlayer } from "~/resources/views/demos/course/lesson-player";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Resolves once `target` fires `type`, or rejects after five seconds. */
function once(target: EventTarget, type: string): Promise<void> {
	return new Promise((resolve, reject) => {
		let timer = setTimeout(() => reject(new Error(`no ${type} event`)), 5000);
		target.addEventListener(
			type,
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

describe("the lesson player", () => {
	test("plays a clip exactly as long as the lesson it previews", async () => {
		mounted = render(<LessonPlayer />);
		let video = mounted.container.querySelector("video")!;
		expect(video.controls).toBe(true);
		video.preload = "metadata";
		let loaded = once(video, "loadedmetadata");
		video.load();
		await loaded;
		expect(Math.round(video.duration)).toBe(PREVIEW.seconds);
	});

	test("hands the chapters and transcript to the native player as tracks", async () => {
		mounted = render(<LessonPlayer />);
		let [chapters, captions] = [...mounted.container.querySelectorAll("track")];
		expect(chapters!.kind).toBe("chapters");
		expect(captions!.kind).toBe("captions");
		chapters!.track.mode = "hidden";
		captions!.track.mode = "hidden";
		await Promise.all(
			[chapters!, captions!].map((track) =>
				track.readyState === 2 ? Promise.resolve() : once(track, "load"),
			),
		);
		expect(chapters!.track.cues).toHaveLength(CHAPTERS.length);
		expect(captions!.track.cues).toHaveLength(TRANSCRIPT.length);
		let last = captions!.track.cues![TRANSCRIPT.length - 1]!;
		expect(last.endTime).toBe(PREVIEW.seconds);
	});

	test("marks the chapter and the transcript line playing at the rendered moment", () => {
		mounted = render(<LessonPlayer />);
		let chapter = mounted.container.querySelector('[data-slot="course-chapters"] [aria-current]');
		let expected = CHAPTERS.filter((entry) => entry.start <= NOW).at(-1)!;
		expect(chapter?.textContent).toContain(expected.title);
		let line = mounted.container.querySelector('[data-slot="course-transcript"] [aria-current]');
		expect(line?.textContent).toContain(
			TRANSCRIPT.filter((entry) => entry.start <= NOW).at(-1)!.text,
		);
	});

	test("keeps light ink on its dark stage in a light page", () => {
		mounted = render(<LessonPlayer />);
		let stage = mounted.container.querySelector<HTMLElement>('[data-slot="course-player"]')!;
		expect(getComputedStyle(stage).colorScheme).toBe("dark");
	});
});

describe("the curriculum", () => {
	test("lists every lesson and marks exactly the free previews", () => {
		mounted = render(<CourseCurriculum />);
		let rows = mounted.container.querySelectorAll('[data-slot="curriculum-lesson"]');
		expect(rows).toHaveLength(LESSONS.length);
		let badges = mounted.container.querySelectorAll('[data-slot="curriculum-lesson-badge"]');
		expect(badges).toHaveLength(FREE_LESSONS);
	});
});

describe("the whole page", () => {
	test("sends every in-page link to a section that exists", () => {
		mounted = render(course.render());
		let links = [...mounted.container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
		expect(links.length).toBeGreaterThan(10);
		for (let link of links) {
			let id = link.getAttribute("href")!.slice(1);
			expect(document.getElementById(id), `#${id}`).not.toBeNull();
		}
	});

	test("fits a 375px phone with no sideways scroll", async () => {
		await page.viewport(375, 812);
		mounted = render(course.render());
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("closes the phone sheet when a section link in it is followed", async () => {
		await page.viewport(375, 812);
		mounted = render(<CourseHeader />);
		let sheet = mounted.container.querySelector<HTMLDialogElement>(
			'[data-slot="site-header-sheet"]',
		)!;
		let link = sheet.querySelector('[data-slot="site-header-sheet-nav"] a[href]')!;
		sheet.showModal();
		document.addEventListener("click", (event) => event.preventDefault(), { once: true });
		link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		await expect.poll(() => sheet.open).toBe(false);
	});
});
