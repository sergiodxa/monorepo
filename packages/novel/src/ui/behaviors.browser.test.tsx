/**
 * Plays a two-chapter novel through `NovelPlayer` in a real browser to check the autosave,
 * notifications and read-line behaviors end to end: saves leaving as `novel:save`, toasts in
 * their popover, `data-novel-read` on read lines, and custom behaviors replacing each slot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { css, on, TypedEventTarget } from "remix/component";
import { render } from "remix/component/test";
import * as s from "remix/data-schema";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { StopFrame } from "../frames.js";

import { assets, chapter, createNovel, createScene, scene, scenes } from "../index.js";

import type { AutosaveBehavior } from "./behaviors/autosave.js";
import type {
	NotificationInput,
	NotificationsBehavior,
	NovelNotification,
} from "./behaviors/notifications.js";
import type { ReadBehavior } from "./behaviors/read.js";

import { AutosaveModel } from "./behaviors/autosave.js";
import { NovelPlayer } from "./player.js";

/** An SVG image as a data URL, so images decode without a server. */
function svg(color: string): string {
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="100%" height="100%" fill="${color}"/></svg>`,
	)}`;
}

const MESSAGES = {
	chapters: { prologue: "Prologue" },
	titles: { cafe: "Finale" },
	opening: {
		welcome: "One.",
		both: "Two.",
		thinking: "Three.",
		done: "Four.",
		hello: "Achievement: {$name}",
	},
	endings: { good: "Good ending", bad: "Bad ending" },
};

/** The story state, the same shape the package's fixture declares, though these scenes ignore it. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({
	prologue: chapter({ title: "chapters.prologue", scenes: { opening: scene() } }),
	finale: chapter({ title: "titles.cafe", scenes: { end: scene(), other: scene() } }),
});

const ASSETS = assets({
	backgrounds: { room: svg("gray") },
	images: { letter: svg("ivory") },
});

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.show(ASSETS.backgrounds.room),
	ctx.narrate("opening.welcome"),
	ctx.show(ASSETS.images.letter),
	ctx.narrate("opening.both"),
	ctx.narrate("opening.thinking"),
	ctx.goto(SCENES.finale.end),
]);

const END = createScene(SCENES.finale.end, (ctx) => [
	ctx.notify("opening.hello", { name: "Ada" }),
	ctx.narrate("opening.done"),
	ctx.ending("endings.good"),
]);

const OTHER = createScene(SCENES.finale.other, (ctx) => [ctx.ending("endings.bad")]);

/** A novel over the fixture. */
function fixture() {
	let novel = createNovel({
		scenes: SCENES,
		assets: ASSETS,
		state: STATE,
		initial: SCENES.prologue.opening,
	});
	novel.map(SCENES.prologue.opening, OPENING);
	novel.map(SCENES.finale.end, END);
	novel.map(SCENES.finale.other, OTHER);
	return novel;
}

/** An autosave that saves into its own slot at every line, and counts the chapters it hears. */
class EveryLine extends TypedEventTarget<AutosaveBehavior.EventMap> implements AutosaveBehavior {
	readonly slot = "mine";
	chapters = 0;

	chapter(): void {
		this.chapters++;
	}

	line(): void {
		this.dispatchEvent(new Event("save"));
	}
}

/** Notifications kept in a plain list, which no part shows. */
class Inbox
	extends TypedEventTarget<NotificationsBehavior.EventMap>
	implements NotificationsBehavior
{
	entries: NovelNotification[] = [];

	push(notification: NotificationInput): NovelNotification {
		let entry = { ...notification, id: `inbox-${this.entries.length}`, kind: "inbox" };
		this.entries.push(entry);
		this.dispatchEvent(new Event("change"));
		return entry;
	}

	dismiss(): void {}
}

/** A read tracker that calls every line read, and keeps the stops it was given. */
class AllRead extends TypedEventTarget<ReadBehavior.EventMap> implements ReadBehavior {
	readonly current = true;
	frames: StopFrame[] = [];

	isRead(): boolean {
		return true;
	}

	record(frame: StopFrame): void {
		this.frames.push(frame);
	}
}

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/**
 * Mounts `NovelPlayer.Default` in a 960×540 box with instant text, catching `novel:save` on an
 * ancestor; `parts` composes the player instead.
 */
function mount(props: Partial<NovelPlayer.Props> = {}, parts?: RemixNode) {
	let saves = vi.fn();
	let container = document.createElement("div");
	container.style.width = "960px";
	container.style.height = "540px";
	document.body.append(container);
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });
	let shared = { novel: fixture(), settings: { textSpeed: 0 }, ...props };
	mounted = render(
		<IntlProvider intl={intl}>
			<div
				mix={[
					css({ display: "contents" }),
					on("novel:save", (event) => saves(event.slot, event.state)),
				]}
			>
				{parts === undefined ? (
					<NovelPlayer.Default {...shared} />
				) : (
					<NovelPlayer {...shared}>{parts}</NovelPlayer>
				)}
			</div>
		</IntlProvider>,
		{ container },
	);
	let result = mounted;
	return {
		result,
		saves,
		line: () => result.$("[data-novel-line]"),
		phase: () => result.$("[data-novel-player]")!.dataset["phase"],
		click: () => (result.$("[data-novel-surface]") as HTMLElement).click(),
	};
}

/** Waits until the player shows `text` and waits for the reader. */
async function shows(player: ReturnType<typeof mount>, text: string): Promise<void> {
	await vi.waitFor(
		() => {
			expect(player.line()?.textContent).toBe(text);
			expect(player.phase()).toBe("waiting");
		},
		{ timeout: 5000 },
	);
}

/** Clicks through the opening to the finale's line. */
async function toFinale(player: ReturnType<typeof mount>): Promise<void> {
	for (let text of ["One.", "Two.", "Three."]) {
		await shows(player, text);
		player.click();
	}
	await shows(player, "Four.");
}

describe("NovelPlayer behaviors", () => {
	test("autosaves through novel:save at each chapter's start and every few lines", async () => {
		let player = mount({ behaviors: { autosave: new AutosaveModel({ every: 2 }) } });
		await shows(player, "One.");
		expect(player.saves).toHaveBeenCalledTimes(1);
		expect(player.saves.mock.lastCall?.[0]).toBe("auto");
		expect(player.saves.mock.lastCall?.[1].position.line).toBe("opening.welcome");
		player.click();
		await shows(player, "Two.");
		expect(player.saves).toHaveBeenCalledTimes(2);
		expect(player.saves.mock.lastCall?.[1].position.line).toBe("opening.both");
		player.click();
		await shows(player, "Three.");
		player.click();
		await shows(player, "Four.");
		expect(player.saves).toHaveBeenCalledTimes(3);
		expect(player.saves.mock.lastCall?.[1].position).toEqual({
			scene: "finale.end",
			line: "opening.done",
		});
	});

	test("lists the autosave on the load screen and keeps it load-only on the save screen", async () => {
		let player = mount();
		await shows(player, "One.");
		let save = player.result.$('[data-novel-saves="save"] [data-autosave]') as HTMLButtonElement;
		let load = player.result.$('[data-novel-saves="load"] [data-autosave]') as HTMLButtonElement;
		expect(save.disabled).toBe(true);
		expect(load.disabled).toBe(false);
		expect(load.textContent).toContain("Autosave");
	});

	test("never autosaves during a replay", async () => {
		let player = mount({ start: { scene: SCENES.prologue.opening, replay: "scene" } });
		await shows(player, "One.");
		player.click();
		await shows(player, "Two.");
		expect(player.saves).not.toHaveBeenCalled();
	});

	test("shows a toast in a manual popover when an image unlocks, and dismisses it", async () => {
		let player = mount({}, [
			<NovelPlayer.Stage key="stage">
				<NovelPlayer.Textbox />
			</NovelPlayer.Stage>,
			<NovelPlayer.Notifications key="toasts" duration={300} />,
		]);
		let popover = () => player.result.$("[data-novel-notifications]") as HTMLElement;
		await shows(player, "One.");
		expect(popover().matches(":popover-open")).toBe(false);
		player.click();
		await vi.waitFor(() => expect(player.result.$('[data-kind="image"]')).not.toBeNull(), {
			timeout: 5000,
		});
		expect(popover().getAttribute("popover")).toBe("manual");
		expect(popover().matches(":popover-open")).toBe(true);
		expect(player.result.$('[data-kind="image"]')!.textContent).toBe("CG unlocked");
		await vi.waitFor(() => expect(popover().matches(":popover-open")).toBe(false), {
			timeout: 2000,
		});
		expect(player.result.$("[data-novel-notification]")).toBeNull();
	});

	test("reports an ending with how many of every ending were reached", async () => {
		let player = mount();
		await toFinale(player);
		player.click();
		await vi.waitFor(
			() => expect(player.result.$('[data-kind="ending"]')?.textContent).toBe("Ending 1/2"),
			{ timeout: 5000 },
		);
	});

	test("shows a scene's notify as a toast of its translated message", async () => {
		let player = mount();
		await toFinale(player);
		let toast = player.result.$('[data-kind="notify"]');
		expect(toast?.textContent).toBe("Achievement: Ada");
	});

	test("translates unlock toasts through the labels prop", async () => {
		let player = mount({ labels: { imageUnlocked: "Illustration débloquée" } });
		await shows(player, "One.");
		player.click();
		await vi.waitFor(
			() =>
				expect(player.result.$('[data-kind="image"]')?.textContent).toBe("Illustration débloquée"),
			{ timeout: 5000 },
		);
	});

	test("marks lines read in an earlier playthrough in the textbox and the backlog", async () => {
		let player = mount({
			start: { persistent: { seen: { "prologue.opening:opening.both": {} } } },
		});
		await shows(player, "One.");
		expect(player.line()!.hasAttribute("data-novel-read")).toBe(false);
		player.click();
		await shows(player, "Two.");
		expect(player.line()!.hasAttribute("data-novel-read")).toBe(true);
		expect(player.result.$("[data-novel-textbox]")!.hasAttribute("data-novel-read")).toBe(true);
		player.click();
		await shows(player, "Three.");
		expect(player.line()!.hasAttribute("data-novel-read")).toBe(false);
		let entries = Array.from(player.result.$$("[data-novel-backlog] li"));
		expect(entries.map((entry) => entry.hasAttribute("data-novel-read"))).toEqual([
			false,
			true,
			false,
		]);
	});

	test("tints read lines with --novel-read-color", async () => {
		let player = mount({
			start: { persistent: { seen: { "prologue.opening:opening.welcome": {} } } },
			mix: [css({ "--novel-read-color": "rgb(255, 0, 0)" })],
		});
		await shows(player, "One.");
		expect(getComputedStyle(player.line()!).color).toBe("rgb(255, 0, 0)");
	});

	test("runs custom autosave, notifications and read behaviors passed through behaviors", async () => {
		let autosave = new EveryLine();
		let notifications = new Inbox();
		let read = new AllRead();
		let player = mount({ behaviors: { autosave, notifications, read } });
		await shows(player, "One.");
		player.click();
		await shows(player, "Two.");
		expect(player.saves.mock.calls.map((call) => call[0])).toEqual(["mine", "mine"]);
		expect(autosave.chapters).toBe(1);
		expect(notifications.entries).toEqual([{ text: "CG unlocked", kind: "inbox", id: "inbox-0" }]);
		expect(player.result.$("[data-novel-notification]")!.dataset["kind"]).toBe("inbox");
		expect(player.line()!.hasAttribute("data-novel-read")).toBe(true);
		expect(read.frames.map((frame) => frame.type)).toEqual(["line", "line"]);
		expect(
			player.result.$('[data-novel-saves="load"] [data-slot-name="mine"]')!.textContent,
		).toContain("Autosave");
	});
});
