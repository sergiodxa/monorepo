/**
 * Holds the Web Audio mixer to its contract in a real browser: music crossfades on a change and
 * keeps playing when it does not, ambience layers, a sound occurrence plays once however often
 * a frame is reconciled, a voice ends and lowers the music while it speaks, and volumes apply.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Audio } from "../stage.js";

import { AudioMixer } from "./audio.js";
import { DEFAULT_SETTINGS } from "./settings.js";

let mixer: AudioMixer | undefined;

afterEach(() => {
	mixer?.dispose();
	mixer = undefined;
});

/**
 * A silent mono WAV file of `ms` milliseconds as a blob URL, so buffers decode without a server.
 *
 * @param ms - The file's length.
 * @returns The file's URL.
 */
function wav(ms: number): string {
	let rate = 8000;
	let samples = Math.round((rate * ms) / 1000);
	let buffer = new ArrayBuffer(44 + samples * 2);
	let view = new DataView(buffer);
	let text = (offset: number, value: string) => {
		for (let index = 0; index < value.length; index++) {
			view.setUint8(offset + index, value.charCodeAt(index));
		}
	};
	text(0, "RIFF");
	view.setUint32(4, 36 + samples * 2, true);
	text(8, "WAVE");
	text(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, rate, true);
	view.setUint32(28, rate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	text(36, "data");
	view.setUint32(40, samples * 2, true);
	return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

/** Audio with nothing playing, plus `patch`. */
function audio(patch: Partial<Audio> = {}): Audio {
	return { music: null, ambience: [], sounds: [], voice: null, ...patch };
}

/** A mixer at the default volumes whose context runs, resumed after a click as a page must. */
async function running(): Promise<AudioMixer> {
	await userEvent.click(document.body);
	mixer = new AudioMixer(DEFAULT_SETTINGS.volume);
	await mixer.resume();
	return mixer;
}

describe(AudioMixer, () => {
	test("starts music once and crossfades to a new track", async () => {
		let mix = await running();
		let chill = wav(400);
		mix.reconcile(audio({ music: { id: "music.chill", src: chill } }), "en");
		mix.reconcile(audio({ music: { id: "music.chill", src: chill } }), "en");
		expect(mix.snapshot.music).toBe("music.chill");
		mix.reconcile(audio({ music: { id: "music.tense", src: wav(400), fade: 50 } }), "en");
		expect(mix.snapshot.music).toBe("music.tense");
		mix.reconcile(audio(), "en");
		expect(mix.snapshot.music).toBeNull();
	});

	test("layers ambience and drops a loop the frame no longer has", async () => {
		let mix = await running();
		let rain = { id: "ambience.rain", src: wav(400) };
		let wind = { id: "ambience.wind", src: wav(400) };
		mix.reconcile(audio({ ambience: [rain] }), "en");
		mix.reconcile(audio({ ambience: [rain, wind] }), "en");
		expect(mix.snapshot.ambience).toEqual(["ambience.rain", "ambience.wind"]);
		mix.reconcile(audio({ ambience: [wind] }), "en");
		expect(mix.snapshot.ambience).toEqual(["ambience.wind"]);
	});

	test("plays each sound occurrence once, even when a frame is reconciled again", async () => {
		let mix = await running();
		let door = { id: "sounds.door", src: wav(50), occurrence: "door-1" };
		mix.reconcile(audio({ sounds: [door] }), "en");
		mix.reconcile(audio({ sounds: [door] }), "en");
		mix.reconcile(audio({ sounds: [door, { ...door, occurrence: "door-2" }] }), "en", true);
		expect(mix.snapshot.sounds).toEqual(["door-1", "door-2"]);
	});

	test("ends a voice, lowering the music while it speaks", async () => {
		let mix = await running();
		mix.reconcile(audio({ music: { id: "music.chill", src: wav(1000) } }), "en");
		let voice = wav(400);
		let ended = mix.playVoice(voice);
		await vi.waitFor(() => expect(mix.snapshot.voice).toBe(voice));
		await vi.waitFor(() => expect(mix.snapshot.duck).toBeLessThan(0.5));
		await ended;
		expect(mix.snapshot.voice).toBeNull();
		await vi.waitFor(() => expect(mix.snapshot.duck).toBeGreaterThan(0.95));
	});

	test("stops a voice early when the line is advanced", async () => {
		let mix = await running();
		let ended = mix.playVoice(wav(5000));
		await vi.waitFor(() => expect(mix.snapshot.voice).not.toBeNull());
		mix.stopVoice();
		await ended;
		expect(mix.snapshot.voice).toBeNull();
	});

	test("settles at once for a voice file that fails to load", async () => {
		let mix = await running();
		await mix.playVoice("/missing-voice.ogg");
		expect(mix.snapshot.voice).toBeNull();
	});

	test("applies master and channel volumes", async () => {
		let mix = await running();
		mix.setVolume({ master: 0.5, music: 0.25, ambience: 1, sound: 0, voice: 0.75 });
		expect(mix.snapshot.volume).toEqual({
			master: 0.5,
			music: 0.25,
			ambience: 1,
			sound: 0,
			voice: 0.75,
		});
	});
});
