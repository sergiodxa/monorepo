/**
 * Tests for the procedural sound-effect synth.
 *
 * Verifies the SFX definitions are well-formed and that `playSfx` is a safe
 * no-op for unknown names and missing `AudioContext`s. A stub context records
 * scheduled oscillators and gains for asserting on real effects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { SfxName } from "./sfx";

import { isAudioSupported, playSfx, SFX_DEFINITIONS } from "./sfx";

/** Records a scheduled oscillator's parameters for later assertions. */
interface RecordedOscillator {
	type: string;
	started: boolean;
	stopped: boolean;
	frequencySetCalls: number;
	frequencyRampCalls: number;
	connected: boolean;
}

/** A stub `AudioContext` that records the nodes it creates, standing in for real playback. */
class StubAudioContext {
	currentTime = 0;
	readonly destination = { kind: "destination" } as unknown as AudioNode;
	readonly oscillators: RecordedOscillator[] = [];
	readonly gains: unknown[] = [];

	createOscillator() {
		let record: RecordedOscillator = {
			type: "sine",
			started: false,
			stopped: false,
			frequencySetCalls: 0,
			frequencyRampCalls: 0,
			connected: false,
		};
		this.oscillators.push(record);
		return {
			set type(value: string) {
				record.type = value;
			},
			get type() {
				return record.type;
			},
			frequency: {
				setValueAtTime: () => {
					record.frequencySetCalls++;
				},
				linearRampToValueAtTime: () => {
					record.frequencyRampCalls++;
				},
			},
			connect: () => {
				record.connected = true;
			},
			start: () => {
				record.started = true;
			},
			stop: () => {
				record.stopped = true;
			},
		};
	}

	createGain() {
		let node = {
			gain: {
				setValueAtTime: () => {},
				linearRampToValueAtTime: () => {},
				exponentialRampToValueAtTime: () => {},
			},
			connect: () => {},
		};
		this.gains.push(node);
		return node;
	}
}

/** Casts a stub to the real type so it can be passed as an `AudioContext`. */
function asContext(stub: StubAudioContext): AudioContext {
	return stub as unknown as AudioContext;
}

/** The full set of effect names the game is expected to define. */
const EXPECTED_NAMES: SfxName[] = [
	"menu-move",
	"menu-confirm",
	"menu-cancel",
	"hit",
	"faint",
	"heal",
	"level-up",
	"encounter",
];

test("defines every expected effect name", () => {
	for (let name of EXPECTED_NAMES) {
		expect(SFX_DEFINITIONS[name]).toBeDefined();
		expect(SFX_DEFINITIONS[name].length).toBeGreaterThan(0);
	}
});

test("every layer has sane durations, gains, and positive frequencies", () => {
	for (let definition of Object.values(SFX_DEFINITIONS)) {
		for (let layer of definition) {
			expect(["sine", "square", "sawtooth", "triangle"]).toContain(layer.type);

			expect(layer.duration).toBeGreaterThan(0);
			expect(layer.duration).toBeLessThanOrEqual(2);

			expect(layer.gain).toBeGreaterThan(0);
			expect(layer.gain).toBeLessThanOrEqual(1);

			if (layer.delay !== undefined) {
				expect(layer.delay).toBeGreaterThanOrEqual(0);
				expect(layer.delay).toBeLessThanOrEqual(2);
			}

			expect(layer.envelope.length).toBeGreaterThan(0);
			for (let [offset, frequency] of layer.envelope) {
				expect(offset).toBeGreaterThanOrEqual(0);
				expect(frequency).toBeGreaterThan(0);
			}
		}
	}
});

test("playSfx with an unknown name is a safe no-op", () => {
	let stub = new StubAudioContext();
	expect(() => playSfx("does-not-exist", { context: asContext(stub) })).not.toThrow();
	expect(stub.oscillators.length).toBe(0);
});

test("playSfx without a context no-ops without throwing", () => {
	expect(() => playSfx("hit")).not.toThrow();
});

test("playSfx schedules the expected oscillators for a known effect", () => {
	let stub = new StubAudioContext();
	playSfx("menu-confirm", { context: asContext(stub) });

	expect(stub.oscillators.length).toBe(SFX_DEFINITIONS["menu-confirm"].length);
	for (let oscillator of stub.oscillators) {
		expect(oscillator.started).toBe(true);
		expect(oscillator.stopped).toBe(true);
		expect(oscillator.connected).toBe(true);
		expect(oscillator.type).toBe("square");
		expect(oscillator.frequencySetCalls).toBeGreaterThan(0);
	}
});

test("playSfx schedules a frequency ramp for a swept effect", () => {
	let stub = new StubAudioContext();
	playSfx("faint", { context: asContext(stub) });

	expect(stub.oscillators.length).toBe(1);
	expect(stub.oscillators[0]!.frequencyRampCalls).toBeGreaterThan(0);
});

test("playSfx with zero gain schedules nothing", () => {
	let stub = new StubAudioContext();
	playSfx("hit", { context: asContext(stub), gain: 0 });
	expect(stub.oscillators.length).toBe(0);
});

test("playSfx never throws when the context throws during scheduling", () => {
	let throwing = {
		currentTime: 0,
		destination: {} as AudioNode,
		createOscillator() {
			throw new Error("context closed");
		},
		createGain() {
			throw new Error("context closed");
		},
	};
	expect(() => playSfx("hit", { context: throwing as unknown as AudioContext })).not.toThrow();
});

test("isAudioSupported reflects the presence of a global AudioContext", () => {
	let original = (globalThis as { AudioContext?: unknown }).AudioContext;

	(globalThis as { AudioContext?: unknown }).AudioContext = undefined;
	expect(isAudioSupported()).toBe(false);

	(globalThis as { AudioContext?: unknown }).AudioContext = class {};
	expect(isAudioSupported()).toBe(true);

	if (original === undefined) delete (globalThis as { AudioContext?: unknown }).AudioContext;
	else (globalThis as { AudioContext?: unknown }).AudioContext = original;
});
