/**
 * `LocalStorageStore` against the browser's real `localStorage`: what `read()` hands a player,
 * what `sync()` writes as a player saves, persists and changes settings, and how it keeps the
 * novel playing when storage throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { Handle } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { render } from "remix/component/test";
import * as s from "remix/data-schema";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { GameState } from "../frames.js";

import { createNovel, createScene, scene, scenes } from "../index.js";
import { NovelPlayer } from "../ui/player.js";
import { DEFAULT_SETTINGS } from "../ui/settings.js";

import { LocalStorageStore } from "./local-storage.js";

const MESSAGES = {
	opening: { welcome: "First.", thinking: "Second." },
	endings: { good: "The end" },
};

const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({ opening: scene() });

const OPENING = createScene(SCENES.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.narrate("opening.thinking"),
	ctx.ending("endings.good"),
]);

/** A two-line novel. */
function fixture() {
	let novel = createNovel({ scenes: SCENES, state: STATE, initial: SCENES.opening });
	novel.map(SCENES.opening, OPENING);
	return novel;
}

/** The player's context, captured by {@link Probe} for a test to drive the play. */
let player: NovelPlayer.Context | undefined;

/** Captures the player's context. */
function Probe(handle: Handle) {
	player = handle.context.get(NovelPlayer);
	return () => null;
}

let mounted: RenderResult | undefined;

beforeEach(() => localStorage.clear());

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	player = undefined;
	localStorage.clear();
	vi.restoreAllMocks();
});

/** Mounts a player over what `store` reads, synced back through `store.sync()`. */
function mount(store: LocalStorageStore) {
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });
	let container = document.createElement("div");
	container.style.width = "960px";
	container.style.height = "540px";
	document.body.append(container);
	mounted = render(
		<IntlProvider intl={intl}>
			<NovelPlayer.Default novel={fixture()} {...store.read()} mix={store.sync()}>
				<Probe />
			</NovelPlayer.Default>
		</IntlProvider>,
		{ container },
	);
	return mounted;
}

/** Waits until the player shows `text`. */
async function shows(result: RenderResult, text: string): Promise<void> {
	await vi.waitFor(() => expect(result.$("[data-novel-line]")?.textContent).toBe(text), {
		timeout: 5000,
	});
}

describe("LocalStorageStore", () => {
	test("reads nothing stored as no saves, default settings and a first playthrough", () => {
		expect(new LocalStorageStore().read()).toEqual({
			saves: {},
			settings: undefined,
			start: { persistent: undefined },
		});
	});

	test("reads what is stored under its prefix, skipping unreadable entries", () => {
		let save = { meta: { scene: "opening", savedAt: "2026-01-01T00:00:00.000Z", playTime: 0 } };
		localStorage.setItem("cafe:saves", JSON.stringify({ quick: save, broken: 3 }));
		localStorage.setItem("cafe:settings", JSON.stringify({ textSpeed: 0 }));
		localStorage.setItem("cafe:persistent", "{not json");
		localStorage.setItem("novel:settings", JSON.stringify({ textSpeed: 99 }));
		expect(new LocalStorageStore({ prefix: "cafe" }).read()).toEqual({
			saves: { quick: save },
			settings: { textSpeed: 0 },
			start: { persistent: undefined },
		});
	});

	test("reads nothing and keeps playing when storage throws", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new DOMException("blocked", "SecurityError");
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("full", "QuotaExceededError");
		});
		let store = new LocalStorageStore();
		expect(store.read().saves).toEqual({});
		expect(store.putSettings(DEFAULT_SETTINGS)).toBe(false);
		expect(store.clear()).toBe(true);
	});

	test("keeps each save beside the ones stored before it", () => {
		let store = new LocalStorageStore();
		let first = { meta: { scene: "a", savedAt: "2026-01-01T00:00:00.000Z", playTime: 0 } };
		let second = { meta: { scene: "b", savedAt: "2026-01-02T00:00:00.000Z", playTime: 0 } };
		expect(store.putSave("1", first as unknown as GameState)).toBe(true);
		store.putSave("2", second as unknown as GameState);
		expect(Object.keys(store.read().saves)).toEqual(["1", "2"]);
		store.clear();
		expect(localStorage.length).toBe(0);
	});

	test("syncs saves, settings and lines read as the player plays, and hands them back", async () => {
		let store = new LocalStorageStore({ prefix: "cafe" });
		store.putSettings({ textSpeed: 0 });
		let first = mount(store);
		await shows(first, "First.");
		player!.advance();
		await shows(first, "Second.");
		player!.save("quick");
		player!.setSettings({ ...DEFAULT_SETTINGS, textSpeed: 0, fontSize: 1.5 });
		let stored = store.read();
		expect(stored.saves["quick"]?.position).toEqual({ scene: "opening", line: "opening.thinking" });
		expect(stored.settings?.fontSize).toBe(1.5);
		expect(Object.keys((stored.start.persistent as { seen: object }).seen)).toContain(
			"opening:opening.welcome",
		);
		first.cleanup();

		let second = mount(store);
		await shows(second, "First.");
		expect(player!.settings.value.fontSize).toBe(1.5);
		await player!.load("quick");
		await shows(second, "Second.");
		expect(player!.read.current).toBe(true);
	});
});
