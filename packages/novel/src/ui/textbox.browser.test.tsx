/**
 * Holds the textbox and the choice menu to their contracts in a real browser, inside a player
 * over a stub novel that yields hand-built frames: the line revealed through a CSS highlight at
 * the reader's speed, markup from `Trans`, the live region, locked and chosen options, and a
 * timed menu taking its default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { success } from "@sdxc/result";
import { TYPEWRITER_HIGHLIGHT } from "@sdxc/ui/utils";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { ChoiceFrame, FrameOption, LineFrame, Reply, StopFrame } from "../frames.js";
import type { Novel } from "../novel.js";

import { timeoutOption } from "./behaviors/countdown.js";
import { NovelPlayer } from "./player.js";
import { Captions } from "./textbox.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** The test catalog, with every markup effect the player ships. */
const MESSAGES = {
	cast: { mika: "Mika", ren: "Ren" },
	line: {
		plain: "Hello there.",
		bold: "This is {#b}important{/b} and {#i}quiet{/i}.",
		shake: "{#shake}No way!{/shake}",
		pause: "Wait{#pause/} for it.",
		slow: "{#speed}slow{/speed}",
		fast: "{#speed rate=4}fast{/speed} then {#speed rate=$rate}set{/speed}",
		held: "Wait{#pause ms=250/} for it.",
		named: "Hi, {$name}!",
	},
	menu: {
		ask: "Where to?",
		stay: "Stay",
		leave: "Leave",
		fly: "Fly",
		needWings: "You need wings.",
	},
	captions: { door: "A door creaks." },
};

/** Renders `node` in a 640×360 box under an English translator over {@link MESSAGES}. */
function mount(node: RemixNode): RenderResult {
	let container = document.createElement("div");
	container.style.width = "640px";
	container.style.height = "360px";
	document.body.append(container);
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });
	mounted = render(<IntlProvider intl={intl}>{node}</IntlProvider>, { container });
	return mounted;
}

/** A novel whose play yields `frames` in order, then ends, for parts that read a player. */
function stub(frames: StopFrame[]): Novel {
	let queue = [...frames];
	let started = {
		next: async () => {
			let frame = queue.shift();
			return frame === undefined
				? { done: true, value: { key: null, scene: "test" } }
				: { done: false, value: frame };
		},
		rollback: async () => null,
		save: () => undefined,
		state: undefined,
		persistent: undefined,
	};
	return { start: () => success(started), on: () => () => undefined } as unknown as Novel;
}

/** Plays `frames` in a player holding a stage with the textbox and the choice menu. */
function play(frames: StopFrame[], textSpeed: number): RenderResult {
	return mount(
		<NovelPlayer novel={stub(frames)} settings={{ textSpeed }} prefetch={false}>
			<NovelPlayer.Stage>
				<NovelPlayer.Textbox />
				<NovelPlayer.Choices />
			</NovelPlayer.Stage>
		</NovelPlayer>,
	);
}

/** The player's phase. */
function phase(result: RenderResult): string | undefined {
	return result.$("[data-novel-player]")?.dataset["phase"];
}

/** Waits until the player waits for the reader, and answers the line element. */
async function waiting(result: RenderResult): Promise<HTMLElement> {
	await vi.waitFor(() => expect(phase(result)).toBe("waiting"), { timeout: 5000 });
	return result.$("[data-novel-line]")!;
}

/** A reply stand-in; these tests only check what the parts report. */
const REPLY = {} as Reply;

/** A line frame over an empty stage. */
function line(key: string, extra: Partial<LineFrame> = {}): LineFrame {
	return {
		type: "line",
		id: `frame-${key}`,
		scene: "test",
		stage: { background: null, image: null, characters: [] },
		audio: { music: null, ambience: [], sounds: [], voice: null },
		speakers: [],
		key,
		values: undefined,
		voice: null,
		seen: false,
		advance: () => REPLY,
		...extra,
	};
}

/** The unrevealed text of the shared highlight. */
function unrevealed(): string {
	let highlight = CSS.highlights.get(TYPEWRITER_HIGHLIGHT);
	return [...(highlight ?? [])].map((range) => (range as Range).toString()).join("");
}

describe("Textbox", () => {
	test("names the speakers in their colors and renders the line through Trans", async () => {
		let result = play(
			[
				line("line.named", {
					values: { name: "Ada" },
					speakers: [
						{ id: "mika", name: "cast.mika", color: "#e86a92" },
						{ id: "ren", name: "cast.ren" },
					],
				}),
			],
			0,
		);
		let text = await waiting(result);
		expect(result.$("[data-novel-speaker]")!.textContent).toBe("Mika & Ren");
		expect(result.$("[data-novel-speaker] span")!.style.color).toBe("rgb(232, 106, 146)");
		expect(text.textContent).toBe("Hi, Ada!");
		expect(result.$("[data-novel-textbox]")!.getAttribute("aria-live")).toBe("polite");
		expect(result.$("[data-novel-next]")).not.toBeNull();
	});

	test("maps b, i and shake markup onto elements", async () => {
		let bold = play([line("line.bold")], 0);
		await waiting(bold);
		expect(bold.$("[data-novel-line] b")!.textContent).toBe("important");
		expect(bold.$("[data-novel-line] i")!.textContent).toBe("quiet");
		mounted?.cleanup();
		let shake = play([line("line.shake")], 0);
		await waiting(shake);
		let effect = shake.$('[data-novel-effect="shake"]')!;
		expect(effect.textContent).toBe("No way!");
		expect(getComputedStyle(effect).animationName).toBe("novel-text-shake");
		expect(getComputedStyle(effect).animationIterationCount).toBe("infinite");
	});

	test("reads a speed's rate and a pause's length from their markup options", async () => {
		let defaults = play([line("line.slow")], 0);
		await waiting(defaults);
		expect(defaults.$("[data-typewriter-speed]")!.dataset["typewriterSpeed"]).toBe("0.5");
		expect(defaults.$("[data-typewriter-speed]")!.textContent).toBe("slow");
		mounted?.cleanup();
		let paused = play([line("line.pause")], 0);
		await waiting(paused);
		expect(paused.$("[data-typewriter-pause]")!.dataset["typewriterPause"]).toBe("");
		mounted?.cleanup();
		let fast = play([line("line.fast", { values: { rate: 0.25 } })], 0);
		await waiting(fast);
		expect(
			[...fast.$$("[data-typewriter-speed]")].map((span) => span.dataset["typewriterSpeed"]),
		).toEqual(["4", "0.25"]);
		mounted?.cleanup();
		let held = play([line("line.held")], 0);
		await waiting(held);
		expect(held.$("[data-typewriter-pause]")!.dataset["typewriterPause"]).toBe("250");
		expect(held.$("[data-novel-line]")!.textContent).toBe("Wait for it.");
	});

	test("paints the unrevealed rest transparent while the live region holds the whole line", async () => {
		let result = play([line("line.plain")], 1);
		await vi.waitFor(() => expect(phase(result)).toBe("typing"), { timeout: 5000 });
		await vi.waitFor(() => expect(unrevealed().length).toBeGreaterThanOrEqual(11));
		expect(result.$("[data-novel-textbox]")!.textContent).toBe("Hello there.");
		expect(result.$("[data-novel-next]")).toBeNull();
		let style = getComputedStyle(
			result.$("[data-novel-line]")!,
			`::highlight(${TYPEWRITER_HIGHLIGHT})`,
		);
		expect(style.color).toBe("rgba(0, 0, 0, 0)");
	});

	test("types the line out at the text speed and reports it revealed", async () => {
		let result = play([line("line.plain")], 60);
		await vi.waitFor(() => expect(unrevealed().length).toBeGreaterThan(0), { timeout: 5000 });
		await vi.waitFor(() => expect(unrevealed().length).toBeLessThan(12));
		await vi.waitFor(() => expect(phase(result)).toBe("waiting"), { timeout: 2000 });
		expect(unrevealed()).toBe("");
	});

	test("shows the rest of the line at once on a click while it types", async () => {
		let result = play([line("line.plain")], 2);
		await vi.waitFor(() => expect(unrevealed()).not.toBe(""), { timeout: 5000 });
		result.$("[data-novel-surface]")!.click();
		await vi.waitFor(() => expect(phase(result)).toBe("waiting"));
		expect(unrevealed()).toBe("");
	});

	test("shows the line at once at text speed 0", async () => {
		let result = play([line("line.plain")], 0);
		await waiting(result);
		expect(unrevealed()).toBe("");
	});
});

describe("Captions", () => {
	test("shows the captions of the frame's sounds as a status", () => {
		let result = mount(
			<Captions
				sounds={[
					{ id: "sounds.door", src: "/door.ogg", caption: "captions.door", occurrence: "s1" },
					{ id: "sounds.step", src: "/step.ogg", occurrence: "s2" },
				]}
			/>,
		);
		expect(result.$("[data-novel-captions]")!.getAttribute("role")).toBe("status");
		expect([...result.$$("[data-novel-captions] li")].map((item) => item.textContent)).toEqual([
			"A door creaks.",
		]);
	});
});

/** A menu frame. */
function menu(options: FrameOption[], extra: Partial<ChoiceFrame> = {}): ChoiceFrame {
	return {
		type: "choice",
		id: "menu-1",
		scene: "test",
		stage: { background: null, image: null, characters: [] },
		audio: { music: null, ambience: [], sounds: [], voice: null },
		prompt: "menu.ask",
		options,
		choose: () => REPLY,
		...extra,
	};
}

/** The fixture menu's options: one taken before, one locked. */
const OPTIONS: FrameOption[] = [
	{ id: "menu.stay", label: "menu.stay", disabled: false, chosen: true },
	{ id: "menu.leave", label: "menu.leave", disabled: false, chosen: false },
	{ id: "menu.fly", label: "menu.fly", disabled: true, reason: "menu.needWings", chosen: false },
];

describe("ChoiceMenu", () => {
	test("shows the prompt and every option, locked ones disabled with their reason", async () => {
		let choose = vi.fn(() => REPLY);
		let result = play([menu(OPTIONS, { choose })], 0);
		await vi.waitFor(() => expect(result.$("[data-novel-choices]")).not.toBeNull(), {
			timeout: 5000,
		});
		let buttons = [...result.$$("[data-novel-choices] button")] as HTMLButtonElement[];
		expect(buttons.map((button) => button.textContent)).toEqual(["Stay", "Leave", "Fly"]);
		expect(result.$('[role="group"]')!.getAttribute("aria-labelledby")).toBe(
			result.$("[data-novel-choices] p")!.id,
		);
		let fly = buttons[2]!;
		expect(fly.disabled).toBe(true);
		let reason = document.getElementById(fly.getAttribute("aria-describedby")!)!;
		expect(reason.textContent).toBe("You need wings.");
		expect(buttons[0]!.dataset["chosen"]).toBe("true");
		expect(getComputedStyle(buttons[0]!).color).not.toBe(getComputedStyle(buttons[1]!).color);
		buttons[1]!.click();
		expect(choose).toHaveBeenCalledWith("menu.leave");
	});

	test("counts a timed menu down and then takes its default", async () => {
		let choose = vi.fn(() => REPLY);
		let result = play([menu(OPTIONS, { timeout: 150, default: "menu.leave", choose })], 0);
		let timer = await vi.waitFor(
			() => {
				let found = result.$('[role="timer"]');
				expect(found).not.toBeNull();
				return found!;
			},
			{ timeout: 5000 },
		);
		expect(timer.getAttribute("aria-label")).toBe("Time left");
		expect(getComputedStyle(timer, "::after").animationName).toBe("novel-countdown");
		expect(choose).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(choose).toHaveBeenCalledWith("menu.leave"));
	});

	test("takes the first available option when a timed menu has no default", () => {
		expect(timeoutOption(menu([OPTIONS[2]!, OPTIONS[1]!], { timeout: 100 }))).toBe("menu.leave");
	});
});
