/**
 * The developer tools panel in a real browser: it follows a running play, jumps with edited
 * state and reports state the schema refuses, resets persistent data, logs events, draws the
 * scene graph as SVG and lists the static problems.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { unwrap } from "@sdxc/result";
import { render } from "remix/component/test";
import * as s from "remix/data-schema";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Persistent, Play, StartOptions } from "../index.js";

import { createNovel, createScene, scene, scenes } from "../index.js";

import { createDevTools } from "./devtools.js";
import { NovelDevTools } from "./panel.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({ opening: scene(), cafe: scene(), orphan: scene() });

const OPENING = createScene(SCENES.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.narrate("opening.lucky"),
	ctx.goto(SCENES.cafe),
]);

const CAFE = createScene(SCENES.cafe, (ctx) => [
	ctx.narrate("opening.done"),
	ctx.ending("endings.good"),
]);

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts the panel over a fresh novel and answers the starts it hands the app. */
function mount() {
	let novel = createNovel({ scenes: SCENES, state: STATE, initial: SCENES.opening });
	novel.map(SCENES.opening, OPENING);
	novel.map(SCENES.cafe, CAFE);
	let starts: StartOptions[] = [];
	let devtools = createDevTools(novel, { restart: (start) => starts.push(start) });
	mounted = render(<NovelDevTools devtools={devtools} />);
	let result = mounted;
	return {
		novel,
		devtools,
		starts,
		result,
		/** Opens the disclosure whose summary reads `label`. */
		async open(label: string) {
			let summary = [...result.$$("summary")].find((node) => node.textContent?.startsWith(label));
			if (summary === undefined) throw new Error(`No "${label}" section`);
			await userEvent.click(summary);
		},
		/** Finds a button by its text. */
		button(label: string): HTMLButtonElement {
			let found = [...result.$$("button")].find((node) => node.textContent?.trim() === label);
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

describe("NovelDevTools", () => {
	test("follows the running play's position and state", async () => {
		let panel = mount();
		expect(panel.result.container.textContent).toContain("Waiting for the play");
		await playLines(unwrap(panel.novel.start({ state: { gold: 7 } })), 2);
		await vi.waitFor(() =>
			expect(panel.result.$("[data-testid=position]")?.textContent).toBe("opening · opening.lucky"),
		);
		expect(panel.result.$("[aria-label='Story state']")?.textContent).toContain('"gold": 7');
	});

	test("jumps with edited state and reports state the schema refuses", async () => {
		let panel = mount();
		await playLines(unwrap(panel.novel.start()), 1);
		await panel.open("Jump");
		let select = panel.result.$("select[name=scene]") as HTMLSelectElement;
		let editor = panel.result.$("textarea[name=state]") as HTMLTextAreaElement;
		await vi.waitFor(() => expect(editor.value).toContain('"gold": 10'));
		await userEvent.selectOptions(select, "cafe");
		await userEvent.clear(editor);
		await userEvent.fill(editor, '{ "gold": "lots" }');
		await userEvent.click(panel.button("Jump to scene"));
		await vi.waitFor(() =>
			expect(panel.result.$("[role=alert]")?.textContent).toContain("The state is invalid"),
		);
		expect(panel.starts).toEqual([]);
		await userEvent.fill(editor, "not json");
		await userEvent.click(panel.button("Jump to scene"));
		await vi.waitFor(() =>
			expect(panel.result.$("[role=alert]")?.textContent).toContain("not JSON"),
		);
		await userEvent.fill(editor, '{ "gold": 99 }');
		await userEvent.click(panel.button("Jump to scene"));
		await vi.waitFor(() => expect(panel.starts).toHaveLength(1));
		expect(panel.starts[0]).toMatchObject({ scene: SCENES.cafe, state: { gold: 99 } });
		expect(panel.result.$("[role=alert]")).toBeNull();
	});

	test("resets seen lines through a restart", async () => {
		let panel = mount();
		await playLines(unwrap(panel.novel.start()), 2);
		await panel.open("Persistent");
		await vi.waitFor(() =>
			expect(
				(panel.result.$("[aria-label='Persistent data']") as HTMLTextAreaElement).value,
			).toContain("opening:opening.welcome"),
		);
		await userEvent.click(panel.button("Reset seen lines"));
		expect(panel.starts).toHaveLength(1);
		expect((panel.starts[0] as StartOptions).persistent as Persistent).toMatchObject({ seen: {} });
		expect(panel.starts[0]?.from).toMatchObject({ position: { line: "opening.lucky" } });
	});

	test("logs events newest first and clears the log", async () => {
		let panel = mount();
		await playLines(unwrap(panel.novel.start()), 2);
		await panel.open("Events");
		await vi.waitFor(() => {
			let rows = [...panel.result.$$("[aria-label='Event log'] li")];
			expect(rows.map((row) => row.textContent)).toEqual([
				"persist 2 lines seen",
				"line opening:opening.lucky",
				"persist 1 lines seen",
				"line opening:opening.welcome",
				"scene opening",
			]);
		});
		await userEvent.click(panel.button("Clear the log"));
		await vi.waitFor(() => expect(panel.result.$$("[aria-label='Event log'] li")).toHaveLength(0));
	});

	test("draws the scene graph as SVG on request", async () => {
		let panel = mount();
		await panel.open("Flowchart");
		await userEvent.click(panel.button("Draw the scene graph"));
		await vi.waitFor(() => expect(panel.result.$("svg")).not.toBeNull());
		let text = panel.result.$("svg")?.textContent ?? "";
		expect(text).toContain("opening");
		expect(text).toContain("endings.good");
	});

	test("lists the static problems on request", async () => {
		let panel = mount();
		await panel.open("Problems");
		await userEvent.click(panel.button("Run the checks"));
		await vi.waitFor(() =>
			expect(panel.result.$("[aria-label=Problems]")?.textContent).toContain(
				"warning unreachable-scene in orphan",
			),
		);
	});
});
