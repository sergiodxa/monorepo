// @vitest-environment happy-dom

/**
 * Tests for {@link "./frame-refresh"} against a real frame runtime: the frame reloads on its
 * schedule and on its event, one reload at a time, rests while the page is hidden, and stops
 * for good once the stop condition holds or the host goes away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppRuntime, Handle } from "remix/component";

import { clientEntry, Frame, run } from "remix/component";
import { renderToStream, renderToString } from "remix/component/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { FrameRefresh } from "./frame-refresh.js";

import { frameRefresh } from "./frame-refresh.js";

/** The event the island's host reloads on. */
const REFRESH_EVENT = "test:refresh";

let app: AppRuntime | undefined;

/** How many times the frame asked for its content after hydrating. */
let reloads = 0;

/** An answer that waits until the test releases it. */
let held: ReturnType<typeof Promise.withResolvers<void>> | undefined;

/** Whether the page reports itself hidden. */
let hidden = false;

/** The options the island under test applies, set per test before it hydrates. */
let applied: FrameRefresh.Options = {};

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
});

afterEach(() => {
	app?.dispose();
	app = undefined;
	document.body.innerHTML = "";
	reloads = 0;
	held = undefined;
	hidden = false;
	applied = {};
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** The island under test: a panel that keeps its frame current. */
const ISLAND = clientEntry(
	"/frame-refresh-island.tsx#FrameRefreshIsland",
	function FrameRefreshIsland(_handle: Handle<Record<string, never>>) {
		return () => <section mix={[frameRefresh(applied)]} />;
	},
);

/** Hydrates the island inside a frame that counts each reload and answers with the island. */
async function mount(options: FrameRefresh.Options): Promise<HTMLElement> {
	applied = options;
	document.body.innerHTML = await new Response(
		renderToStream(<Frame src="/frames/status" />, {
			resolveFrame: () => renderToString(<ISLAND />),
		}),
	).text();
	app = run({
		loadModule: () => ISLAND,
		resolveFrame: async () => {
			reloads++;
			await held?.promise;
			return renderToString(<ISLAND />);
		},
	});
	await app.ready();
	return document.querySelector("section") as HTMLElement;
}

/** Flips the page's visibility the way switching tabs does. */
function setHidden(value: boolean): void {
	hidden = value;
	document.dispatchEvent(new Event("visibilitychange"));
}

describe(frameRefresh.name, () => {
	test("reloads the frame on its schedule", async () => {
		await mount({ every: 1000 });

		await vi.advanceTimersByTimeAsync(999);
		expect(reloads).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(reloads).toBe(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(reloads).toBe(2);
	});

	test("reloads the frame when its event reaches the host", async () => {
		let host = await mount({ on: REFRESH_EVENT });

		host.dispatchEvent(new Event(REFRESH_EVENT));
		await vi.advanceTimersByTimeAsync(0);

		expect(reloads).toBe(1);
	});

	test("runs one reload at a time and queues one more for events during it", async () => {
		let host = await mount({ on: REFRESH_EVENT });
		held = Promise.withResolvers<void>();

		host.dispatchEvent(new Event(REFRESH_EVENT));
		await vi.advanceTimersByTimeAsync(0);
		host.dispatchEvent(new Event(REFRESH_EVENT));
		host.dispatchEvent(new Event(REFRESH_EVENT));
		await vi.advanceTimersByTimeAsync(0);
		expect(reloads).toBe(1);

		held.resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(reloads).toBe(2);
	});

	test("rests while the page is hidden and reloads once it is shown", async () => {
		await mount({ every: 1000 });

		setHidden(true);
		await vi.advanceTimersByTimeAsync(5000);
		expect(reloads).toBe(0);

		setHidden(false);
		await vi.advanceTimersByTimeAsync(0);
		expect(reloads).toBe(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(reloads).toBe(2);
	});

	test("stops once the stop condition holds", async () => {
		let done = false;
		await mount({ every: 1000, until: () => done });

		await vi.advanceTimersByTimeAsync(1000);
		expect(reloads).toBe(1);

		done = true;
		await vi.advanceTimersByTimeAsync(5000);
		expect(reloads).toBe(1);
	});

	test("stops once the host goes away", async () => {
		await mount({ every: 1000 });

		app?.dispose();
		app = undefined;
		await vi.advanceTimersByTimeAsync(5000);

		expect(reloads).toBe(0);
	});
});
