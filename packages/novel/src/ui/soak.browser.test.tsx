/**
 * Plays hundreds of lines through `NovelPlayer.Default` in one session and holds the page's live
 * heap and element count flat, so a reader who plays for hours never runs the tab out of memory
 * because each line kept the previous render reachable.
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
import { afterEach, expect, test } from "vitest";

import { assets, cast, character, createNovel, createScene, scene, scenes } from "../index.js";

import { BacklogModel } from "./behaviors/backlog.js";
import { NovelPlayer } from "./player.js";

/** An SVG image as a data URL, so images decode without a server. */
function svg(color: string, width = 320, height = 640): string {
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`,
	)}`;
}

/** The story state the package's typed fixture declares; this novel never reads it. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

/** The catalog, drawn from the package's typed fixture keys. */
const MESSAGES = {
	cast: { mika: "Mika" },
	titles: { opening: "Opening", cafe: "The café" },
	opening: {
		welcome: "Welcome.",
		both: "Together!",
		thinking: "I should say something.",
		lucky: "Lucky day.",
	},
};

/** The text of each line the loop shows, in order, alternating speaker and narrator. */
const LINES = [
	MESSAGES.opening.welcome,
	MESSAGES.opening.both,
	MESSAGES.opening.thinking,
	MESSAGES.opening.lucky,
];

const SCENES = scenes({
	soak: { intro: scene({ title: "titles.opening" }), loop: scene({ title: "titles.cafe" }) },
});

const CAST = cast({
	mika: character({ name: "cast.mika", sprites: { smile: svg("pink"), neutral: svg("hotpink") } }),
});

const ASSETS = assets({ backgrounds: { cafe: svg("green", 1600, 900) } });

const INTRO = createScene(SCENES.soak.intro, (ctx) => [
	ctx.show(ASSETS.backgrounds.cafe),
	ctx.enter(CAST.mika, { at: "center", expression: "smile" }),
	ctx.goto(SCENES.soak.loop),
]);

const LOOP = createScene(SCENES.soak.loop, (ctx) => [
	ctx.say(CAST.mika, "opening.welcome"),
	ctx.narrate("opening.both"),
	ctx.say(CAST.mika, "opening.thinking"),
	ctx.narrate("opening.lucky"),
	ctx.goto(SCENES.soak.loop),
]);

/** A novel that never ends: one character on stage, four lines, then the same scene again. */
function loopingNovel() {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		state: STATE,
		initial: SCENES.soak.intro,
	});
	novel.map(SCENES.soak.intro, INTRO);
	novel.map(SCENES.soak.loop, LOOP);
	return novel;
}

/** The page globals the memory probe flags expose. */
interface MemoryProbe {
	gc?: () => void;
	performance: Performance & { memory?: { usedJSHeapSize: number } };
}

/** Collects garbage until the heap settles, then returns the live heap in bytes. */
async function liveHeap(): Promise<number> {
	let probe = globalThis as unknown as MemoryProbe;
	for (let pass = 0; pass < 3; pass++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		probe.gc!();
	}
	return probe.performance.memory!.usedJSHeapSize;
}

/**
 * Lines the backlog keeps. The backlog dialog draws every kept line, so the DOM grows until it
 * is full; a short backlog lets a short warm-up reach the steady state.
 */
const BACKLOG_LINES = 20;

/** Lines played before the first measurement: past the backlog's cap, with every code path warm. */
const WARM_UP_LINES = 60;

/** Lines played between the two measurements. */
const SOAK_LINES = 300;

/**
 * How much the live heap may grow across {@link SOAK_LINES}. A render that keeps the previous one
 * reachable grows it by hundreds of kilobytes per line; a steady player stays within noise.
 */
const HEAP_BUDGET_BYTES = 2_000_000;

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts the default player over the looping novel with instant text, in a 960×540 box. */
function mount() {
	let container = document.createElement("div");
	container.style.width = "960px";
	container.style.height = "540px";
	document.body.append(container);
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });
	mounted = render(
		<IntlProvider intl={intl}>
			<NovelPlayer.Default
				novel={loopingNovel()}
				start={{ seed: "soak" }}
				settings={{ textSpeed: 0 }}
				behaviors={{ backlog: new BacklogModel(BACKLOG_LINES) }}
			/>
		</IntlProvider>,
		{ container },
	);
	let result = mounted;
	let shown = 0;
	/**
	 * Clicks the stage and resolves once the next line in the loop waits for the reader, polling
	 * on macrotasks so hundreds of lines take a couple of seconds.
	 */
	async function advance(): Promise<void> {
		let expected = LINES[shown % LINES.length];
		if (shown > 0) (result.$("[data-novel-surface]") as HTMLElement).click();
		for (let tick = 0; tick < 2000; tick++) {
			let player = result.$("[data-novel-player]") as HTMLElement | null;
			let line = result.$("[data-novel-line]")?.textContent;
			if (line === expected && player?.dataset["phase"] === "waiting") {
				shown++;
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		throw new Error(`Line ${shown} never showed "${expected}".`);
	}
	return { advance, elements: () => container.getElementsByTagName("*").length };
}

test("keeps the heap and the DOM flat across hundreds of lines", { timeout: 60_000 }, async () => {
	let player = mount();
	for (let line = 0; line < WARM_UP_LINES; line++) await player.advance();
	let heapBefore = await liveHeap();
	let elementsBefore = player.elements();

	for (let line = 0; line < SOAK_LINES; line++) await player.advance();
	let heapAfter = await liveHeap();

	expect(player.elements()).toBe(elementsBefore);
	expect(heapAfter - heapBefore, `heap grew from ${heapBefore} to ${heapAfter} bytes`).toBeLessThan(
		HEAP_BUDGET_BYTES,
	);
});
