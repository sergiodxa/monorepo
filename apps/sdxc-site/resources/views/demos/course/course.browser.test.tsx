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
import { LESSON_CLIP, LessonPlayer } from "~/resources/views/demos/course/lesson-player";

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
	test("plays the hosted lesson clip, with every time linking into it", () => {
		mounted = render(<LessonPlayer />);
		let source = mounted.container.querySelector("video source")!;
		expect(source.getAttribute("src")).toBe(LESSON_CLIP);
		let links = [
			...mounted.container.querySelectorAll<HTMLAnchorElement>(
				'[data-slot="video-player-chapters"] a',
			),
		];
		expect(links.map((link) => link.getAttribute("href"))).toEqual(
			CHAPTERS.map((chapter) => `${LESSON_CLIP}#t=${chapter.start}`),
		);
	});

	test("shows the drawn frame through the video once the custom bar takes over", () => {
		mounted = render(<LessonPlayer />);
		let video = mounted.container.querySelector("video")!;
		let bar = mounted.container.querySelector<HTMLElement>('[data-slot="video-player-controls"]')!;
		expect(video.controls).toBe(false);
		expect(getComputedStyle(video).opacity).toBe("0");
		expect(getComputedStyle(bar).opacity).toBe("1");
		video.controls = true;
		expect(getComputedStyle(video).opacity).toBe("1");
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
		let chapter = mounted.container.querySelector(
			'[data-slot="video-player-chapters"] [aria-current]',
		);
		expect(chapter?.textContent).toContain(
			CHAPTERS.filter((entry) => entry.start <= NOW).at(-1)!.title,
		);
		let line = mounted.container.querySelector('[data-slot="video-player-cue"][aria-current]');
		expect(line?.textContent).toContain(
			TRANSCRIPT.filter((entry) => entry.start <= NOW).at(-1)!.text,
		);
	});

	test("shows the overhead camera once it is picked in the settings", () => {
		mounted = render(<LessonPlayer />);
		let side = mounted.container.querySelector<HTMLElement>('[data-camera="side"]')!;
		let overhead = mounted.container.querySelector<HTMLElement>('[data-camera="overhead"]')!;
		expect(getComputedStyle(side).visibility).toBe("visible");
		expect(getComputedStyle(overhead).visibility).toBe("hidden");

		let option = mounted.container.querySelector<HTMLInputElement>(
			'input[name="course-camera"][value="overhead"]',
		)!;
		option.checked = true;
		expect(getComputedStyle(side).visibility).toBe("hidden");
		expect(getComputedStyle(overhead).visibility).toBe("visible");
	});

	test("keeps its dark theater in a light page", () => {
		mounted = render(<LessonPlayer />);
		let stage = mounted.container.querySelector<HTMLElement>('[data-course="player"]')!;
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

	test("sets the questions in two columns of three on a wide screen", async () => {
		await page.viewport(1440, 900);
		mounted = render(course.render());
		let triggers = [...document.querySelectorAll<HTMLElement>("#faq summary")];
		let lefts = new Set(
			triggers.map((trigger) => Math.round(trigger.getBoundingClientRect().left)),
		);
		expect(triggers).toHaveLength(6);
		expect(lefts.size).toBe(2);
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
