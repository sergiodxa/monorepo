/**
 * Runtime prefetch in a real browser: the files of the scenes within reach warmed the way the
 * player uses them (images decoded, sounds into the mixer, music as prefetch links), each URL
 * once, `data:` URLs skipped, waiting work dropped on leaving a scene, and the player's wiring.
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

import {
	assets,
	cast,
	character,
	createNovel,
	createScene,
	lazy,
	scene,
	scenes,
} from "../index.js";

import { AudioMixer } from "./audio.js";
import { NovelPlayer } from "./player.js";
import { Prefetcher } from "./prefetch.js";
import { DEFAULT_SETTINGS } from "./settings.js";

const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({ opening: scene(), cafe: scene(), far: scene() });

/** A small image as a data URL, which prefetching skips. */
const INLINE = `data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"/>',
)}`;

const CAST = cast({
	mika: character({ name: "cast.mika", sprites: { smile: "/prefetch/mika.png" } }),
});

const ASSETS = assets({
	backgrounds: { room: INLINE, cafe: "/prefetch/cafe.png", far: "/prefetch/far.png" },
	music: { chill: "/prefetch/chill.ogg" },
	sounds: { door: "/prefetch/door.wav" },
});

const OPENING = createScene(SCENES.opening, (ctx) => [
	ctx.show(ASSETS.backgrounds.room),
	ctx.narrate("opening.welcome"),
	ctx.narrate("opening.thinking"),
	ctx.goto(SCENES.cafe),
]);

const CAFE = createScene(SCENES.cafe, (ctx) => [
	ctx.show(ASSETS.backgrounds.cafe),
	ctx.play(ASSETS.music.chill),
	ctx.enter(CAST.mika, { at: "left", expression: "smile" }),
	ctx.play(ASSETS.sounds.door),
	ctx.say(CAST.mika, "opening.lucky"),
	ctx.goto(SCENES.far),
]);

const FAR = createScene(SCENES.far, (ctx) => [
	ctx.show(ASSETS.backgrounds.far),
	ctx.narrate("opening.done"),
]);

/** The fixture with every scene but the first mapped lazily. */
function fixture() {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		state: STATE,
		initial: SCENES.opening,
	});
	novel.map(SCENES.opening, OPENING);
	novel.map(
		SCENES.cafe,
		lazy(async () => ({ default: CAFE })),
	);
	novel.map(
		SCENES.far,
		lazy(async () => ({ default: FAR })),
	);
	return novel;
}

let mounted: RenderResult | undefined;
let mixers: AudioMixer[] = [];

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	for (let mixer of mixers) mixer.dispose();
	mixers = [];
	for (let link of document.head.querySelectorAll('link[rel="prefetch"]')) link.remove();
	vi.restoreAllMocks();
});

/** A prefetcher over the fixture with its own mixer. */
function prefetcher(concurrency?: number) {
	let novel = fixture();
	let mixer = new AudioMixer(DEFAULT_SETTINGS.volume);
	mixers.push(mixer);
	return new Prefetcher({ novel: () => novel, mixer: () => mixer }, concurrency);
}

describe(Prefetcher, () => {
	test("warms each reachable file once, the way the player uses it", async () => {
		let preload = vi.spyOn(AudioMixer.prototype, "preload");
		let warm = prefetcher();
		await warm.enter("opening", { depth: 1, locale: "en" });
		await vi.waitFor(() => expect(warm.warmed).toHaveLength(4));
		expect(warm.warmed).toEqual([
			"/prefetch/cafe.png",
			"/prefetch/chill.ogg",
			"/prefetch/mika.png",
			"/prefetch/door.wav",
		]);
		expect(preload).toHaveBeenCalledWith("/prefetch/door.wav");
		expect(
			[...document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]')].map(
				(link) => new URL(link.href).pathname,
			),
		).toEqual(["/prefetch/chill.ogg"]);

		await warm.enter("cafe", { depth: 1, locale: "en" });
		await vi.waitFor(() => expect(warm.warmed).toHaveLength(5));
		expect(warm.warmed.at(-1)).toBe("/prefetch/far.png");
	});

	test("drops the files still waiting when the play enters another scene", async () => {
		let warm = prefetcher(1);
		let first = warm.enter("opening", { depth: 1, locale: "en" });
		await first;
		expect(warm.warmed).toEqual(["/prefetch/cafe.png"]);
		await warm.enter("far", { depth: 0, locale: "en" });
		await vi.waitFor(() => expect(warm.warmed).toContain("/prefetch/far.png"));
		expect(warm.warmed).not.toContain("/prefetch/door.wav");
	});
});

/** Mounts a player over the fixture with instant text. */
function mount(props: Partial<NovelPlayer.Props> = {}) {
	let container = document.createElement("div");
	container.style.width = "960px";
	container.style.height = "540px";
	document.body.append(container);
	let intl = createI18n({
		locale: "en",
		fallbackLanguage: "en",
		resources: {
			en: {
				cast: { mika: "Mika" },
				opening: { welcome: "Welcome.", thinking: "Hm.", lucky: "Lucky.", done: "Done." },
			},
		},
	});
	mounted = render(
		<IntlProvider intl={intl}>
			<NovelPlayer.Default
				novel={fixture()}
				start={{ seed: "prefetch" }}
				settings={{ textSpeed: 0 }}
				{...props}
			/>
		</IntlProvider>,
		{ container },
	);
	return mounted;
}

/** The prefetch links the player added. */
function links(): string[] {
	return [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]')].map(
		(link) => new URL(link.href).pathname,
	);
}

describe("NovelPlayer prefetch", () => {
	test("prefetches the next scene's files when the play enters a scene", async () => {
		let preload = vi.spyOn(AudioMixer.prototype, "preload");
		let result = mount();
		await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe("Welcome."));
		await vi.waitFor(() => expect(links()).toEqual(["/prefetch/chill.ogg"]));
		await vi.waitFor(() => expect(preload).toHaveBeenCalledWith("/prefetch/door.wav"));
		expect(preload).toHaveBeenCalledTimes(1);
	});

	test("prefetches nothing with prefetch={false}", async () => {
		let preload = vi.spyOn(AudioMixer.prototype, "preload");
		let result = mount({ prefetch: false });
		await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe("Welcome."));
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(links()).toEqual([]);
		expect(preload).not.toHaveBeenCalled();
	});
});
