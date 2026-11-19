/**
 * Plays a novel on a touch screen: a tap advances, a downward swipe opens the backlog and an
 * upward swipe rolls back, without the swipe's click advancing the story as well.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { render } from "remix/component/test";
import * as s from "remix/data-schema";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createNovel, createScene, scene, scenes } from "../index.js";

import { touchControls } from "./controls.js";
import { NovelPlayer } from "./player.js";

/** The story state, the same shape the package's fixture declares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

/** Three lines of narration. */
const MESSAGES = { opening: { welcome: "One.", both: "Two.", thinking: "Three." } };

const SCENES = scenes({ prologue: { opening: scene() } });

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.narrate("opening.both"),
	ctx.narrate("opening.thinking"),
]);

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a player over the three-line novel. */
function mount() {
	let novel = createNovel({ scenes: SCENES, state: STATE, initial: SCENES.prologue.opening });
	novel.map(SCENES.prologue.opening, OPENING);
	let container = document.createElement("div");
	container.style.width = "640px";
	container.style.height = "360px";
	document.body.append(container);
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });
	mounted = render(
		<IntlProvider intl={intl}>
			<NovelPlayer novel={novel} settings={{ textSpeed: 0 }} mix={touchControls()} />
		</IntlProvider>,
		{ container },
	);
	return mounted;
}

/** Dispatches a touch pointer gesture from one point to another, then its click. */
function gesture(target: Element, from: [number, number], to: [number, number]): void {
	let init = { bubbles: true, pointerType: "touch", isPrimary: true, pointerId: 7 };
	target.dispatchEvent(
		new PointerEvent("pointerdown", { ...init, clientX: from[0], clientY: from[1] }),
	);
	target.dispatchEvent(new PointerEvent("pointerup", { ...init, clientX: to[0], clientY: to[1] }));
	target.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: to[0], clientY: to[1] }));
}

/** The line on screen once the player waits for the reader. */
async function shows(result: RenderResult, text: string): Promise<void> {
	await vi.waitFor(
		() => {
			expect(result.$("[data-novel-line]")?.textContent).toBe(text);
			expect(result.$("[data-novel-player]")!.dataset["phase"]).toBe("waiting");
		},
		{ timeout: 5000 },
	);
}

describe("NovelPlayer on a touch screen", () => {
	test("runs where the page matches a coarse pointer", () => {
		expect(matchMedia("(pointer: coarse)").matches).toBe(true);
	});

	test("advances on a tap", async () => {
		let result = mount();
		await shows(result, "One.");
		gesture(result.$("[data-novel-surface]")!, [300, 150], [302, 151]);
		await shows(result, "Two.");
	});

	test("opens the backlog on a downward swipe without advancing", async () => {
		let result = mount();
		await shows(result, "One.");
		gesture(result.$("[data-novel-surface]")!, [300, 60], [300, 220]);
		let backlog = result.$("[data-novel-backlog]") as HTMLDialogElement;
		await vi.waitFor(() => expect(backlog.open).toBe(true));
		expect(result.$("[data-novel-line]")!.textContent).toBe("One.");
	});

	test("rolls back on an upward swipe", async () => {
		let result = mount();
		await shows(result, "One.");
		gesture(result.$("[data-novel-surface]")!, [300, 150], [301, 151]);
		await shows(result, "Two.");
		gesture(result.$("[data-novel-surface]")!, [300, 250], [300, 80]);
		await shows(result, "One.");
	});

	test("lets the player take every gesture instead of scrolling the page", () => {
		mount();
		expect(getComputedStyle(mounted!.$("[data-novel-player]")!).touchAction).toBe("none");
	});
});
