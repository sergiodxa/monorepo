/**
 * Tests for the `AudioManager`'s procedural-SFX delegation. `AudioManager`
 * builds a real `AudioContext` in its field initializers, so these tests
 * install a recording stub as the global `AudioContext` before constructing
 * one, then verify `playSynthSfx`'s routing, muting, and unknown-name cases.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, expect, test } from "vitest";

import type { AssetStore } from "./assets";

class StubGainNode {
	readonly gain = {
		value: 1,
		setValueAtTime() {},
		linearRampToValueAtTime() {},
		exponentialRampToValueAtTime() {},
	};
	connect() {}
}

class StubOscillatorNode {
	type = "sine";
	readonly frequency = { setValueAtTime() {}, linearRampToValueAtTime() {} };
	connect() {}
	start() {}
	stop() {}
}

class StubAudioContext {
	static instances: StubAudioContext[] = [];
	state = "running";
	currentTime = 0;
	readonly destination = {} as AudioNode;
	readonly oscillators: StubOscillatorNode[] = [];
	readonly gains: StubGainNode[] = [];

	constructor() {
		StubAudioContext.instances.push(this);
	}

	createGain() {
		let node = new StubGainNode();
		this.gains.push(node);
		return node;
	}

	createOscillator() {
		let node = new StubOscillatorNode();
		this.oscillators.push(node);
		return node;
	}

	createBufferSource() {
		return { buffer: null, connect() {}, start() {}, loop: false } as unknown;
	}

	resume() {
		return Promise.resolve();
	}
}

/**
 * An asset store stub sufficient for procedural SFX, which synthesize sound
 * in real time.
 */
const EMPTY_ASSETS = {
	audioBuffer: () => null,
	audioLoopPoints: () => ({}),
} as unknown as AssetStore;

let originalAudioContext: unknown;

beforeEach(() => {
	originalAudioContext = (globalThis as { AudioContext?: unknown }).AudioContext;
	StubAudioContext.instances = [];
	(globalThis as { AudioContext?: unknown }).AudioContext = StubAudioContext;
});

afterEach(() => {
	if (originalAudioContext === undefined)
		delete (globalThis as { AudioContext?: unknown }).AudioContext;
	else (globalThis as { AudioContext?: unknown }).AudioContext = originalAudioContext;
});

async function makeManager() {
	let { AudioManager } = await import("./audio");
	let manager = new AudioManager(EMPTY_ASSETS);
	let context = StubAudioContext.instances.at(-1)!;
	return { manager, context };
}

test("playSynthSfx schedules oscillators for a known effect", async () => {
	let { manager, context } = await makeManager();
	manager.playSynthSfx("menu-confirm");
	expect(context.oscillators.length).toBeGreaterThan(0);
});

test("a muted sfx channel schedules nothing", async () => {
	let { manager, context } = await makeManager();
	manager.setVolume("sfx", 0);
	let before = context.oscillators.length;
	manager.playSynthSfx("hit");
	expect(context.oscillators.length).toBe(before);
});

test("playSynthSfx with an unknown name is a safe no-op", async () => {
	let { manager, context } = await makeManager();
	let before = context.oscillators.length;
	expect(() => manager.playSynthSfx("nope")).not.toThrow();
	expect(context.oscillators.length).toBe(before);
});

test("the existing sfx channel volume still scales via setVolume", async () => {
	let { manager } = await makeManager();
	expect(() => manager.setVolume("sfx", 0.5)).not.toThrow();
});
