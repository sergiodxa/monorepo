/**
 * Tests for the ready-made interface sounds: every preset renders short, quiet WAV files the
 * player's `sounds` prop takes, and importing the entry renders nothing, so a server or Worker
 * importing it pays no synthesis.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, expectTypeOf, test, vi } from "vitest";

import type { InterfaceSoundPresetName } from "./sounds.js";
import type { InterfaceSounds } from "./ui.js";

import { INTERFACE_SOUND_PRESETS, renderInterfaceSounds } from "./sounds.js";

/** What a test reads from a WAV header and its samples. */
interface WavFacts {
	riff: string;
	sampleRate: number;
	seconds: number;
	peak: number;
}

/** Reads the header and loudest sample of a 16-bit mono WAV Blob. */
async function readWav(blob: Blob): Promise<WavFacts> {
	let view = new DataView(await blob.arrayBuffer());
	let riff = String.fromCharCode(...new Uint8Array(view.buffer, 0, 4));
	let sampleRate = view.getUint32(24, true);
	let samples = view.getUint32(40, true) / 2;
	let peak = 0;
	for (let i = 0; i < samples; i++) {
		peak = Math.max(peak, Math.abs(view.getInt16(44 + i * 2, true)) / 32_768);
	}
	return { riff, sampleRate, seconds: samples / sampleRate, peak };
}

describe("renderInterfaceSounds", () => {
	for (let name of Object.keys(INTERFACE_SOUND_PRESETS) as InterfaceSoundPresetName[]) {
		test(`the ${name} preset renders short, quiet WAV sounds`, async () => {
			let sounds = renderInterfaceSounds(name);
			for (let sound of [sounds.hover, sounds.select]) {
				expect(sound.kind).toBe("sound");
				expect(sound.src).toBeInstanceOf(Blob);
				let blob = sound.src as Blob;
				expect(blob.type).toBe("audio/wav");
				let wav = await readWav(blob);
				expect(wav.riff).toBe("RIFF");
				expect(wav.sampleRate).toBe(22_050);
				expect(wav.seconds).toBeGreaterThan(0);
				expect(wav.seconds).toBeLessThan(0.25);
				expect(wav.peak).toBeGreaterThan(0.01);
				expect(wav.peak).toBeLessThan(0.5);
			}
		});
	}

	test("renders the soft preset by default, once per preset", () => {
		let first = renderInterfaceSounds();
		expect(renderInterfaceSounds("soft")).toBe(first);
		expect(renderInterfaceSounds("tick")).not.toBe(first);
	});

	test("renders a preset of the caller's own", async () => {
		let preset = {
			...INTERFACE_SOUND_PRESETS.soft,
			hover: { ...INTERFACE_SOUND_PRESETS.soft.hover, tail: 0.02 },
		};
		let sounds = renderInterfaceSounds(preset);
		let hover = await readWav(sounds.hover.src as Blob);
		let soft = await readWav(renderInterfaceSounds("soft").hover.src as Blob);
		expect(hover.seconds).toBeLessThan(soft.seconds);
	});

	test("the result fits the player's sounds prop", () => {
		expectTypeOf(renderInterfaceSounds("chime")).toExtend<InterfaceSounds>();
	});
});

describe("importing the entry", () => {
	test("renders nothing until a preset is asked for", async () => {
		vi.resetModules();
		let renderScore = vi.fn();
		vi.doMock("@sdxc/synth", async (importOriginal) => {
			let actual = await importOriginal<typeof import("@sdxc/synth")>();
			renderScore.mockImplementation(actual.renderScore);
			return { ...actual, renderScore };
		});
		let entry = await import("./sounds.js");
		expect(renderScore).not.toHaveBeenCalled();
		entry.renderInterfaceSounds("tick");
		expect(renderScore).toHaveBeenCalledTimes(2);
		vi.doUnmock("@sdxc/synth");
	});
});
