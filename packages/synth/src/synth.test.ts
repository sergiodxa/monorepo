/**
 * Holds the synthesizer to what a score's author relies on: pitches and chords as written,
 * patterns that repeat and join, renders of the right length that are the same every time,
 * notes at the frequency asked for, effects that leave a tail, and songs a seed writes alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Instrument } from "./instrument.js";
import type { Score } from "./score.js";

import { generateSong, renderSong } from "./generate.js";
import { PRESETS } from "./instrument.js";
import { chord, frequency, noteNumber, scaleChord, scaleNote } from "./pitch.js";
import { seedFrom, seededRandom } from "./random.js";
import { envelopeLevel, renderScore } from "./render.js";
import { chordNotes, concat, pattern, repeat, scoreBeats, shift, transpose } from "./score.js";
import { encodeWav } from "./wav.js";

/** A plain sine with no filter, so a test can count its cycles. */
const SINE: Instrument = {
	oscillators: [{ waveform: "sine" }],
	envelope: { attack: 0.001, decay: 0, sustain: 1, release: 0.01 },
};

/** The loudest sample's magnitude. */
function peak(samples: Float32Array, from = 0, to = samples.length): number {
	let max = 0;
	for (let i = from; i < to; i++) max = Math.max(max, Math.abs(samples[i] ?? 0));
	return max;
}

describe("pitch", () => {
	test("reads note names as MIDI numbers, with sharps, flats and octaves", () => {
		expect(noteNumber("C4")).toBe(60);
		expect(noteNumber("A4")).toBe(69);
		expect(noteNumber("Bb2")).toBe(46);
		expect(noteNumber("F#3")).toBe(54);
		expect(noteNumber(42)).toBe(42);
		expect(() => noteNumber("H2")).toThrow(RangeError);
	});

	test("tunes A4 to 440 Hz in equal temperament", () => {
		expect(frequency("A4")).toBe(440);
		expect(frequency("A5")).toBe(880);
		expect(frequency(60)).toBeCloseTo(261.63, 2);
	});

	test("builds chords by quality and from scale degrees", () => {
		expect(chord("A3", "min7")).toEqual([57, 60, 64, 67]);
		expect(chord("C4")).toEqual([60, 64, 67]);
		expect(scaleNote("C4", "major", 4)).toBe(67);
		expect(scaleNote("C4", "major", 7)).toBe(72);
		expect(scaleNote("C4", "major", -1)).toBe(59);
		expect(scaleChord("C4", "major", 5)).toEqual([69, 72, 76]);
	});
});

describe("score", () => {
	test("repeats, joins, shifts and transposes patterns", () => {
		let beat = pattern([{ at: 0, length: 1, pitch: "C4" }], 2);
		let twice = repeat(beat, 2);
		expect(twice.length).toBe(4);
		expect(twice.notes.map((note) => note.at)).toEqual([0, 2]);
		let joined = concat(beat, pattern([{ at: 0.5, length: 1, pitch: "E4" }]));
		expect(joined.length).toBe(3.5);
		expect(joined.notes.map((note) => note.at)).toEqual([0, 2.5]);
		expect(shift(beat.notes, 4)[0]?.at).toBe(4);
		expect(transpose(beat.notes, 12)[0]?.pitch).toBe(72);
		expect(chordNotes(chord("C3"), 0, 4)).toHaveLength(3);
	});

	test("lasts its own length, or until its last note ends", () => {
		let notes = [{ at: 3, length: 2, pitch: "C4" }];
		expect(scoreBeats({ tempo: 120, tracks: [{ instrument: SINE, notes }] })).toBe(5);
		expect(scoreBeats({ tempo: 120, length: 8, tracks: [{ instrument: SINE, notes }] })).toBe(8);
	});
});

describe("renderScore", () => {
	test("renders a hand-written score to the length its tempo gives, the same every time", () => {
		let score: Score = {
			tempo: 120,
			length: 4,
			tracks: [
				{ instrument: PRESETS.pluck, notes: [{ at: 0, length: 1, pitch: "C4" }] },
				{ instrument: PRESETS.snare, notes: [{ at: 1, length: 0.25, pitch: 38 }] },
			],
			effects: [{ type: "reverb", size: 0.4, mix: 0.2 }],
		};
		let first = renderScore(score, { sampleRate: 8000 });
		expect(first.length).toBe(2 * 8000);
		expect(renderScore(score, { sampleRate: 8000 })).toEqual(first);
		expect(peak(first)).toBeGreaterThan(0.05);
		expect(peak(first)).toBeLessThanOrEqual(1);
	});

	test("plays a note at the frequency its pitch asks for", () => {
		let samples = renderScore(
			{
				tempo: 60,
				length: 1,
				tracks: [{ instrument: SINE, notes: [{ at: 0, length: 1, pitch: "A4" }] }],
			},
			{ sampleRate: 44_100, limit: false },
		);
		let crossings = 0;
		for (let i = 1; i < samples.length; i++) {
			if ((samples[i - 1] ?? 0) < 0 && (samples[i] ?? 0) >= 0) crossings++;
		}
		expect(crossings).toBeGreaterThanOrEqual(438);
		expect(crossings).toBeLessThanOrEqual(441);
	});

	test("is silent with no notes, and louder for a harder note", () => {
		let silent = renderScore({ tempo: 120, length: 2, tracks: [] }, { sampleRate: 8000 });
		expect(peak(silent)).toBe(0);
		let at = (velocity: number) =>
			peak(
				renderScore(
					{
						tempo: 120,
						tracks: [{ instrument: SINE, notes: [{ at: 0, length: 1, pitch: "C4", velocity }] }],
					},
					{ sampleRate: 8000, limit: false },
				),
			);
		expect(at(1)).toBeGreaterThan(at(0.3) * 2);
	});

	test("rings a delay on after the dry note has stopped", () => {
		let render = (effects: Score["effects"]) =>
			renderScore(
				{
					tempo: 120,
					length: 4,
					tracks: [{ instrument: SINE, notes: [{ at: 0, length: 0.25, pitch: "C4" }] }],
					effects,
				},
				{ sampleRate: 8000 },
			);
		let dry = render([]);
		let wet = render([{ type: "delay", time: 1, feedback: 0.5, mix: 0.6 }]);
		expect(peak(dry, 8000, 12000)).toBe(0);
		expect(peak(wet, 4000, 6000)).toBeGreaterThan(0.05);
	});

	test("shapes a note with attack, sustain and release", () => {
		let envelope = { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.2 };
		expect(envelopeLevel(envelope, 1, 0.05)).toBeCloseTo(0.5);
		expect(envelopeLevel(envelope, 1, 0.1)).toBeCloseTo(1);
		expect(envelopeLevel(envelope, 1, 0.5)).toBeCloseTo(0.5);
		expect(envelopeLevel(envelope, 1, 1.1)).toBeCloseTo(0.25);
		expect(envelopeLevel(envelope, 1, 1.3)).toBe(0);
	});
});

describe("encodeWav", () => {
	test("writes 16-bit mono PCM with its sample rate, clipping past full scale", () => {
		let bytes = encodeWav(new Float32Array([0, 1, -1, 2]), 22_050);
		let view = new DataView(bytes.buffer);
		expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
		expect(view.getUint16(22, true)).toBe(1);
		expect(view.getUint32(24, true)).toBe(22_050);
		expect(view.getInt16(46, true)).toBe(0x7fff);
		expect(view.getInt16(48, true)).toBe(-0x8000);
		expect(view.getInt16(50, true)).toBe(0x7fff);
		expect(bytes.length).toBe(44 + 8);
	});
});

describe("generateSong", () => {
	test("writes a score through the same API, the same for the same seed", () => {
		let spec = {
			seed: 11,
			style: "lofi" as const,
			key: "A2",
			mode: "dorian" as const,
			duration: 60,
		};
		let score = generateSong(spec);
		expect(generateSong(spec)).toEqual(score);
		expect(score.tracks.map((track) => track.name)).toEqual(
			expect.arrayContaining(["pad", "bass", "lead", "kick"]),
		);
		expect((score.length ?? 0) * (60 / score.tempo)).toBeCloseTo(60);
		expect(generateSong({ ...spec, seed: 12 })).not.toEqual(score);
	});

	test("leaves the drums out of an ambient song", () => {
		let score = generateSong({ seed: 3, style: "ambient", key: 48, mode: "lydian", duration: 40 });
		expect(score.tracks.some((track) => track.name === "kick")).toBe(false);
	});

	test("renders a song to exactly its duration, inside full scale and not silent", () => {
		let samples = renderSong(
			{ seed: 5, style: "house", key: "F2", mode: "minor", duration: 20 },
			{ sampleRate: 8000 },
		);
		expect(samples.length).toBe(20 * 8000);
		expect(peak(samples)).toBeLessThanOrEqual(1);
		expect(peak(samples)).toBeGreaterThan(0.1);
	});
});

describe("seededRandom", () => {
	test("repeats its sequence for a seed, and turns names into seeds", () => {
		let a = seededRandom(9);
		let b = seededRandom(9);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
		expect(seedFrom("night-drive")).toBe(seedFrom("night-drive"));
		expect(seedFrom("night-drive")).not.toBe(seedFrom("night-ride"));
	});
});
