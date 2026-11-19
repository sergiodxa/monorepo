/**
 * Renders a score to mono PCM samples: every note of every track becomes a voice (its
 * oscillators, envelope, filter and sweep), each track runs its effects, the mix runs the
 * score's, and a soft limiter keeps it inside full scale. The same score gives the same samples.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Envelope, Filter, Instrument, Waveform } from "./instrument.js";
import type { Note, Score, Track } from "./score.js";

import { applyEffects } from "./effects.js";
import { frequency, noteNumber } from "./pitch.js";
import { seededRandom } from "./random.js";
import { beatSeconds, scoreBeats } from "./score.js";

/** The sample rate a render uses when none is given: CD quality. */
export const DEFAULT_SAMPLE_RATE = 44_100;

/** The length of each wavetable; a power of two so a phase wraps with a mask. */
const TABLE_SIZE = 2048;

/** Samples between updates of a voice's envelope target, sweep and filter, which glide between them. */
const CONTROL_RATE = 32;

/** How many harmonics the saw, square and triangle tables sum, enough for warmth without harshness. */
const HARMONICS = 24;

/** Options for {@link renderScore}. */
export interface RenderOptions {
	/** Samples per second. Default: {@link DEFAULT_SAMPLE_RATE}. */
	sampleRate?: number;
	/**
	 * Seconds kept after the score's last beat for releases and echoes to ring out. Default:
	 * none when the score sets `length`, else the longest release among its instruments.
	 */
	tail?: number;
	/** Rounds peaks with a soft limiter so the result never clips. Default: `true`. */
	limit?: boolean;
}

/** A triangle's harmonics: odd only, falling with their square and alternating in sign. */
function triangleHarmonic(n: number): number {
	if (n % 2 === 0) return 0;
	return ((n - 1) / 2) % 2 === 0 ? 1 / (n * n) : -1 / (n * n);
}

/** One cycle of each periodic waveform, built the first time a render asks for it. */
let tables: Record<Exclude<Waveform, "noise">, Float32Array> | undefined;

/** The wavetables, summed from harmonics so they stay smooth at high pitches. */
function wavetables(): Record<Exclude<Waveform, "noise">, Float32Array> {
	if (tables !== undefined) return tables;
	let build = (harmonic: (n: number) => number) => {
		let table = new Float32Array(TABLE_SIZE);
		for (let i = 0; i < TABLE_SIZE; i++) {
			let value = 0;
			for (let n = 1; n <= HARMONICS; n++)
				value += harmonic(n) * Math.sin((2 * Math.PI * n * i) / TABLE_SIZE);
			table[i] = value;
		}
		let peak = table.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
		for (let i = 0; i < TABLE_SIZE; i++) table[i] = (table[i] ?? 0) / peak;
		return table;
	};
	tables = {
		sine: build((n) => (n === 1 ? 1 : 0)),
		saw: build((n) => 1 / n),
		square: build((n) => (n % 2 === 1 ? 1 / n : 0)),
		triangle: build(triangleHarmonic),
	};
	return tables;
}

/**
 * The envelope's level at a time into a note held for `held` seconds: attack, decay to the
 * sustain level, then a straight release from wherever it was when the note ended.
 */
export function envelopeLevel(envelope: Envelope, held: number, time: number): number {
	if (time < held) return heldLevel(envelope, time);
	let released = (time - held) / Math.max(envelope.release, 1e-6);
	return released >= 1 ? 0 : heldLevel(envelope, held) * (1 - released);
}

/** The envelope's level while the note is still held: the attack, then the decay to sustain. */
function heldLevel(envelope: Envelope, time: number): number {
	if (time < envelope.attack) return time / Math.max(envelope.attack, 1e-6);
	let decayed = (time - envelope.attack) / Math.max(envelope.decay, 1e-6);
	return decayed >= 1 ? envelope.sustain : 1 - (1 - envelope.sustain) * decayed;
}

/** No filter on a voice. */
const FILTER_NONE = 0;

/** Each filter type as a small integer the voice loop branches on. */
const FILTER_MODES: Record<Filter["type"], number> = { lowpass: 1, highpass: 2, bandpass: 3 };

/** The voice loop's code for an instrument's filter. */
function filterMode(filter: Filter | undefined): number {
	return filter === undefined ? FILTER_NONE : FILTER_MODES[filter.type];
}

/** Picks a state-variable filter's output for its mode. */
function filterOutput(mode: number, low: number, band: number, high: number): number {
	if (mode === 2) return high;
	return mode === 3 ? band : low;
}

/**
 * The state-variable filter's frequency coefficient for a cutoff, held below a sixth of the
 * sample rate, where this filter stays stable at any resonance.
 */
function filterCoefficient(cutoff: number, sampleRate: number): number {
	let limited = Math.min(Math.max(cutoff, 20), sampleRate / 6);
	return 2 * Math.sin((Math.PI * limited) / sampleRate);
}

/** What a voice needs that is the same for every note of its track. */
interface VoiceContext {
	instrument: Instrument;
	sampleRate: number;
	beat: number;
	gain: number;
	random: () => number;
}

/** Adds one note into a track's buffer. */
function addNote(buffer: Float32Array, note: Note, context: VoiceContext) {
	let { beat, instrument, random, sampleRate } = context;
	let held = note.length * beat;
	let release = instrument.envelope.release;
	let start = Math.round(note.at * beat * sampleRate);
	let end = Math.min(buffer.length, start + Math.ceil((held + release) * sampleRate));
	let pitch = instrument.fixedPitch ?? noteNumber(note.pitch);
	let base = frequency(pitch);
	let level = (note.velocity ?? 0.8) * (instrument.gain ?? 1) * context.gain;
	let oscillators = instrument.oscillators;
	let count = oscillators.length;
	let mixGain =
		1 /
		Math.max(
			1,
			oscillators.reduce((sum, oscillator) => sum + (oscillator.gain ?? 1), 0),
		);
	let table = wavetables();
	let waves: Float32Array[] = oscillators.map((oscillator) =>
		oscillator.waveform === "noise" ? table.sine : table[oscillator.waveform],
	);
	let noise = Uint8Array.from(oscillators, (oscillator) =>
		oscillator.waveform === "noise" ? 1 : 0,
	);
	let gains = Float64Array.from(oscillators, (oscillator) => (oscillator.gain ?? 1) * mixGain);
	let phases = Float64Array.from(oscillators, (_, index) => (index * TABLE_SIZE) / 3);
	let steps = Float64Array.from(
		oscillators,
		(oscillator) =>
			(base * 2 ** ((oscillator.octave ?? 0) + (oscillator.detune ?? 0) / 1200) * TABLE_SIZE) /
			sampleRate,
	);
	let filter = instrument.filter;
	let damping = 1.41 * (1 - Math.min(1, filter?.resonance ?? 0) * 0.9);
	let tracking = filter === undefined ? 0 : (filter.tracking ?? 0) * ((pitch - 60) / 12);
	let mode = filterMode(filter);
	let sweep = instrument.sweep;
	let mask = TABLE_SIZE - 1;
	let low = 0;
	let band = 0;
	let first = Math.max(0, start);
	for (let block = first; block < end; block += CONTROL_RATE) {
		let stop = Math.min(end, block + CONTROL_RATE);
		let time = (block - start) / sampleRate;
		let envelope = envelopeLevel(instrument.envelope, held, time);
		let slope =
			(envelopeLevel(instrument.envelope, held, time + CONTROL_RATE / sampleRate) - envelope) /
			CONTROL_RATE;
		let bend =
			sweep === undefined
				? 1
				: 2 ** ((sweep.from * Math.exp(-time / Math.max(sweep.time, 1e-6))) / 12);
		let f =
			filter === undefined
				? 0
				: filterCoefficient(
						filter.cutoff + tracking + (filter.envelope ?? 0) * envelope,
						sampleRate,
					);
		for (let i = block; i < stop; i++) {
			let sample = 0;
			for (let k = 0; k < count; k++) {
				let phase = phases[k] as number;
				let value =
					noise[k] === 1 ? random() * 2 - 1 : ((waves[k] as Float32Array)[phase & mask] as number);
				sample += value * (gains[k] as number);
				phase += (steps[k] as number) * bend;
				phases[k] = phase >= TABLE_SIZE ? phase - TABLE_SIZE : phase;
			}
			if (mode !== FILTER_NONE) {
				low += f * band;
				let high = sample - low - damping * band;
				band += f * high;
				sample = filterOutput(mode, low, band, high);
			}
			buffer[i] = (buffer[i] as number) + sample * envelope * level;
			envelope += slope;
		}
	}
}

/** The longest release among a score's instruments, the time its last notes need to fade. */
function longestRelease(score: Score): number {
	return Math.max(0, ...score.tracks.map((track) => track.instrument.envelope.release));
}

/**
 * Renders one track's notes into `target`: straight into the mix for a track without effects,
 * or into its own buffer that runs its effects before it is added, so only tracks with effects
 * cost a buffer of their own.
 */
function renderTrack(
	track: Track,
	index: number,
	score: Score,
	sampleRate: number,
	target: Float32Array,
) {
	let effects = track.effects ?? [];
	let beat = beatSeconds(score.tempo);
	let buffer = effects.length === 0 ? target : new Float32Array(target.length);
	let random = seededRandom(((score.seed ?? 1) * 7919 + index * 104729) | 0);
	let context: VoiceContext = {
		instrument: track.instrument,
		sampleRate,
		beat,
		gain: track.gain ?? 1,
		random,
	};
	for (let note of track.notes) addNote(buffer, note, context);
	if (buffer === target) return;
	applyEffects(buffer, effects, { sampleRate, beat });
	for (let i = 0; i < target.length; i++) target[i] = (target[i] as number) + (buffer[i] as number);
}

/**
 * Renders a score to mono samples between -1 and 1.
 *
 * @param score The music.
 * @param options The sample rate, the tail and the limiter.
 * @returns `(beats × seconds per beat + tail) × sampleRate` samples.
 * @example
 * renderScore({ tempo: 120, tracks: [{ instrument: PRESETS.pluck, notes: [{ at: 0, length: 1, pitch: "C4" }] }] })
 */
export function renderScore(score: Score, options: RenderOptions = {}): Float32Array {
	let sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
	let tail = options.tail ?? (score.length === undefined ? longestRelease(score) : 0);
	let beat = beatSeconds(score.tempo);
	let length = Math.ceil((scoreBeats(score) * beat + tail) * sampleRate);
	let mix = new Float32Array(length);
	score.tracks.forEach((track, index) => renderTrack(track, index, score, sampleRate, mix));
	applyEffects(mix, score.effects ?? [], { sampleRate, beat });
	if (options.limit ?? true) {
		for (let i = 0; i < length; i++) mix[i] = Math.tanh(mix[i] ?? 0);
	}
	return mix;
}
