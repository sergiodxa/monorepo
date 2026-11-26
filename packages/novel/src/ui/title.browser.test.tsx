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
import { page, userEvent } from "vitest/browser";

import type { GameState } from "../frames.js";
import type { StartOptions } from "../novel.js";
import type { Persistent } from "../persistent.js";

import { assets, chapter, createNovel, createScene, scene, scenes } from "../index.js";
import { LocalStorageStore } from "../storage/local-storage.js";

import { AudioMixer } from "./audio.js";
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
	unlocked: { images: [], music: [], sprites: [], entries: [], bios: [] },
	introduced: [],
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
		).toEqual(["New game", "Chapters", "Encyclopedia", "Memories", "Settings"]);
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
		await userEvent.click(dialog.querySelector('[data-novel-settings-tab="accessibility"]')!);
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

describe("NovelPlayer.Title's full screen button", () => {
	test("fills the screen with the box the title sits in, and leaves full screen once in it", async () => {
		let { result } = mount(<Title novel={fixture()} heading="The Café" />);
		let toggle = result.$("[data-novel-title-fullscreen]") as HTMLButtonElement;
		await vi.waitFor(() => expect(toggle.hidden).toBe(false));
		expect(toggle.getAttribute("aria-label")).toBe("Full screen");
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		let entered = vi
			.spyOn(HTMLElement.prototype, "requestFullscreen")
			.mockImplementation(async function (this: HTMLElement) {
				expect(this).toBe(result.$("[data-novel-title]")!.parentElement);
			});
		await userEvent.click(toggle);
		expect(entered).toHaveBeenCalledTimes(1);
		let left = vi.spyOn(document, "exitFullscreen").mockResolvedValue(undefined);
		vi.spyOn(document, "fullscreenElement", "get").mockReturnValue(document.body);
		document.dispatchEvent(new Event("fullscreenchange"));
		await vi.waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("true"));
		await userEvent.click(toggle);
		expect(left).toHaveBeenCalledTimes(1);
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

	test("fills the screen with the box it shares with the title, so leaving the play stays in full screen", async () => {
		let { result } = mount(
			<NovelPlayer.Default
				novel={fixture()}
				settings={{ textSpeed: 0 }}
				titleScreen={{ heading: "The Café" }}
			/>,
		);
		let container = result.$("[data-novel-title]")!.parentElement;
		button(result, "new-game")!.click();
		await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe("Welcome."));
		let target: Element | undefined;
		vi.spyOn(HTMLElement.prototype, "requestFullscreen").mockImplementation(async function (
			this: HTMLElement,
		) {
			target = this;
		});
		await userEvent.click(result.$('[data-novel-menu] [data-action="fullscreen"]')!);
		expect(target).toBe(container);
		expect(result.$("[data-novel-player]")!.parentElement).toBe(container);
	});

	test("leaves a play for the title from the quick menu", async () => {
		let { result } = mount(
			<NovelPlayer.Default
				novel={fixture()}
				settings={{ textSpeed: 0 }}
				titleScreen={{ heading: "The Café" }}
			/>,
		);
		button(result, "new-game")!.click();
		await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe("Welcome."));
		await userEvent.click(result.$('[data-novel-menu] [data-action="toTitle"]')!);
		await vi.waitFor(() => expect(result.$("[data-novel-title]")).not.toBeNull());
		expect(result.$("[data-novel-player]")).toBeNull();
	});

	test("offers no way to the title in a player without a title screen", async () => {
		let { result } = mount(<NovelPlayer.Default novel={fixture()} settings={{ textSpeed: 0 }} />);
		await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe("Welcome."));
		expect(result.$('[data-novel-menu] [data-action="toTitle"]')).toBeNull();
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
		await userEvent.click(dialog.querySelector('[data-novel-settings-tab="accessibility"]')!);
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

/** Waits until the player shows `text` and waits for the reader, then advances with a click. */
async function advanceFrom(result: RenderResult, text: string): Promise<void> {
	await vi.waitFor(() => {
		expect(result.$("[data-novel-line]")?.textContent).toBe(text);
		expect((result.$("[data-novel-player]") as HTMLElement | null)?.dataset["phase"]).toBe(
			"waiting",
		);
	});
	(result.$("[data-novel-surface]") as HTMLElement).click();
}

/** Opens the title's chapter screen and picks the prologue once it is unlocked. */
async function pickPrologue(result: RenderResult): Promise<void> {
	button(result, "chapters")!.click();
	let dialog = result.$("[data-novel-title] dialog[open]")!;
	let pick = await vi.waitFor(() => {
		let entry = dialog.querySelector<HTMLButtonElement>('[data-name="prologue"] button');
		expect(entry?.disabled).toBe(false);
		return entry!;
	});
	pick.click();
}

describe("NovelPlayer.Default returning to its title screen", () => {
	test("shows the ending with a way back to the title, whose Continue and library reflect the play", async () => {
		let { result } = mount(
			<NovelPlayer.Default
				novel={fixture()}
				settings={{ textSpeed: 0 }}
				start={{ persistent: {} }}
				titleScreen={{ heading: "The Café" }}
			/>,
		);
		expect(button(result, "continue")).toBeNull();
		button(result, "new-game")!.click();
		await advanceFrom(result, "Welcome.");
		await advanceFrom(result, "I should say something.");
		await vi.waitFor(() =>
			expect(result.$("[data-novel-ending]")?.textContent).toBe("Good ending"),
		);
		expect(result.$("[data-novel-play-again]")).toBeNull();
		let back = result.$("[data-novel-back-to-title]") as HTMLButtonElement;
		expect(back.textContent).toBe("Back to title");

		back.click();
		await vi.waitFor(() => expect(result.$("[data-novel-title]")).not.toBeNull());
		expect(result.$("[data-novel-player]")).toBeNull();
		expect(button(result, "continue")).not.toBeNull();
		await pickPrologue(result);
		await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe("Welcome."));
	});

	test("goes back to the title when the reader ends a replay begun there", async () => {
		let { result } = mount(
			<NovelPlayer.Default
				novel={fixture()}
				settings={{ textSpeed: 0 }}
				start={{ persistent: STORED }}
				titleScreen={{ heading: "The Café" }}
			/>,
		);
		await pickPrologue(result);
		await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe("Welcome."));
		(result.$('[data-novel-player] [data-action="endReplay"]') as HTMLButtonElement).click();
		await vi.waitFor(() => expect(result.$("[data-novel-title]")).not.toBeNull());
		expect(result.$("[data-novel-player]")).toBeNull();
	});

	test("goes back to the title when a replay begun there plays to its end", async () => {
		let { result } = mount(
			<NovelPlayer.Default
				novel={fixture()}
				settings={{ textSpeed: 0 }}
				start={{ persistent: STORED }}
				titleScreen={{ heading: "The Café" }}
			/>,
		);
		await pickPrologue(result);
		await advanceFrom(result, "Welcome.");
		await advanceFrom(result, "I should say something.");
		await vi.waitFor(() => expect(result.$("[data-novel-title]")).not.toBeNull());
		expect(result.$("[data-novel-player]")).toBeNull();
	});
});

/** An SVG image of `width`×`height` as a data URL, so it decodes without a server. */
function svg(width: number, height: number): string {
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="teal"/></svg>`,
	)}`;
}

/** Waits until every image under `root` has decoded, so its box has its natural ratio. */
async function decoded(root: Element): Promise<void> {
	await vi.waitFor(() => {
		for (let image of root.querySelectorAll("img")) expect(image.naturalWidth).toBeGreaterThan(0);
	});
}

describe("NovelPlayer.Title's look", () => {
	test("shows under Continue the newest save's scene and when it was saved, in the locale", () => {
		let savedAt = "2026-03-01T15:30:00.000Z";
		let { result } = mount(
			<div style={{ display: "contents", "--novel-title-detail-color": "rgb(7, 8, 9)" }}>
				<Title
					novel={fixture()}
					heading="The Café"
					saves={{ "1": save("titles.opening", savedAt) }}
				/>
			</div>,
		);
		let detail = result.$('[data-action="continue"] [data-novel-title-detail]')!;
		expect(result.$('[data-action="continue"] [data-novel-title-label]')!.textContent).toBe(
			"Continue",
		);
		expect(detail.querySelector("[data-novel-save-scene]")!.textContent).toBe("Opening");
		expect(detail.querySelector("time")!.textContent).toBe(
			new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
				new Date(savedAt),
			),
		);
		expect(getComputedStyle(detail).color).toBe("rgb(7, 8, 9)");
	});

	test("draws a footer under the menu, in the same column, styled by its variables", () => {
		let { result } = mount(
			<div style={{ display: "contents", "--novel-title-footer-color": "rgb(9, 9, 9)" }}>
				<Title novel={fixture()} heading="The Café" footer="A fan work." />
			</div>,
		);
		let footer = result.$("[data-novel-title-content] > [data-novel-title-footer]")!;
		expect(footer.textContent).toBe("A fan work.");
		expect(footer.previousElementSibling!.matches("[data-novel-title-menu]")).toBe(true);
		expect(getComputedStyle(footer).color).toBe("rgb(9, 9, 9)");
	});

	test("lets the author ornament every button through its own mix and variables", () => {
		let { result } = mount(
			<div
				style={{
					display: "contents",
					"--novel-title-button-letter-spacing": "3px",
					"--novel-title-button-text-transform": "uppercase",
					"--novel-title-button-shadow": "rgb(1, 1, 1) 0px 0px 0px 2px inset",
				}}
			>
				<Title
					novel={fixture()}
					heading="The Café"
					mix={css({
						"& [data-novel-title-button]::before": {
							content: '"◆"',
							position: "absolute",
							insetInlineStart: "-0.5em",
						},
					})}
				/>
			</div>,
		);
		let newGame = button(result, "new-game")!;
		expect(newGame.matches("[data-novel-title-button]")).toBe(true);
		expect(getComputedStyle(newGame, "::before").content).toBe('"◆"');
		expect(getComputedStyle(newGame).position).toBe("relative");
		expect(getComputedStyle(newGame).letterSpacing).toBe("3px");
		expect(getComputedStyle(newGame).textTransform).toBe("uppercase");
		expect(getComputedStyle(newGame).boxShadow).toBe("rgb(1, 1, 1) 0px 0px 0px 2px inset");
		expect(result.$("[data-novel-title-heading]")).not.toBeNull();
		expect(result.$("[data-novel-title-menu]")).not.toBeNull();
	});

	test("caps an image logo by its variables and names the heading by its alt text", async () => {
		let { result } = mount(
			<div
				style={{
					display: "contents",
					"--novel-title-logo-max-inline-size": "300px",
					"--novel-title-logo-max-block-size": "100px",
				}}
			>
				<Title novel={fixture()} heading={<img src={svg(2000, 1000)} alt="The Café" />} />
			</div>,
		);
		let logo = result.$("[data-novel-title-heading] img")!;
		await decoded(logo.parentElement!);
		let box = logo.getBoundingClientRect();
		expect(box.width).toBeLessThanOrEqual(300);
		expect(box.height).toBeLessThanOrEqual(100);
		expect(box.width / box.height).toBeCloseTo(2, 1);
		await expect.element(page.getByRole("heading", { name: "The Café" })).toBeInTheDocument();
		expect(page.getByRole("region", { name: "The Café" }).query()).not.toBeNull();
	});

	test("covers the screen with the background, through its filter", async () => {
		let { result } = mount(
			<div style={{ display: "contents", "--novel-title-background-filter": "blur(6px)" }}>
				<Title
					novel={fixture()}
					heading="The Café"
					background={<img src={svg(400, 400)} alt="" />}
				/>
			</div>,
		);
		let layer = result.$("[data-novel-title-background]")!;
		await decoded(layer);
		let image = layer.querySelector("img")!;
		let root = result.$("[data-novel-title]")!.getBoundingClientRect();
		let box = image.getBoundingClientRect();
		expect(getComputedStyle(layer).filter).toBe("blur(6px)");
		expect(getComputedStyle(image).objectFit).toBe("cover");
		expect([box.width, box.height]).toEqual([root.width, root.height]);
	});

	test("anchors the art at the bottom right, keeping its ratio, hidden unless it has alt text", async () => {
		let { result } = mount(
			<Title novel={fixture()} heading="The Café" art={<img src={svg(320, 640)} alt="" />} />,
		);
		let layer = result.$("[data-novel-title-art]")!;
		await decoded(layer);
		let root = result.$("[data-novel-title]")!.getBoundingClientRect();
		let box = layer.querySelector("img")!.getBoundingClientRect();
		expect(box.height).toBeCloseTo(root.height * 0.95, 0);
		expect(box.width).toBeCloseTo(box.height / 2, 0);
		expect(box.bottom).toBeCloseTo(root.bottom, 0);
		expect(box.right).toBeCloseTo(root.right - root.width * 0.04, 0);
		expect(layer.getAttribute("aria-hidden")).toBe("true");
		mounted?.cleanup();

		let named = mount(
			<Title novel={fixture()} heading="The Café" art={<img src={svg(320, 640)} alt="Mika" />} />,
		);
		expect(named.result.$("[data-novel-title-art]")!.hasAttribute("aria-hidden")).toBe(false);
	});

	test("passes the background, art and footer through NovelPlayer.Default", () => {
		let { result } = mount(
			<NovelPlayer.Default
				novel={fixture()}
				titleScreen={{
					heading: "The Café",
					background: <img data-backdrop="" alt="" />,
					art: <img data-portrait="" alt="" />,
					footer: "Credits",
				}}
			/>,
		);
		expect(result.$("[data-novel-title-background] [data-backdrop]")).not.toBeNull();
		expect(result.$("[data-novel-title-art] [data-portrait]")).not.toBeNull();
		expect(result.$("[data-novel-title-footer]")!.textContent).toBe("Credits");
	});
});

describe("Interface sounds", () => {
	/** Two sounds declared by URL, so a test reads which one played. */
	const SOUNDS = assets({ sounds: { tick: "/tick.wav", chime: "/chime.wav" } });

	/** Records every interface sound the title or the player plays, without playing it. */
	function listen() {
		return vi.spyOn(AudioMixer.prototype, "playInterface").mockImplementation(() => undefined);
	}

	test("ticks as the pointer reaches each title option and chimes as the reader picks one", async () => {
		let played = listen();
		let { result } = mount(
			<Title
				novel={fixture()}
				heading="The Café"
				sounds={{ hover: SOUNDS.sounds.tick, select: SOUNDS.sounds.chime }}
			/>,
		);
		await userEvent.hover(result.$("[data-novel-title] h1")!);
		played.mockClear();
		await userEvent.hover(button(result, "new-game")!);
		await userEvent.hover(button(result, "new-game")!);
		await userEvent.hover(button(result, "settings")!);
		expect(played.mock.calls).toEqual([["/tick.wav"], ["/tick.wav"]]);
		await userEvent.click(button(result, "settings")!);
		expect(played.mock.calls).toEqual([["/tick.wav"], ["/tick.wav"], ["/chime.wav"]]);
	});

	test("ticks as keyboard focus moves between options", async () => {
		let played = listen();
		let { result } = mount(
			<Title novel={fixture()} heading="The Café" sounds={{ hover: SOUNDS.sounds.tick }} />,
		);
		button(result, "new-game")!.focus();
		await userEvent.keyboard("{Tab}");
		expect(played).toHaveBeenCalledWith("/tick.wav");
	});

	test("ticks and chimes for the quick menu, Title included, and stays quiet as a click advances the line", async () => {
		let played = listen();
		let { result } = mount(
			<NovelPlayer.Default
				novel={fixture()}
				settings={{ textSpeed: 0 }}
				titleScreen={{ heading: "The Café" }}
				sounds={{ hover: SOUNDS.sounds.tick, select: SOUNDS.sounds.chime }}
			/>,
		);
		await userEvent.click(button(result, "new-game")!);
		await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe("Welcome."));
		expect(played).toHaveBeenLastCalledWith("/chime.wav");
		played.mockClear();
		(result.$("[data-novel-surface]") as HTMLElement).click();
		await vi.waitFor(() =>
			expect(result.$("[data-novel-line]")?.textContent).toBe("I should say something."),
		);
		expect(played).not.toHaveBeenCalledWith("/chime.wav");
		await userEvent.hover(result.$('[data-novel-menu] [data-action="auto"]')!);
		expect(played).toHaveBeenLastCalledWith("/tick.wav");
		await userEvent.click(result.$('[data-novel-menu] [data-action="auto"]')!);
		expect(played).toHaveBeenLastCalledWith("/chime.wav");
		await userEvent.click(result.$('[data-novel-menu] [data-action="toTitle"]')!);
		await vi.waitFor(() => expect(result.$("[data-novel-title]")).not.toBeNull());
		expect(played).toHaveBeenLastCalledWith("/chime.wav");
		expect(played.mock.calls.filter(([file]) => file === "/chime.wav")).toHaveLength(2);
	});

	test("lets the reader turn the interface sounds down on their own", async () => {
		let { result } = mount(<Title novel={fixture()} heading="The Café" />);
		await userEvent.click(button(result, "settings")!);
		await userEvent.click(result.$('[data-novel-settings-tab="sound"]')!);
		let slider = result.$('input[name="volume.interface"]') as HTMLInputElement;
		expect(slider.value).toBe("60");
		expect(slider.getAttribute("aria-label")).toBe("Interface");
	});
});
