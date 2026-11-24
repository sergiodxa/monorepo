/**
 * The title screen in a real browser: `NovelPlayer.Title` alone (its menu, Continue from the
 * newest save, the library screens, the settings, theme variables and custom art) and
 * `NovelPlayer.Default` opening on it and swapping to the play the reader starts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { css, on } from "remix/component";
import { render } from "remix/component/test";
import * as s from "remix/data-schema";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { GameState } from "../frames.js";
import type { StartOptions } from "../novel.js";
import type { Persistent } from "../persistent.js";

import { chapter, createNovel, createScene, scene, scenes } from "../index.js";
import { LocalStorageStore } from "../storage/local-storage.js";

import { ChapterSelect } from "./chapters.js";
import { NovelPlayer } from "./player.js";
import { Title } from "./title.js";

const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const MESSAGES = {
	chapters: { prologue: "Prologue" },
	titles: { opening: "Opening" },
	opening: { welcome: "Welcome.", thinking: "I should say something." },
	endings: { good: "Good ending" },
};

const SCENES = scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: { opening: scene({ title: "titles.opening" }) },
	}),
});

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.narrate("opening.thinking"),
	ctx.ending("endings.good"),
]);

/** A one-chapter novel. */
function fixture() {
	let novel = createNovel({ scenes: SCENES, state: STATE, initial: SCENES.prologue.opening });
	novel.map(SCENES.prologue.opening, OPENING);
	return novel;
}

/** A reader who reached the prologue. */
const STORED: Persistent = {
	seen: { "prologue.opening:opening.welcome": {} },
	chosen: [],
	endings: [],
	chapters: ["prologue"],
	unlocked: { images: [], music: [] },
};

/** A save-shaped value stamped `savedAt`, told apart by its `scene`. */
function save(scene: string, savedAt: string): GameState {
	return { meta: { scene, savedAt, playTime: 0 } } as unknown as GameState;
}

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	localStorage.clear();
	vi.restoreAllMocks();
});

/** Renders `node` in a 960×540 box inside an `IntlProvider`, catching `novel:start` and `novel:settings`. */
function mount(node: RemixNode) {
	let started = vi.fn<(start: StartOptions) => void>();
	let settings = vi.fn<(settings: unknown) => void>();
	let container = document.createElement("div");
	container.style.width = "960px";
	container.style.height = "540px";
	document.body.append(container);
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });
	mounted = render(
		<IntlProvider intl={intl}>
			<div
				mix={[
					css({ display: "contents" }),
					on("novel:start", (event) => started(event.start)),
					on("novel:settings", (event) => settings(event.settings)),
				]}
			>
				{node}
			</div>
		</IntlProvider>,
		{ container },
	);
	return { result: mounted, started, settings };
}

/** The title menu's button for `action`. */
function button(result: RenderResult, action: string): HTMLButtonElement | null {
	return result.$(`[data-novel-title] [data-action="${action}"]`) as HTMLButtonElement | null;
}

describe("NovelPlayer.Title", () => {
	test("shows the heading, New game, the library screens and Settings, and no Continue without saves", () => {
		let { result } = mount(<Title novel={fixture()} heading="The Café" />);
		expect(result.$("[data-novel-title] h1")!.textContent).toBe("The Café");
		expect(button(result, "new-game")!.textContent).toBe("New game");
		expect(button(result, "continue")).toBeNull();
		expect(
			[...result.$$("[data-novel-title] nav button")].map((entry) => entry.textContent),
		).toEqual(["New game", "Chapters", "Gallery", "Memories", "Settings"]);
	});

	test("starts a new game with the start it was given, leaving any save out", () => {
		let { result, started } = mount(
			<Title
				novel={fixture()}
				heading="The Café"
				start={{ persistent: STORED, from: save("x", "2026-01-01T00:00:00.000Z") }}
			/>,
		);
		button(result, "new-game")!.click();
		expect(started).toHaveBeenCalledWith({ persistent: STORED });
	});

	test("continues from the newest save across every slot", () => {
		let newest = save("newest", "2026-03-01T00:00:00.000Z");
		let { result, started } = mount(
			<Title
				novel={fixture()}
				heading="The Café"
				start={{ persistent: STORED }}
				saves={{
					auto: save("older", "2026-02-01T00:00:00.000Z"),
					"1": newest,
					quick: save("oldest", "2026-01-01T00:00:00.000Z"),
				}}
			/>,
		);
		button(result, "continue")!.click();
		expect(started).toHaveBeenCalledWith({ persistent: STORED, from: newest });
	});

	test("starts a chapter replay picked from its chapter screen", async () => {
		let { result, started } = mount(
			<Title novel={fixture()} heading="The Café" start={{ persistent: STORED }}>
				<ChapterSelect />
			</Title>,
		);
		button(result, "chapters")!.click();
		let dialog = result.$("[data-novel-title] dialog[open]")!;
		let pick = await vi.waitFor(() => {
			let entry = dialog.querySelector<HTMLButtonElement>('[data-name="prologue"] button');
			expect(entry?.disabled).toBe(false);
			return entry!;
		});
		pick.click();
		expect(started).toHaveBeenCalledWith({
			persistent: STORED,
			scene: SCENES.prologue.opening,
			replay: "chapter",
		});
	});

	test("changes the reader's settings from its settings screen", async () => {
		let { result, settings } = mount(
			<Title novel={fixture()} heading="The Café" settings={{ fontSize: 1.5 }} />,
		);
		button(result, "settings")!.click();
		let dialog = result.$("[data-novel-title] [data-novel-settings]") as HTMLDialogElement;
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		await userEvent.click(dialog.querySelector('input[name="dyslexiaFont"]')!);
		expect(settings).toHaveBeenLastCalledWith(
			expect.objectContaining({ dyslexiaFont: true, fontSize: 1.5 }),
		);
	});

	test("draws custom art and restyles itself through theme variables", () => {
		let { result } = mount(
			<div
				style={{
					display: "contents",
					"--novel-title-heading-color": "rgb(1, 2, 3)",
					"--novel-title-button-background": "rgb(4, 5, 6)",
				}}
			>
				<Title novel={fixture()} heading="The Café" art={<img data-key-art="" alt="" />} />
			</div>,
		);
		expect(result.$("[data-novel-title-art] [data-key-art]")).not.toBeNull();
		expect(getComputedStyle(result.$("[data-novel-title] h1")!).color).toBe("rgb(1, 2, 3)");
		expect(getComputedStyle(button(result, "new-game")!).backgroundColor).toBe("rgb(4, 5, 6)");
		expect(getComputedStyle(result.$("[data-novel-title]")!).backgroundImage).toContain("gradient");
	});
});

describe("NovelPlayer.Default with a title screen", () => {
	test("opens on the title and plays once the reader starts a new game", async () => {
		let { result } = mount(
			<NovelPlayer.Default
				novel={fixture()}
				settings={{ textSpeed: 0 }}
				titleScreen={{ heading: "The Café", art: <img data-key-art="" alt="" /> }}
			/>,
		);
		expect(result.$("[data-novel-player]")).toBeNull();
		expect(result.$("[data-novel-title-art] [data-key-art]")).not.toBeNull();
		button(result, "new-game")!.click();
		await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe("Welcome."));
		expect(result.$("[data-novel-title]")).toBeNull();
	});

	test("keeps a setting changed on the title through the store and applies it to the play", async () => {
		let store = new LocalStorageStore({ prefix: "title" });
		store.putSettings({ textSpeed: 0 });
		let { result } = mount(
			<NovelPlayer.Default
				novel={fixture()}
				{...store.read()}
				mix={store.sync()}
				titleScreen={{ heading: "The Café" }}
			/>,
		);
		button(result, "settings")!.click();
		let dialog = result.$("[data-novel-title] [data-novel-settings]") as HTMLDialogElement;
		await vi.waitFor(() => expect(dialog.open).toBe(true));
		await userEvent.click(dialog.querySelector('input[name="dyslexiaFont"]')!);
		expect(store.read().settings).toEqual(
			expect.objectContaining({ dyslexiaFont: true, textSpeed: 0 }),
		);
		dialog.close();
		button(result, "new-game")!.click();
		await vi.waitFor(() =>
			expect(result.$("[data-novel-player]")?.dataset["dyslexia"]).toBe("true"),
		);
	});
});
