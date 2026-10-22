// @vitest-environment happy-dom

/**
 * Tests for {@link "./live-frame"} against a real frame runtime: typing reloads the frame
 * once it pauses, a reload request skips the pause, and only the newest value settles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppRuntime, Handle } from "remix/component";

import { clientEntry, Frame, run } from "remix/component";
import { renderToStream, renderToString } from "remix/component/server";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import type { LiveFrame } from "./live-frame.js";

import { LIVE_FRAME_RELOAD_EVENT, liveFrame } from "./live-frame.js";

let app: AppRuntime | undefined;

/** Every address the frame was asked to load, oldest first. */
let requested: Array<string> = [];

/** Answers that wait until the test releases them, keyed by address. */
let held = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();

afterEach(() => {
	app?.dispose();
	app = undefined;
	document.body.innerHTML = "";
	requested = [];
	held.clear();
	vi.useRealTimers();
});

/** The frame address for a value. */
function src(value: string): string {
	return `/frames/search?q=${value}`;
}

/** The options the island under test applies, set per test before it hydrates. */
let applied: Partial<LiveFrame.Options> = {};

/** The island under test: a box in the frame it reloads, as a page ships it to the browser. */
const ISLAND = clientEntry(
	"/live-frame-island.tsx#LiveFrameIsland",
	function LiveFrameIsland(_handle: Handle<Record<string, never>>) {
		return () => <input name="q" mix={[liveFrame({ src, ...applied })]} />;
	},
);

/**
 * Hydrates the island inside a frame that records each address and answers with the same
 * island, so the box survives every reload the way it does on a page.
 */
async function mount(options: Partial<LiveFrame.Options> = {}): Promise<{
	box: HTMLInputElement;
	states: Array<string>;
}> {
	applied = options;
	document.body.innerHTML = await new Response(
		renderToStream(<Frame src={src("")} />, { resolveFrame: () => renderToString(<ISLAND />) }),
	).text();
	app = run({
		loadModule: () => ISLAND,
		resolveFrame: async (address) => {
			requested.push(address);
			await held.get(address)?.promise;
			return renderToString(<ISLAND />);
		},
	});
	await app.ready();
	let box = document.querySelector("input") as HTMLInputElement;
	let states: Array<string> = [];
	box.addEventListener("ui:live-frame", (event) => states.push(`${event.state} ${event.src}`));
	return { box, states };
}

/** Types `value` into `box` the way a reader would. */
function type(box: HTMLInputElement, value: string): void {
	box.value = value;
	box.dispatchEvent(new Event("input", { bubbles: true }));
}

describe(liveFrame.name, () => {
	test("reloads the frame for the value once typing pauses", async () => {
		vi.useFakeTimers();
		let { box, states } = await mount();

		type(box, "re");
		type(box, "remix");
		expect(requested).toEqual([]);

		await vi.advanceTimersByTimeAsync(200);
		expect(requested).toEqual([src("remix")]);
		expect(states.at(-1)).toBe(`settled ${src("remix")}`);
	});

	test("reloads at once on a reload request", async () => {
		let { box, states } = await mount();

		box.value = "dialog";
		box.dispatchEvent(new Event(LIVE_FRAME_RELOAD_EVENT));

		await vi.waitFor(() => expect(states.at(-1)).toBe(`settled ${src("dialog")}`));
		expect(requested).toEqual([src("dialog")]);
		expect(states.map((state) => state.split(" ")[0])).toEqual(["pending", "loading", "settled"]);
	});

	test("calls a wait slow once it outlasts slowAfter", async () => {
		vi.useFakeTimers();
		let { box, states } = await mount({ debounce: 500, slowAfter: 100 });

		type(box, "remix");
		await vi.advanceTimersByTimeAsync(100);

		expect(states.map((state) => state.split(" ")[0])).toEqual(["pending", "slow"]);
	});

	test("settles only the newest value when typing outruns a reload", async () => {
		vi.useFakeTimers();
		let { box, states } = await mount();
		let first = Promise.withResolvers<void>();
		held.set(src("re"), first);

		type(box, "re");
		await vi.advanceTimersByTimeAsync(200);
		type(box, "remix");
		first.resolve();
		await vi.advanceTimersByTimeAsync(200);

		expect(requested).toEqual([src("re"), src("remix")]);
		expect(states.filter((state) => state.startsWith("settled"))).toEqual([
			`settled ${src("remix")}`,
		]);
	});
});
