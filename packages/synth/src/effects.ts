/**
 * Effects that run over a track or the whole mix: an echo timed in beats, a small-room-to-hall
 * reverb, a drive that warms and limits, and a filter that shapes the tone. Each processes a
 * buffer in place and returns it, so a chain is a loop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** An echo of the sound after a delay, fading by `feedback` each repeat. */
export interface DelayEffect {
	type: "delay";
	/** The delay in beats, such as 0.75 for a dotted eighth. */
	time: number;
	/** How much of each echo feeds the next, from 0 to below 1. Default: 0.35. */
	feedback?: number;
	/** How loud the echoes are against the dry sound, from 0 to 1. Default: 0.3. */
	mix?: number;
}

/** A room's reflections, from a small room (`size` 0) to a large hall (`size` 1). */
export interface ReverbEffect {
	type: "reverb";
	/** Default: 0.5. */
	size?: number;
	/** How loud the reflections are against the dry sound, from 0 to 1. Default: 0.25. */
	mix?: number;
}

/** Soft saturation that warms the sound and rounds its peaks. */
export interface DriveEffect {
	type: "drive";
	/** From 0 (clean) up; 1 is warm, 4 is fuzz. Default: 1. */
	amount?: number;
}

/** A one-pole filter over a whole track, for a darker or thinner tone. */
export interface FilterEffect {
	type: "lowpass" | "highpass";
	/** Where it cuts, in hertz. */
	cutoff: number;
}

/** Any effect a track or a score can run. */
export type Effect = DelayEffect | ReverbEffect | DriveEffect | FilterEffect;

/** What processing needs beyond the samples. */
export interface EffectContext {
	sampleRate: number;
	/** Seconds per beat, for effects timed in beats. */
	beat: number;
}

/** Comb filter delays of a Schroeder reverb at 44.1 kHz, scaled to the sample rate and size. */
const COMBS = [1116, 1188, 1277, 1356];

/** All-pass delays of the same reverb at 44.1 kHz. */
const ALLPASSES = [556, 441];

/**
 * Runs effects over samples in place, in order.
 *
 * @param samples The sound.
 * @param effects The chain.
 * @param context The sample rate and the beat's length.
 * @returns The same buffer, processed.
 */
export function applyEffects(
	samples: Float32Array,
	effects: readonly Effect[],
	context: EffectContext,
): Float32Array {
	for (let effect of effects) {
		if (effect.type === "delay") delay(samples, effect, context);
		else if (effect.type === "reverb") reverb(samples, effect, context.sampleRate);
		else if (effect.type === "drive") drive(samples, effect.amount ?? 1);
		else onePole(samples, effect, context.sampleRate);
	}
	return samples;
}

/** Adds fading echoes, each fed from the last. */
function delay(samples: Float32Array, effect: DelayEffect, context: EffectContext) {
	let distance = Math.max(1, Math.round(effect.time * context.beat * context.sampleRate));
	let feedback = Math.min(0.95, Math.max(0, effect.feedback ?? 0.35));
	let mix = effect.mix ?? 0.3;
	let line = new Float32Array(distance);
	for (let i = 0; i < samples.length; i++) {
		let slot = i % distance;
		let echo = line[slot] ?? 0;
		let dry = samples[i] ?? 0;
		line[slot] = dry + echo * feedback;
		samples[i] = dry + echo * mix;
	}
}

/** Adds a Schroeder reverb: parallel damped combs into series all-passes. */
function reverb(samples: Float32Array, effect: ReverbEffect, sampleRate: number) {
	let size = Math.min(1, Math.max(0, effect.size ?? 0.5));
	let mix = effect.mix ?? 0.25;
	let scale = (sampleRate / 44_100) * (0.6 + size * 0.9);
	let feedback = 0.7 + size * 0.24;
	let combs = COMBS.map((length) => ({
		line: new Float32Array(Math.round(length * scale)),
		last: 0,
	}));
	let passes = ALLPASSES.map((length) => new Float32Array(Math.round(length * scale)));
	for (let i = 0; i < samples.length; i++) {
		let dry = samples[i] ?? 0;
		let wet = 0;
		for (let comb of combs) {
			let slot = i % comb.line.length;
			let out = comb.line[slot] ?? 0;
			comb.last = out * 0.8 + comb.last * 0.2;
			comb.line[slot] = dry * 0.25 + comb.last * feedback;
			wet += out;
		}
		for (let line of passes) {
			let slot = i % line.length;
			let held = line[slot] ?? 0;
			line[slot] = wet + held * 0.5;
			wet = held - wet * 0.5;
		}
		samples[i] = dry + wet * mix;
	}
}

/** Saturates with a hyperbolic tangent, scaled so a quiet signal keeps its level. */
function drive(samples: Float32Array, amount: number) {
	if (amount <= 0) return;
	let gain = 1 + amount;
	let norm = 1 / Math.tanh(gain);
	for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh((samples[i] ?? 0) * gain) * norm;
}

/** Filters with a one-pole low-pass, or its complement for a high-pass. */
function onePole(samples: Float32Array, effect: FilterEffect, sampleRate: number) {
	let k = 1 - Math.exp((-2 * Math.PI * Math.max(1, effect.cutoff)) / sampleRate);
	let low = 0;
	for (let i = 0; i < samples.length; i++) {
		let input = samples[i] ?? 0;
		low += (input - low) * k;
		samples[i] = effect.type === "lowpass" ? low : input - low;
	}
}
