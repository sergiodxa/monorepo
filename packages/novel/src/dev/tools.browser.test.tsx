/**
 * The panel's tools that reach past the play, in a real browser: previews of library screens
 * over any library drawn inside the linked player, unlocks edited one by one, why each character
 * counts as met, sample toasts, the player's own screens, and the floating panel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { unwrap } from "@sdxc/result";
import { render } from "remix/component/test";
import * as s from "remix/data-schema";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Play, StartOptions } from "../index.js";

import {
	assets,
	cast,
	chapter,
	character,
	createNovel,
	createScene,
	encyclopedia,
	entry,
	scene,
	scenes,
	topic,
} from "../index.js";
import { AudioMixer, NovelPlayer } from "../ui.js";

import { createDevTools } from "./devtools.js";
import { NovelDevTools } from "./panel.js";

/** An SVG image as a data URL, so images decode without a server. */
function svg(color: string): string {
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="100%" height="100%" fill="${color}"/></svg>`,
	)}`;
}

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

/** The catalog the player and the screens translate through. */
const MESSAGES = {
	cast: { mika: "Mika", ren: "Ren", mikaPast: "Before the café", mikaPastBody: "She sailed." },
	chapters: { prologue: "Prologue" },
	lore: { places: "Places", pier: "The pier" },
	opening: { welcome: "Welcome.", both: "Together!", lucky: "Lucky day.", done: "Done." },
	endings: { good: "Good ending" },
};

const SCENES = scenes({
	prologue: chapter({ title: "chapters.prologue", scenes: { opening: scene(), cafe: scene() } }),
});

const CAST = cast({
	mika: character({
		name: "cast.mika",
		sprites: { smile: svg("pink") },
		bio: { past: { title: "cast.mikaPast", body: "cast.mikaPastBody" } },
	}),
	ren: character({ name: "cast.ren" }),
});

const ASSETS = assets({
	images: { letter: svg("white"), kiss: svg("red") },
	sounds: { tick: svg("black"), chime: svg("gray") },
});

const LORE = encyclopedia({
	places: topic({ name: "lore.places", entries: { pier: entry({ title: "lore.pier" }) } }),
});

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.say(CAST.mika, "opening.both"),
	ctx.narrate("opening.lucky"),
	ctx.goto(SCENES.prologue.cafe),
]);

const CAFE = createScene(SCENES.prologue.cafe, (ctx) => [
	ctx.show(ASSETS.images.letter),
	ctx.show(ASSETS.images.kiss),
	ctx.narrate("opening.done"),
	ctx.ending("endings.good"),
]);

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	vi.restoreAllMocks();
});

/**
 * Mounts the panel over a fresh novel, beside a player linked through `NovelDevTools.Connect`
 * when `player` is set (opening on a title screen that links too under `title`), all under a
 * translator; `sounds` gives the player its hover and select sounds.
 */
function mount(
	options: { player?: boolean; title?: boolean; sounds?: boolean; floating?: boolean } = {},
) {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		encyclopedia: LORE,
		state: STATE,
		initial: SCENES.prologue.opening,
	});
	novel.map(SCENES.prologue.opening, OPENING);
	novel.map(SCENES.prologue.cafe, CAFE);
	let starts: StartOptions[] = [];
	let devtools = createDevTools(novel, { restart: (start) => starts.push(start) });
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });
	let container = document.createElement("div");
	document.body.append(container);
	let game: RemixNode =
		options.player === true ? (
			<div
				style={{
					inlineSize: "640px",
					blockSize: "360px",
					"--novel-library-locked-color": "rgb(1, 2, 3)",
				}}
			>
				<NovelPlayer.Default
					novel={novel}
					start={{ seed: "dev" }}
					settings={{ textSpeed: 0 }}
					titleScreen={
						options.title === true
							? { heading: "The Café", parts: <NovelDevTools.Connect devtools={devtools} /> }
							: undefined
					}
					sounds={
						options.sounds === true
							? { hover: ASSETS.sounds.tick, select: ASSETS.sounds.chime }
							: undefined
					}
				>
					<NovelDevTools.Connect devtools={devtools} />
				</NovelPlayer.Default>
			</div>
		) : null;
	mounted = render(
		<IntlProvider intl={intl}>
			{game}
			<NovelDevTools devtools={devtools} floating={options.floating} />
		</IntlProvider>,
		{ container },
	);
	let result = mounted;
	return {
		novel,
		devtools,
		starts,
		result,
		/** The panel itself, which a floating panel shows as a popover. */
		panel: () => result.$("aside[aria-label='Novel developer tools']") as HTMLElement,
		/** Opens the disclosure whose summary reads `label`. */
		async open(label: string) {
			let summary = [...result.$$("aside summary")].find((node) =>
				node.textContent?.startsWith(label),
			);
			if (summary === undefined) throw new Error(`No "${label}" section`);
			await userEvent.click(summary);
		},
		/** Finds a panel button by its text. */
		button(label: string): HTMLButtonElement {
			let found = [...result.$$("aside button")].find((node) => node.textContent?.trim() === label);
			if (found === undefined) throw new Error(`No "${label}" button`);
			return found as HTMLButtonElement;
		},
	};
}

/** Advances a fresh play through its first `count` lines. */
async function playLines(play: Play, count: number): Promise<void> {
	let step = await play.next();
	for (let index = 1; index < count && !step.done; index += 1) {
		let frame = step.value;
		if (frame.type !== "line") throw new Error(`Expected a line, got ${frame.type}`);
		step = await play.next(frame.advance());
	}
}

/** The unlocked state of every image the open preview's gallery lists, inside `surface`. */
function galleryStates(result: RenderResult, surface = "[data-novel-player]"): string[] {
	return [...result.$$(`${surface} dialog[open] [data-novel-gallery] [data-image]`)].map(
		(node) => (node as HTMLElement).dataset["unlocked"] ?? "",
	);
}

describe("screen previews", () => {
	test("draw a library screen over any library inside the linked player", async () => {
		let panel = mount({ player: true });
		await vi.waitFor(() => expect(panel.devtools.player).toBeDefined());
		await vi.waitFor(() => expect(panel.devtools.persistent).toBeDefined());
		await panel.open("Screens");
		await userEvent.selectOptions(
			panel.result.$("aside select[name=library]") as HTMLSelectElement,
			"unlocked",
		);
		await userEvent.click(panel.result.$("aside [data-screen=gallery]") as HTMLElement);
		await vi.waitFor(() => expect(galleryStates(panel.result)).toEqual(["true", "true"]));
		let dialog = panel.result.$("[data-novel-player] dialog[open]") as HTMLDialogElement;
		expect(getComputedStyle(dialog).getPropertyValue("--novel-library-locked-color")).toBe(
			"rgb(1, 2, 3)",
		);
		await userEvent.selectOptions(dialog.querySelector("select") as HTMLSelectElement, "locked");
		await vi.waitFor(() => expect(galleryStates(panel.result)).toEqual(["false", "false"]));
		expect(panel.starts).toEqual([]);
		dialog = panel.result.$("[data-novel-player] dialog[open]") as HTMLDialogElement;
		dialog.close();
		await vi.waitFor(() => expect(panel.devtools.preview).toBeUndefined());
		expect(panel.result.$("[data-novel-player] dialog[open]")).toBeNull();
	});

	test("open the player's own screens and fire its toasts", async () => {
		let panel = mount({ player: true });
		await vi.waitFor(() => expect(panel.devtools.player).toBeDefined());
		await panel.open("Player");
		await userEvent.click(panel.result.$("aside [data-sample=entry]") as HTMLElement);
		await vi.waitFor(() =>
			expect(panel.result.$("[data-novel-notification][data-kind=entry]")?.textContent).toContain(
				"New entry: The pier",
			),
		);
		await panel.open("Screens");
		await userEvent.click(panel.result.$("aside [data-screen=settings]") as HTMLElement);
		await vi.waitFor(() =>
			expect(
				panel.result.$("[data-novel-player] dialog[open][data-novel-settings]"),
			).not.toBeNull(),
		);
	});

	test("wait for a linked player before driving one", async () => {
		let panel = mount();
		await panel.open("Screens");
		await panel.open("Player");
		expect(panel.panel().textContent).toContain("NovelDevTools.Connect");
		expect((panel.result.$("aside [data-screen=gallery]") as HTMLButtonElement).disabled).toBe(
			true,
		);
		expect((panel.result.$("aside [data-sample=entry]") as HTMLButtonElement).disabled).toBe(true);
		expect(panel.result.$("aside [data-sound]")).toBeNull();
	});

	test("link the title screen, previewing inside it, until a play starts and links the player", async () => {
		let panel = mount({ player: true, title: true });
		await vi.waitFor(() => expect(panel.devtools.title).toBeDefined());
		expect(panel.devtools.player).toBeUndefined();
		await panel.open("Screens");
		expect((panel.result.$("aside [data-screen=save]") as HTMLButtonElement).disabled).toBe(true);
		await userEvent.click(panel.result.$("aside [data-screen=gallery]") as HTMLElement);
		await vi.waitFor(() =>
			expect(galleryStates(panel.result, "[data-novel-title]")).toHaveLength(2),
		);
		(panel.result.$("[data-novel-title] dialog[open]") as HTMLDialogElement).close();
		await vi.waitFor(() => expect(panel.devtools.preview).toBeUndefined());
		await userEvent.click(panel.result.$("aside [data-screen=settings]") as HTMLElement);
		await vi.waitFor(() =>
			expect(panel.result.$("[data-novel-title] dialog[open][data-novel-settings]")).not.toBeNull(),
		);
		(panel.result.$("[data-novel-title] dialog[open]") as HTMLDialogElement).close();
		await panel.open("Player");
		expect((panel.result.$("aside [data-sample=entry]") as HTMLButtonElement).disabled).toBe(true);
		expect(panel.button("Back to the title screen").disabled).toBe(true);
		expect(panel.button("Toggle full screen").disabled).toBe(false);
		await userEvent.click(
			panel.result.$('[data-novel-title] [data-action="new-game"]') as HTMLElement,
		);
		await vi.waitFor(() => expect(panel.devtools.player).toBeDefined());
		expect(panel.devtools.title).toBeUndefined();
		expect((panel.result.$("aside [data-sample=entry]") as HTMLButtonElement).disabled).toBe(false);
	});

	test("play the player's hover and select sounds by role", async () => {
		let played = vi
			.spyOn(AudioMixer.prototype, "playInterface")
			.mockImplementation(() => undefined);
		let panel = mount({ player: true, sounds: true });
		await vi.waitFor(() => expect(panel.devtools.player).toBeDefined());
		expect(panel.devtools.player?.sounds?.select).toBe(ASSETS.sounds.chime);
		expect(panel.devtools.sounds).toEqual(["hover", "select"]);
		played.mockClear();
		expect(await panel.devtools.playSound("select")).toBe(true);
		expect(played.mock.calls).toEqual([[ASSETS.sounds.chime.src]]);
		await panel.open("Player");
		played.mockClear();
		await userEvent.click(panel.result.$("aside [data-sound=hover]") as HTMLElement);
		expect(played.mock.calls.at(-1)).toEqual([ASSETS.sounds.tick.src]);
	});

	test("list no sound for a player without interface sounds", async () => {
		let panel = mount({ player: true });
		await vi.waitFor(() => expect(panel.devtools.player).toBeDefined());
		expect(panel.devtools.sounds).toEqual([]);
		expect(await panel.devtools.playSound("hover")).toBe(false);
		await panel.open("Player");
		expect(panel.panel().textContent).toContain("No interface sounds");
	});
});

describe("unlocks", () => {
	test("restart the play with one id checked", async () => {
		let panel = mount();
		await playLines(unwrap(panel.novel.start()), 1);
		await panel.open("Unlocks");
		await userEvent.click(panel.button("Load the unlock lists"));
		let list = await vi.waitFor(() => {
			let found = panel.result.$("aside details[data-list=images]");
			expect(found?.querySelector("summary")?.textContent).toBe("Gallery images (0/2)");
			return found as HTMLDetailsElement;
		});
		await userEvent.click(list.querySelector("summary") as HTMLElement);
		await userEvent.click(
			list.querySelector("input[value='images.kiss']")?.closest("label") as HTMLElement,
		);
		expect(panel.starts).toHaveLength(1);
		expect(panel.starts[0]?.persistent).toMatchObject({ unlocked: { images: ["images.kiss"] } });
		expect(panel.starts[0]?.from).toMatchObject({ position: { line: "opening.welcome" } });
	});

	test("apply an edited record and report a malformed one", async () => {
		let panel = mount();
		await playLines(unwrap(panel.novel.start()), 1);
		await panel.open("Persistent");
		let editor = panel.result.$("aside textarea[name=persistent]") as HTMLTextAreaElement;
		await vi.waitFor(() => expect(editor.value).toContain("prologue.opening:opening.welcome"));
		await userEvent.fill(editor, '{ "introduced": "mika" }');
		await userEvent.click(panel.button("Apply and restart"));
		await vi.waitFor(() =>
			expect(panel.result.$("aside [role=alert]")?.textContent).toContain("`introduced`"),
		);
		expect(panel.starts).toEqual([]);
		await userEvent.fill(editor, '{ "introduced": ["ren"] }');
		await userEvent.click(panel.button("Apply and restart"));
		expect(panel.starts[0]?.persistent).toMatchObject({ introduced: ["ren"], seen: {} });
	});
});

describe("the cast", () => {
	test("explains why each character counts as met", async () => {
		let panel = mount();
		await playLines(unwrap(panel.novel.start()), 2);
		await panel.open("Cast");
		await userEvent.click(panel.button("Explain who is met"));
		await vi.waitFor(() => {
			let mika = panel.result.$("aside [data-character=mika]") as HTMLElement;
			expect(mika.dataset["met"]).toBe("true");
			expect(mika.textContent).toContain(
				"speaks 1 read line (first prologue.opening:opening.both)",
			);
		});
		let ren = panel.result.$("aside [data-character=ren]") as HTMLElement;
		expect(ren.dataset["met"]).toBe("false");
		expect(ren.textContent).toContain("never introduced, heard or drawn");
	});
});

describe("the floating panel", () => {
	test("opens as a popover from its corner button", async () => {
		let panel = mount({ floating: true });
		expect(panel.panel().matches(":popover-open")).toBe(false);
		await userEvent.click(panel.result.$("[data-novel-devtools-toggle]") as HTMLElement);
		expect(panel.panel().matches(":popover-open")).toBe(true);
	});
});
