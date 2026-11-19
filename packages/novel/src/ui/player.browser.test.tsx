/**
 * Plays a small novel through `NovelPlayer` in a real browser: frames sequenced from stage to
 * text to reply, clicks and keys, menus, pauses, interactions and endings, auto mode, skip,
 * rollback, the backlog, saves, settings, hiding the interface, full screen and transitions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { Handle } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { css, on } from "remix/component";
import { render } from "remix/component/test";
import * as s from "remix/data-schema";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cdp, userEvent } from "vitest/browser";

import type { GameState } from "../frames.js";

import {
	assets,
	cast,
	character,
	createNovel,
	createScene,
	interaction,
	interactions,
	scene,
	scenes,
} from "../index.js";

import { NovelPlayer } from "./player.js";
import { UNREVEALED_HIGHLIGHT } from "./typewriter.js";

/** An SVG image as a data URL, so images decode without a server. */
function svg(color: string, width = 320, height = 640): string {
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`,
	)}`;
}

/** A silent mono WAV of `ms` milliseconds as a blob URL. */
function wav(ms: number): string {
	let samples = Math.round(8 * ms);
	let view = new DataView(new ArrayBuffer(44 + samples * 2));
	let text = (offset: number, value: string) => {
		for (let index = 0; index < value.length; index++) {
			view.setUint8(offset + index, value.charCodeAt(index));
		}
	};
	text(0, "RIFF");
	view.setUint32(4, 36 + samples * 2, true);
	text(8, "WAVEfmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, 8000, true);
	view.setUint32(28, 16_000, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	text(36, "data");
	view.setUint32(40, samples * 2, true);
	return URL.createObjectURL(new Blob([view.buffer], { type: "audio/wav" }));
}

/** The fixture's story state, the same shape the package's fixture declares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

/** The catalog the player translates through, with markup on the first line. */
const MESSAGES = {
	cast: { mika: "Mika", ren: "Ren", player: "You" },
	titles: { opening: "Opening", cafe: "The café" },
	opening: {
		welcome: "Welcome to the {#b}café{/b}.",
		hello: "Hello, {$name}!",
		both: "Together!",
		thinking: "I should say something.",
		ask: "Where now?",
	},
	cafe: { impressed: "Wow, {$caught} fish!", stay: "Stay", leave: "Leave" },
	endings: { good: "Good ending", bad: "Bad ending" },
	unwritten: { jump: "A door creaks." },
};

const SCENES = scenes({
	prologue: { opening: scene({ title: "titles.opening" }), cafe: scene({ title: "titles.cafe" }) },
});

const CAST = cast({
	mika: character({
		name: "cast.mika",
		color: "#e86a92",
		sprites: { smile: svg("pink"), neutral: svg("hotpink") },
	}),
	ren: character({
		name: "cast.ren",
		layers: {
			body: { school: svg("navy"), casual: svg("teal") },
			face: { neutral: svg("tan"), grin: svg("wheat") },
		},
	}),
});

const ASSETS = assets({
	backgrounds: { cafe: svg("green", 1600, 900), street: svg("gray", 1600, 900) },
	music: { chill: wav(2000) },
	sounds: { door: { src: wav(100), caption: "unwritten.jump" } },
});

const INTERACTIONS = interactions({
	fishing: interaction({
		input: s.object({ difficulty: s.number() }),
		output: s.object({ caught: s.number() }),
	}),
});

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.show(ASSETS.backgrounds.cafe, { transition: "fade" }),
	ctx.play(ASSETS.music.chill),
	ctx.enter(CAST.mika, { at: "left", expression: "smile" }),
	ctx.enter(CAST.ren, { at: "3/3", layers: { body: "school", face: "grin" } }),
	ctx.narrate("opening.welcome"),
	ctx.say(CAST.mika, "opening.hello", { name: "Ada" }),
	ctx.say([CAST.mika, CAST.ren], "opening.both"),
	ctx.wait(150),
	ctx.play(ASSETS.sounds.door),
	ctx.say(CAST.ren, "opening.thinking"),
	ctx.choose(
		{ "cafe.stay": [ctx.goto(SCENES.prologue.cafe)], "cafe.leave": [ctx.ending("endings.bad")] },
		{ prompt: "opening.ask" },
	),
]);

const CAFE = createScene(SCENES.prologue.cafe, (ctx) => [
	ctx.show(ASSETS.backgrounds.street, { transition: "dissolve" }),
	ctx.custom(INTERACTIONS.fishing, { input: { difficulty: 2 }, into: "lastCatch" }),
	ctx.say(CAST.mika, "cafe.impressed", (state) => ({ caught: state.lastCatch?.caught ?? 0 })),
	ctx.ending("endings.good"),
]);

/** Mika's voice, long enough to observe and short enough to wait for. */
const VOICE = wav(300);

/** A novel over the fixture. */
function fixture() {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		interactions: INTERACTIONS,
		state: STATE,
		initial: SCENES.prologue.opening,
		voice: ({ speaker }) => (speaker === "mika" ? VOICE : undefined),
	});
	novel.map(SCENES.prologue.opening, OPENING);
	novel.map(SCENES.prologue.cafe, CAFE);
	return novel;
}

/** Catches a fish of the size its input asks for. */
function Fishing(handle: Handle<NovelPlayer.InteractionProps>) {
	return () => (
		<button
			type="button"
			data-fish=""
			mix={[
				css({ position: "absolute", inset: "40%" }),
				on("click", () => {
					let { frame } = handle.props;
					handle.props.respond(frame.complete({ caught: frame.input.difficulty * 2 }));
				}),
			]}
		>
			Fish
		</button>
	);
}

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	if (document.fullscreenElement !== null) await document.exitFullscreen();
	vi.restoreAllMocks();
});

/** Mounts a player in a 960×540 box with instant text unless the props say otherwise. */
function mount(props: Partial<NovelPlayer.Props> = {}) {
	let container = document.createElement("div");
	container.style.width = "960px";
	container.style.height = "540px";
	document.body.append(container);
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });
	mounted = render(
		<IntlProvider intl={intl}>
			<NovelPlayer
				novel={fixture()}
				start={{ seed: "player" }}
				settings={{ textSpeed: 0 }}
				renderInteraction={Fishing}
				{...props}
			/>
		</IntlProvider>,
		{ container },
	);
	let result = mounted;
	return {
		result,
		root: () => result.$("[data-novel-player]")!,
		surface: () => result.$("[data-novel-surface]")!,
		line: () => result.$("[data-novel-line]")?.textContent ?? null,
		phase: () => result.$("[data-novel-player]")!.dataset["phase"],
	};
}

/** Waits until the player shows `text` and waits for the reader. */
async function shows(player: ReturnType<typeof mount>, text: string): Promise<void> {
	await vi.waitFor(
		() => {
			expect(player.line()).toBe(text);
			expect(player.phase()).toBe("waiting");
		},
		{ timeout: 5000 },
	);
}

/** Clicks the stage where nothing but the scenery is. */
function clickStage(player: ReturnType<typeof mount>): void {
	player.surface().click();
}

/** Advances from the first line to the menu with clicks. */
async function toMenu(player: ReturnType<typeof mount>): Promise<void> {
	await shows(player, "Welcome to the café.");
	clickStage(player);
	await shows(player, "Hello, Ada!");
	clickStage(player);
	await shows(player, "Together!");
	clickStage(player);
	await shows(player, "I should say something.");
	clickStage(player);
	await vi.waitFor(() => expect(player.result.$("[data-novel-choices]")).not.toBeNull());
}

describe("NovelPlayer", () => {
	test("applies the stage, then shows the line through Trans and waits for a click", async () => {
		let player = mount();
		await shows(player, "Welcome to the café.");
		expect(player.result.$("[data-novel-line] b")!.textContent).toBe("café");
		expect(player.result.$('[data-novel-layer="background"] img')!.getAttribute("src")).toBe(
			ASSETS.backgrounds.cafe.src,
		);
		expect(player.result.$$("[data-novel-character]")).toHaveLength(2);
		clickStage(player);
		await shows(player, "Hello, Ada!");
		expect(player.result.$("[data-novel-speaker]")!.textContent).toBe("Mika");
		expect(player.result.$('[data-id="mika"]')!.dataset["speaking"]).toBe("true");
		expect(player.result.$('[data-id="ren"]')!.dataset["speaking"]).toBe("false");
	});

	test("finishes the typewriter on the first click and advances on the second", async () => {
		let player = mount({ settings: { textSpeed: 1 } });
		await vi.waitFor(() => expect(player.phase()).toBe("typing"), { timeout: 5000 });
		expect(CSS.highlights.get(UNREVEALED_HIGHLIGHT)?.size).toBeGreaterThan(0);
		clickStage(player);
		await vi.waitFor(() => expect(player.phase()).toBe("waiting"));
		expect(player.line()).toBe("Welcome to the café.");
		clickStage(player);
		await vi.waitFor(() => expect(player.line()).toBe("Hello, Ada!"));
	});

	test("advances with Space and Enter", async () => {
		let player = mount();
		await shows(player, "Welcome to the café.");
		await userEvent.keyboard(" ");
		await shows(player, "Hello, Ada!");
		await userEvent.keyboard("{Enter}");
		await shows(player, "Together!");
	});

	test("waits out a pause, shows a sound's caption, and takes an option from the menu", async () => {
		let player = mount();
		await toMenu(player);
		expect(player.result.$("[data-novel-captions] li")).toBeNull();
		expect([...player.result.$$("[data-novel-choices] button")].map((b) => b.textContent)).toEqual([
			"Stay",
			"Leave",
		]);
		player.result.$('[data-option="cafe.stay"]')!.click();
		await vi.waitFor(() => expect(player.result.$("[data-fish]")).not.toBeNull(), {
			timeout: 5000,
		});
	});

	test("shows the caption on the line its sound plays with", async () => {
		let player = mount();
		await shows(player, "Welcome to the café.");
		clickStage(player);
		await shows(player, "Hello, Ada!");
		clickStage(player);
		await shows(player, "Together!");
		clickStage(player);
		await shows(player, "I should say something.");
		expect(player.result.$("[data-novel-captions] li")!.textContent).toBe("A door creaks.");
	});

	test("renders a custom frame through renderInteraction and reaches the ending", async () => {
		let ended = vi.fn();
		let player = mount({ onEnding: ended });
		await toMenu(player);
		player.result.$('[data-option="cafe.stay"]')!.click();
		await vi.waitFor(() => expect(player.result.$("[data-fish]")).not.toBeNull(), {
			timeout: 5000,
		});
		(player.result.$("[data-fish]") as HTMLButtonElement)!.click();
		await shows(player, "Wow, 4 fish!");
		clickStage(player);
		await vi.waitFor(() =>
			expect(ended).toHaveBeenCalledWith({ key: "endings.good", scene: "prologue.cafe" }),
		);
		expect(player.result.$("[data-novel-ending]")!.textContent).toBe("Good ending");
	});

	test("auto mode advances each line after its voice and delay", async () => {
		let player = mount({ settings: { textSpeed: 0, autoDelay: 50 } });
		await shows(player, "Welcome to the café.");
		(player.result.$('[data-action="auto"]') as HTMLButtonElement)!.click();
		await vi.waitFor(() => expect(player.root().dataset["auto"]).toBe("true"));
		expect(player.result.$('[data-action="auto"]')!.getAttribute("aria-pressed")).toBe("true");
		await vi.waitFor(() => expect(player.line()).toBe("Hello, Ada!"), { timeout: 5000 });
		await vi.waitFor(() => expect(player.line()).toBe("Together!"), { timeout: 5000 });
	});

	test("skip in read-only mode stops at a line not read yet", async () => {
		let player = mount();
		await shows(player, "Welcome to the café.");
		await userEvent.keyboard("k");
		await vi.waitFor(() => expect(player.root().dataset["skip"]).toBe("false"));
		expect(player.line()).toBe("Welcome to the café.");
	});

	test("skip over all text runs to the menu and stops there", async () => {
		let player = mount({ settings: { textSpeed: 40, skip: "all" } });
		await vi.waitFor(() => expect(player.line()).toBe("Welcome to the café."), { timeout: 5000 });
		(player.result.$('[data-action="skip"]') as HTMLButtonElement)!.click();
		await vi.waitFor(() => expect(player.result.$("[data-novel-choices]")).not.toBeNull(), {
			timeout: 5000,
		});
		expect(player.root().dataset["skip"]).toBe("false");
	});

	test("holding Control skips only while it is held", async () => {
		let player = mount({ settings: { textSpeed: 0, skip: "all" } });
		await shows(player, "Welcome to the café.");
		await userEvent.keyboard("{Control>}");
		await vi.waitFor(() => expect(player.result.$("[data-novel-choices]")).not.toBeNull(), {
			timeout: 5000,
		});
		expect(player.root().dataset["skip"]).toBe("true");
		await userEvent.keyboard("{/Control}");
		await vi.waitFor(() => expect(player.root().dataset["skip"]).toBe("false"));
	});

	test("rolls back with the arrow key and the wheel, trimming the backlog", async () => {
		let player = mount();
		await shows(player, "Welcome to the café.");
		clickStage(player);
		await shows(player, "Hello, Ada!");
		clickStage(player);
		await shows(player, "Together!");
		await userEvent.keyboard("{ArrowUp}");
		await shows(player, "Hello, Ada!");
		player.root().dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
		await shows(player, "Welcome to the café.");
		let backlog = (player.result.$("[data-novel-backlog]") as HTMLDialogElement)!;
		expect([...backlog.querySelectorAll("li")].map((item) => item.dataset["key"])).toEqual([
			"opening.welcome",
		]);
	});

	test("opens the backlog with its key, listing lines with their speakers and voice replay", async () => {
		let player = mount();
		await shows(player, "Welcome to the café.");
		clickStage(player);
		await shows(player, "Hello, Ada!");
		await userEvent.keyboard("l");
		let backlog = (player.result.$("[data-novel-backlog]") as HTMLDialogElement)!;
		await vi.waitFor(() => expect(backlog.open).toBe(true));
		let items = [...backlog.querySelectorAll("li")];
		expect(items.map((item) => item.textContent)).toEqual([
			"Welcome to the café.",
			"MikaHello, Ada!",
		]);
		expect(items[1]!.querySelector('button[aria-label="Replay voice"]')).not.toBeNull();
		expect(items[0]!.querySelector("button")).toBeNull();
		await userEvent.keyboard(" ");
		expect(player.line()).toBe("Hello, Ada!");
	});

	test("quick saves through onSave and quick loads the saved line", async () => {
		let saved: Record<string, GameState> = {};
		let player = mount({ onSave: (slot, state) => (saved[slot] = state) });
		await shows(player, "Welcome to the café.");
		clickStage(player);
		await shows(player, "Hello, Ada!");
		await userEvent.keyboard("q");
		expect(saved["quick"]?.position).toEqual({ scene: "prologue.opening", line: "opening.hello" });
		clickStage(player);
		await shows(player, "Together!");
		await userEvent.keyboard("w");
		await shows(player, "Hello, Ada!");
	});

	test("saves into a slot from the save screen and draws its thumbnail on the load screen", async () => {
		let onSave = vi.fn();
		let player = mount({ onSave, slots: 2 });
		await shows(player, "Welcome to the café.");
		await userEvent.keyboard("s");
		let screen = (player.result.$('[data-novel-saves="save"]') as HTMLDialogElement)!;
		await vi.waitFor(() => expect(screen.open).toBe(true));
		expect(
			[...screen.querySelectorAll("[data-slot-name]")].map((slot) => slot.textContent),
		).toEqual(["Quick saveEmpty", "Slot 1Empty", "Slot 2Empty"]);
		screen.querySelector<HTMLButtonElement>('[data-slot-name="2"]')!.click();
		expect(onSave).toHaveBeenCalledWith(
			"2",
			expect.objectContaining({ position: expect.anything() }),
		);
		await vi.waitFor(() => expect(screen.open).toBe(false));
		let load = (player.result.$('[data-novel-saves="load"]') as HTMLDialogElement)!;
		let slot = load.querySelector<HTMLButtonElement>('[data-slot-name="2"]')!;
		expect(slot.disabled).toBe(false);
		expect(load.querySelector<HTMLButtonElement>('[data-slot-name="1"]')!.disabled).toBe(true);
		expect(slot.textContent).toContain("Opening");
		expect(slot.querySelectorAll("[data-novel-character]")).toHaveLength(2);
	});

	test("resumes the saves the app passes in", async () => {
		let first = mount({ onSave: () => undefined });
		await shows(first, "Welcome to the café.");
		clickStage(first);
		await shows(first, "Hello, Ada!");
		await userEvent.keyboard("q");
		let state = first.result.$(
			'[data-novel-saves="load"] [data-slot-name="quick"]',
		) as HTMLButtonElement;
		expect(state!.disabled).toBe(false);
		mounted?.cleanup();
		let saves: Record<string, GameState> = {};
		let second = mount({ onSave: (slot, game) => (saves[slot] = game) });
		await shows(second, "Welcome to the café.");
		clickStage(second);
		await shows(second, "Hello, Ada!");
		await userEvent.keyboard("q");
		mounted?.cleanup();
		let third = mount({ saves });
		await shows(third, "Welcome to the café.");
		await userEvent.keyboard("w");
		await shows(third, "Hello, Ada!");
	});

	test("reports changed settings and applies text size and the dyslexia-friendly font", async () => {
		let changed = vi.fn();
		let player = mount({ onSettingsChange: changed, settings: { textSpeed: 0, fontSize: 1.5 } });
		await shows(player, "Welcome to the café.");
		let line = player.result.$("[data-novel-line]")!;
		let surfaceHeight = player.surface().getBoundingClientRect().height;
		expect(Number.parseFloat(getComputedStyle(line).fontSize)).toBeCloseTo(
			surfaceHeight * 0.034 * 1.5,
			0,
		);
		await userEvent.keyboard("{Escape}");
		let screen = (player.result.$("[data-novel-settings]") as HTMLDialogElement)!;
		await vi.waitFor(() => expect(screen.open).toBe(true));
		let dyslexia = screen.querySelector<HTMLInputElement>('input[name="dyslexiaFont"]')!;
		await userEvent.click(dyslexia);
		expect(changed).toHaveBeenLastCalledWith(
			expect.objectContaining({ dyslexiaFont: true, fontSize: 1.5 }),
		);
		expect(getComputedStyle(line).fontFamily).toContain("OpenDyslexic");
		let speed = screen.querySelector<HTMLInputElement>('input[name="textSpeed"]')!;
		speed.value = "80";
		speed.dispatchEvent(new Event("input", { bubbles: true }));
		expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ textSpeed: 80 }));
		let music = screen.querySelector<HTMLInputElement>('input[name="volume.music"]')!;
		music.value = "20";
		music.dispatchEvent(new Event("input", { bubbles: true }));
		expect(changed).toHaveBeenLastCalledWith(
			expect.objectContaining({ volume: expect.objectContaining({ music: 0.2, master: 1 }) }),
		);
	});

	test("hides the interface and brings it back on the next click without advancing", async () => {
		let player = mount();
		await shows(player, "Welcome to the café.");
		await userEvent.keyboard("h");
		await vi.waitFor(() => expect(player.result.$("[data-novel-textbox]")).toBeNull());
		expect(player.result.$("[data-novel-menu]")).toBeNull();
		clickStage(player);
		await vi.waitFor(() => expect(player.line()).toBe("Welcome to the café."));
	});

	test("enters full screen with the player as the full-screen element", async () => {
		let player = mount();
		await shows(player, "Welcome to the café.");
		await userEvent.keyboard("f");
		await vi.waitFor(() => expect(document.fullscreenElement).toBe(player.root()));
	});

	test("runs a built-in scenery transition as a typed View Transition", async () => {
		let start = vi.spyOn(document, "startViewTransition");
		let player = mount();
		await shows(player, "Welcome to the café.");
		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({ types: ["novel-stage", "novel-fade"] }),
		);
	});

	test("finishes the transition at once on a click during it", async () => {
		let player = mount();
		await vi.waitFor(() => expect(player.phase()).toBe("staging"), { timeout: 5000 });
		let started = performance.now();
		clickStage(player);
		await shows(player, "Welcome to the café.");
		expect(performance.now() - started).toBeLessThan(500);
	});

	test("skips the View Transition under prefers-reduced-motion", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		try {
			let start = vi.spyOn(document, "startViewTransition");
			let player = mount();
			await shows(player, "Welcome to the café.");
			expect(start).not.toHaveBeenCalled();
		} finally {
			await cdp().send("Emulation.setEmulatedMedia", { features: [] });
		}
	});

	test("reads each line aloud when self-voicing is on", async () => {
		let speak = vi.spyOn(speechSynthesis, "speak");
		let player = mount({ settings: { textSpeed: 0, selfVoicing: true } });
		await shows(player, "Welcome to the café.");
		await vi.waitFor(() => expect(speak).toHaveBeenCalled());
		expect(speak.mock.calls.at(-1)?.[0].text).toBe("Welcome to the café.");
	});
});
