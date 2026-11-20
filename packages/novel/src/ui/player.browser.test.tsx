/**
 * Plays a small novel through `NovelPlayer` in a real browser: frames sequenced from stage to
 * text to reply, clicks and keys, menus, pauses, interactions and endings, auto mode, skip,
 * rollback, the backlog, saves, settings, hiding the interface, full screen and transitions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { Handle, RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { TYPEWRITER_HIGHLIGHT } from "@sdxc/ui/utils";
import { css, on, TypedEventTarget } from "remix/component";
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

import type { AutoBehavior } from "./behaviors/auto.js";

import { SettingsModel } from "./behaviors/settings.js";
import { keyboardControls } from "./controls.js";
import { InteractionCompleteEvent, NovelSaveEvent } from "./events.js";
import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";

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

/** Catches a fish of the size its input asks for, completing the interaction with a DOM event. */
function Fishing(handle: Handle<{ input: { difficulty: number } }>) {
	return () => (
		<button
			type="button"
			data-fish=""
			mix={[
				css({ position: "absolute", inset: "40%" }),
				on("click", (event) => {
					let caught = handle.props.input.difficulty * 2;
					event.currentTarget.dispatchEvent(
						new InteractionCompleteEvent(INTERACTIONS.fishing, { caught }),
					);
				}),
			]}
		>
			Fish
		</button>
	);
}

/** The fixture's interactions, drawn through one `NovelPlayer.Interaction` part. */
function Games() {
	return () => (
		<NovelPlayer.Interaction interactions={INTERACTIONS}>
			{(frame) => <Fishing input={frame.input} />}
		</NovelPlayer.Interaction>
	);
}

/** A choices part built only on the player's context: one plain button per option. */
function PlainChoices(handle: Handle) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let frame = player.frame;
		if (frame?.type !== "choice" || player.phase === "staging") return null;
		return (
			<ul data-plain-choices="">
				{frame.options.map((option) => (
					<li key={option.id}>
						<button
							type="button"
							data-plain={option.id}
							mix={on("click", () => player.answer(frame.choose(option.id)))}
						>
							{option.id}
						</button>
					</li>
				))}
			</ul>
		);
	};
}

/**
 * A textbox built only on the player's `reveal` behavior: it shows each line whole and reports
 * it revealed 50ms after typing starts, or at once when the reader asks for the rest.
 */
function InstantText(handle: Handle) {
	let player = handle.context.get(NovelPlayer);
	let reveal = player.reveal;
	let timer: ReturnType<typeof setTimeout> | undefined;
	reveal.addEventListener(
		"change",
		() => {
			clearTimeout(timer);
			if (reveal.status === "typing" && reveal.complete) reveal.reveal();
			else if (reveal.status === "typing") timer = setTimeout(() => reveal.reveal(), 50);
			void handle.update();
		},
		{ signal: handle.signal },
	);
	return () => {
		let frame = player.frame;
		if (frame?.type !== "line") return null;
		return (
			<p data-custom-line="" data-status={reveal.status}>
				<Message i18nKey={frame.key} values={frame.values} />
			</p>
		);
	};
}

/**
 * A custom player behavior: it counts the frames the play shows and keeps the phases and endings
 * it saw, following the player's context events alone.
 */
class Pulse extends TypedEventTarget<{ change: Event }> {
	beats = 0;
	phases: string[] = [];
	endings: Array<string | null> = [];

	constructor(player: NovelPlayer.Context, signal: AbortSignal) {
		super();
		player.addEventListener(
			"frame",
			() => {
				this.beats++;
				this.dispatchEvent(new Event("change"));
			},
			{ signal },
		);
		player.addEventListener("phase", () => this.phases.push(player.phase), { signal });
		player.addEventListener("ending", () => this.endings.push(player.ending?.key ?? null), {
			signal,
		});
	}
}

/** Every pulse a test built, newest last, for the test to read what it followed. */
const PULSES: Pulse[] = [];

/** Provides a {@link Pulse} built over the player to the parts inside it. */
function PulseProvider(handle: Handle<{ children?: RemixNode }, Pulse>) {
	let pulse = new Pulse(handle.context.get(NovelPlayer), handle.signal);
	PULSES.push(pulse);
	handle.context.set(pulse);
	return () => handle.props.children;
}

/** A part reading the pulse and the play's story state. */
function PulseMeter(handle: Handle) {
	let pulse = handle.context.get(PulseProvider);
	let player = handle.context.get(NovelPlayer);
	pulse.addEventListener("change", () => void handle.update(), { signal: handle.signal });
	return () => (
		<output data-pulse={String(pulse.beats)} data-gold={String(player.state?.["gold"])} />
	);
}

/** An auto mode that starts on and advances every line after 10ms, whatever the settings say. */
class EagerAuto extends TypedEventTarget<AutoBehavior.EventMap> implements AutoBehavior {
	enabled = true;
	waits = 0;
	#timer: ReturnType<typeof setTimeout> | undefined;

	toggle(): void {
		this.enabled = !this.enabled;
		this.dispatchEvent(new Event("change"));
	}

	wait(_line: AutoBehavior.Line, advance: () => void): void {
		this.cancel();
		if (!this.enabled) return;
		this.waits++;
		this.#timer = setTimeout(advance, 10);
	}

	cancel(): void {
		clearTimeout(this.#timer);
	}
}

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	if (document.fullscreenElement !== null) await document.exitFullscreen();
	vi.restoreAllMocks();
});

/**
 * Mounts `NovelPlayer.Default` in a 960×540 box with instant text unless the props say
 * otherwise, catching its events on an ancestor; `parts` composes the player instead.
 */
function mount(props: Partial<NovelPlayer.Props> = {}, parts?: RemixNode) {
	let events = { save: vi.fn(), settings: vi.fn(), ending: vi.fn(), complete: vi.fn() };
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
					on("novel:save", (event) => events.save(event.slot, event.state)),
					on("novel:settings", (event) => events.settings(event.settings)),
					on("novel:ending", (event) => events.ending(event.ending)),
					on("novel:complete", (event) => events.complete(event.interaction, event.output)),
				]}
			>
				{parts === undefined ? (
					<NovelPlayer.Default
						novel={fixture()}
						start={{ seed: "player" }}
						settings={{ textSpeed: 0 }}
						{...props}
					>
						<Games />
					</NovelPlayer.Default>
				) : (
					<NovelPlayer
						novel={fixture()}
						start={{ seed: "player" }}
						settings={{ textSpeed: 0 }}
						{...props}
					>
						{parts}
					</NovelPlayer>
				)}
			</div>
		</IntlProvider>,
		{ container },
	);
	let result = mounted;
	return {
		result,
		events,
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
		expect(CSS.highlights.get(TYPEWRITER_HIGHLIGHT)?.size).toBeGreaterThan(0);
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

	test("renders a custom frame through NovelPlayer.Interaction and dispatches novel:ending", async () => {
		let player = mount();
		let ended = player.events.ending;
		await toMenu(player);
		player.result.$('[data-option="cafe.stay"]')!.click();
		await vi.waitFor(() => expect(player.result.$("[data-fish]")).not.toBeNull(), {
			timeout: 5000,
		});
		(player.result.$("[data-fish]") as HTMLButtonElement)!.click();
		await shows(player, "Wow, 4 fish!");
		expect(player.events.complete).toHaveBeenCalledExactlyOnceWith("fishing", { caught: 4 });
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
		player.surface().dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true }));
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

	test("quick saves through novel:save and quick loads the saved line", async () => {
		let player = mount();
		await shows(player, "Welcome to the café.");
		clickStage(player);
		await shows(player, "Hello, Ada!");
		await userEvent.keyboard("q");
		let [slot, state] = player.events.save.mock.lastCall as [string, GameState];
		expect(slot).toBe("quick");
		expect(state.position).toEqual({ scene: "prologue.opening", line: "opening.hello" });
		clickStage(player);
		await shows(player, "Together!");
		await userEvent.keyboard("w");
		await shows(player, "Hello, Ada!");
	});

	test("saves into a slot from the save screen and draws its thumbnail on the load screen", async () => {
		let player = mount({ mix: [keyboardControls()] }, [
			<NovelPlayer.Stage key="stage">
				<NovelPlayer.Textbox />
			</NovelPlayer.Stage>,
			<NovelPlayer.Saves key="saves" slots={2} />,
		]);
		let onSave = player.events.save;
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
		let first = mount();
		await shows(first, "Welcome to the café.");
		clickStage(first);
		await shows(first, "Hello, Ada!");
		await userEvent.keyboard("q");
		let state = first.result.$(
			'[data-novel-saves="load"] [data-slot-name="quick"]',
		) as HTMLButtonElement;
		expect(state!.disabled).toBe(false);
		mounted?.cleanup();
		let second = mount();
		await shows(second, "Welcome to the café.");
		clickStage(second);
		await shows(second, "Hello, Ada!");
		await userEvent.keyboard("q");
		let saves = Object.fromEntries(second.events.save.mock.calls) as Record<string, GameState>;
		mounted?.cleanup();
		let third = mount({ saves });
		await shows(third, "Welcome to the café.");
		await userEvent.keyboard("w");
		await shows(third, "Hello, Ada!");
	});

	test("reports changed settings and applies text size and the dyslexia-friendly font", async () => {
		let player = mount({ settings: { textSpeed: 0, fontSize: 1.5 } });
		let changed = player.events.settings;
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

	test("dispatches typed, bubbling events an ancestor catches through on()", async () => {
		let player = mount({ settings: { textSpeed: 0, skip: "all" } });
		await shows(player, "Welcome to the café.");
		let saved = new Promise<NovelSaveEvent>((resolve) =>
			document.body.addEventListener("novel:save", resolve, { once: true }),
		);
		await userEvent.keyboard("q");
		let event = await saved;
		expect(event).toBeInstanceOf(NovelSaveEvent);
		expect(event.bubbles).toBe(true);
		expect(event.target).toBe(player.root());
		expect(event.slot).toBe("quick");
		expect(event.state.position).toEqual({ scene: "prologue.opening", line: "opening.welcome" });
		expect(player.events.save).toHaveBeenCalledWith("quick", event.state);
	});

	test("takes no keys, wheel or gamepad input when its control mixins are left out", async () => {
		let player = mount({}, [
			<NovelPlayer.Stage key="stage">
				<NovelPlayer.Textbox />
			</NovelPlayer.Stage>,
			<NovelPlayer.Backlog key="backlog" />,
		]);
		await shows(player, "Welcome to the café.");
		await userEvent.keyboard(" ");
		await userEvent.keyboard("l");
		player.surface().dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(player.line()).toBe("Welcome to the café.");
		expect((player.result.$("[data-novel-backlog]") as HTMLDialogElement).open).toBe(false);
		expect(getComputedStyle(player.root()).touchAction).toBe("auto");
		clickStage(player);
		await shows(player, "Hello, Ada!");
	});

	test("answers a menu from a custom part built only on the player's context", async () => {
		let player = mount({}, [
			<NovelPlayer.Stage key="stage">
				<NovelPlayer.Textbox />
				<PlainChoices />
				<Games />
			</NovelPlayer.Stage>,
		]);
		await shows(player, "Welcome to the café.");
		for (let next of ["Hello, Ada!", "Together!", "I should say something."]) {
			clickStage(player);
			await shows(player, next);
		}
		clickStage(player);
		await vi.waitFor(() => expect(player.result.$("[data-plain-choices]")).not.toBeNull(), {
			timeout: 5000,
		});
		expect(player.result.$("[data-novel-choices]")).toBeNull();
		(player.result.$('[data-plain="cafe.stay"]') as HTMLButtonElement).click();
		await vi.waitFor(() => expect(player.result.$("[data-fish]")).not.toBeNull(), {
			timeout: 5000,
		});
	});

	test("drives the reveal of a custom textbox through the reveal behavior alone", async () => {
		let player = mount({}, [
			<NovelPlayer.Stage key="stage">
				<InstantText />
			</NovelPlayer.Stage>,
		]);
		let line = () => player.result.$("[data-custom-line]");
		await vi.waitFor(() => expect(line()?.dataset["status"]).toBe("typing"), { timeout: 5000 });
		expect(player.phase()).toBe("typing");
		await vi.waitFor(() => expect(player.phase()).toBe("waiting"));
		expect(line()!.dataset["status"]).toBe("revealed");
		expect(line()!.textContent).toBe("Welcome to the café.");
		clickStage(player);
		await vi.waitFor(() => expect(line()?.textContent).toBe("Hello, Ada!"), { timeout: 5000 });
		expect(player.result.$("[data-novel-line]")).toBeNull();
	});

	test("restyles its parts through theme variables set on the player", async () => {
		let player = mount({
			mix: [
				css({
					"--novel-letterbox": "rgb(9, 9, 9)",
					"--novel-textbox-background": "rgb(1, 2, 3)",
					"--novel-textbox-border-image-source": "linear-gradient(red, blue)",
					"--novel-textbox-border-image-slice": "30",
					"--novel-textbox-border-image-width": "12px",
					"--novel-nameplate-font-weight": "300",
					"--novel-text-shadow": "rgb(0, 0, 0) 1px 1px 0px",
				}),
			],
		});
		await shows(player, "Welcome to the café.");
		let textbox = player.result.$("[data-novel-textbox]")!;
		let style = getComputedStyle(textbox);
		expect(style.backgroundColor).toBe("rgb(1, 2, 3)");
		expect(style.borderImageSource).toContain("linear-gradient");
		expect(style.borderImageSlice).toBe("30");
		expect(style.borderImageWidth).toBe("12px");
		expect(getComputedStyle(player.root()).backgroundColor).toBe("rgb(9, 9, 9)");
		expect(getComputedStyle(player.result.$("[data-novel-line]")!).textShadow).toBe(
			"rgb(0, 0, 0) 1px 1px 0px",
		);
		clickStage(player);
		await shows(player, "Hello, Ada!");
		expect(getComputedStyle(player.result.$("[data-novel-speaker]")!).fontWeight).toBe("300");
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

	test("ignores a completion for an interaction other than the current frame's", async () => {
		let player = mount();
		await toMenu(player);
		player.result.$('[data-option="cafe.stay"]')!.click();
		await vi.waitFor(() => expect(player.result.$("[data-fish]")).not.toBeNull(), {
			timeout: 5000,
		});
		let other = interactions({
			lockpick: interaction({ input: s.object({}), output: s.object({ opened: s.boolean() }) }),
		});
		player.result
			.$("[data-fish]")!
			.dispatchEvent(new InteractionCompleteEvent(other.lockpick, { opened: true }));
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(player.result.$("[data-fish]")).not.toBeNull();
	});

	test("lets a provider part build a behavior that follows the player's events", async () => {
		let player = mount({}, [
			<PulseProvider key="pulse">
				<NovelPlayer.Stage>
					<NovelPlayer.Textbox />
					<NovelPlayer.Choices />
					<PulseMeter />
				</NovelPlayer.Stage>
			</PulseProvider>,
		]);
		let meter = () => player.result.$("[data-pulse]")!;
		await shows(player, "Welcome to the café.");
		expect(meter().dataset["pulse"]).toBe("1");
		expect(meter().dataset["gold"]).toBe("10");
		clickStage(player);
		await shows(player, "Hello, Ada!");
		expect(meter().dataset["pulse"]).toBe("2");
		for (let next of ["Together!", "I should say something."]) {
			clickStage(player);
			await shows(player, next);
		}
		clickStage(player);
		await vi.waitFor(() => expect(player.result.$("[data-novel-choices]")).not.toBeNull(), {
			timeout: 5000,
		});
		player.result.$('[data-option="cafe.leave"]')!.click();
		await vi.waitFor(() => expect(player.events.ending).toHaveBeenCalled(), { timeout: 5000 });
		let pulse = PULSES.at(-1)!;
		expect(pulse.endings).toEqual(["endings.bad"]);
		expect(pulse.phases.slice(0, 4)).toEqual(["replying", "staging", "typing", "waiting"]);
		expect(pulse.beats).toBeGreaterThanOrEqual(5);
	});

	test("runs a custom auto behavior passed through the behaviors prop", async () => {
		let auto = new EagerAuto();
		let player = mount({ settings: { textSpeed: 0, autoDelay: 60_000 }, behaviors: { auto } });
		await vi.waitFor(() => expect(player.result.$("[data-novel-choices]")).not.toBeNull(), {
			timeout: 5000,
		});
		expect(auto.waits).toBeGreaterThanOrEqual(4);
		expect(player.root().dataset["auto"]).toBe("true");
	});

	test("seeds a custom settings behavior from the settings prop and reports its changes", async () => {
		let settings = new SettingsModel({ autoDelay: 5 });
		let player = mount({ settings: { textSpeed: 0, autoDelay: 123 }, behaviors: { settings } });
		await shows(player, "Welcome to the café.");
		expect(settings.value.autoDelay).toBe(123);
		settings.update({ fontSize: 1.5 });
		expect(player.events.settings).toHaveBeenCalledWith(
			expect.objectContaining({ fontSize: 1.5, autoDelay: 123 }),
		);
	});
});
