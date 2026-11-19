/**
 * Holds the textbox and the choice menu to their contracts in a real browser: the line typed
 * through a CSS highlight at the reader's speed, markup effects from `Trans`, a live region
 * with the whole line, locked and chosen options, and a timed menu taking its default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { ChoiceFrame, FrameOption, LineFrame, Reply } from "../frames.js";

import { ChoiceMenu, timeoutOption } from "./choice-menu.js";
import { Captions, Textbox } from "./textbox.js";
import { Typewriter, UNREVEALED_HIGHLIGHT } from "./typewriter.js";

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

/** Renders `node` under an English translator over {@link MESSAGES}. */
function mount(node: RemixNode): RenderResult {
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });
	mounted = render(<IntlProvider intl={intl}>{node}</IntlProvider>);
	return mounted;
}

/** A reply stand-in; these tests only check what the components report. */
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
	let highlight = CSS.highlights.get(UNREVEALED_HIGHLIGHT);
	return [...(highlight ?? [])].map((range) => (range as Range).toString()).join("");
}

describe("Textbox", () => {
	test("names the speakers in their colors and renders the line through Trans", () => {
		let result = mount(
			<Textbox
				frame={line("line.named", {
					values: { name: "Ada" },
					speakers: [
						{ id: "mika", name: "cast.mika", color: "#e86a92" },
						{ id: "ren", name: "cast.ren" },
					],
				})}
				typing={false}
				textSpeed={40}
			/>,
		);
		expect(result.$("[data-novel-speaker]")!.textContent).toBe("Mika & Ren");
		expect(result.$("[data-novel-speaker] span")!.style.color).toBe("rgb(232, 106, 146)");
		expect(result.$("[data-novel-line]")!.textContent).toBe("Hi, Ada!");
		expect(result.$("[data-novel-textbox]")!.getAttribute("aria-live")).toBe("polite");
	});

	test("maps b, i and shake markup onto elements", () => {
		let bold = mount(<Textbox frame={line("line.bold")} typing={false} textSpeed={40} />);
		expect(bold.$("[data-novel-line] b")!.textContent).toBe("important");
		expect(bold.$("[data-novel-line] i")!.textContent).toBe("quiet");
		mounted?.cleanup();
		let shake = mount(<Textbox frame={line("line.shake")} typing={false} textSpeed={40} />);
		let effect = shake.$('[data-novel-effect="shake"]')!;
		expect(effect.textContent).toBe("No way!");
		expect(getComputedStyle(effect).animationName).toBe("novel-text-shake");
		expect(getComputedStyle(effect).animationIterationCount).toBe("infinite");
	});

	test("hides the whole line until typing starts, keeping it in the live region", async () => {
		let result = mount(<Textbox frame={line("line.plain")} typing={false} textSpeed={40} />);
		await result.act(() => undefined);
		expect(unrevealed()).toBe("Hello there.");
		expect(result.$("[data-novel-textbox]")!.textContent).toBe("Hello there.");
		let style = getComputedStyle(
			result.$("[data-novel-line]")!,
			`::highlight(${UNREVEALED_HIGHLIGHT})`,
		);
		expect(style.color).toBe("rgba(0, 0, 0, 0)");
	});

	test("types the line out at the text speed and reports when it is revealed", async () => {
		let revealed = vi.fn();
		mount(<Textbox frame={line("line.plain")} typing textSpeed={60} onRevealed={revealed} />);
		await vi.waitFor(() => expect(unrevealed().length).toBeGreaterThan(0));
		await vi.waitFor(() => expect(unrevealed().length).toBeLessThan(12));
		await vi.waitFor(() => expect(revealed).toHaveBeenCalledOnce(), { timeout: 2000 });
		expect(unrevealed()).toBe("");
	});

	test("shows the rest of the line at once when completed", async () => {
		let revealed = vi.fn();
		let frame = line("line.plain");
		let result = mount(<Textbox frame={frame} typing textSpeed={2} onRevealed={revealed} />);
		await vi.waitFor(() => expect(unrevealed()).not.toBe(""));
		await result.act(() =>
			result.root.render(
				<IntlProvider
					intl={createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } })}
				>
					<Textbox frame={frame} typing complete textSpeed={2} onRevealed={revealed} />
				</IntlProvider>,
			),
		);
		await vi.waitFor(() => expect(revealed).toHaveBeenCalledOnce());
		expect(unrevealed()).toBe("");
	});

	test("shows the line at once at text speed 0", async () => {
		let revealed = vi.fn();
		mount(<Textbox frame={line("line.plain")} typing textSpeed={0} onRevealed={revealed} />);
		await vi.waitFor(() => expect(revealed).toHaveBeenCalledOnce());
		expect(unrevealed()).toBe("");
	});
});

describe(Typewriter, () => {
	/** Renders a line into a fresh element. */
	function element(html: string): HTMLElement {
		let root = document.createElement("p");
		root.innerHTML = html;
		document.body.append(root);
		return root;
	}

	test("holds at a pause and halves the speed inside speed markup", async () => {
		let root = element(
			'Wait<span data-novel-pause="300"></span> for <span data-novel-speed="0.5">it</span>',
		);
		let writer = new Typewriter(root);
		let started = performance.now();
		writer.start(100);
		await writer.done;
		let elapsed = performance.now() - started;
		expect(elapsed).toBeGreaterThanOrEqual(4 * 10 + 300 + 4 * 10 + 2 * 20 - 5);
		root.remove();
	});

	test("finishes early and releases its highlight range", () => {
		let root = element("Some text");
		let writer = new Typewriter(root);
		writer.start(1);
		expect(unrevealed()).toBe("Some text");
		writer.finish();
		expect(writer.finished).toBe(true);
		expect(unrevealed()).toBe("");
		root.remove();
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
	test("shows the prompt and every option, locked ones disabled with their reason", () => {
		let chosen = vi.fn();
		let result = mount(<ChoiceMenu frame={menu(OPTIONS)} onChoose={chosen} />);
		let buttons = [...result.$$("button")] as HTMLButtonElement[];
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
		expect(chosen).toHaveBeenCalledWith("menu.leave");
	});

	test("counts a timed menu down and then takes its default", async () => {
		let chosen = vi.fn();
		let result = mount(
			<ChoiceMenu
				frame={menu(OPTIONS, { timeout: 150, default: "menu.leave" })}
				onChoose={chosen}
				timeLeftLabel="Time left"
			/>,
		);
		let timer = result.$('[role="timer"]')!;
		expect(timer.getAttribute("aria-label")).toBe("Time left");
		expect(getComputedStyle(timer, "::after").animationName).toBe("novel-countdown");
		expect(chosen).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(chosen).toHaveBeenCalledWith("menu.leave"));
	});

	test("takes the first available option when a timed menu has no default", () => {
		expect(timeoutOption(menu([OPTIONS[2]!, OPTIONS[1]!], { timeout: 100 }))).toBe("menu.leave");
	});
});
