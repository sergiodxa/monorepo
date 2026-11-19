/**
 * What a note sounds like: oscillators and noise mixed together, an ADSR envelope, an optional
 * resonant filter that can open with the envelope, and a pitch sweep for drums. Presets cover
 * the voices a song usually needs; any field can be written by hand instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The shape of one oscillator's wave; `noise` is white noise from the score's seed. */
export type Waveform = "sine" | "triangle" | "saw" | "square" | "noise";

/** One sound source inside an instrument. */
export interface Oscillator {
	waveform: Waveform;
	/** Its level in the instrument's mix. Default: 1. */
	gain?: number;
	/** A shift in cents (1/100 of a semitone), for chorus-like width. Default: 0. */
	detune?: number;
	/** A shift in whole octaves, such as -1 for a sub-oscillator. Default: 0. */
	octave?: number;
}

/** How a note's level moves: up, down to a held level, and away once the note ends. */
export interface Envelope {
	/** Seconds from silence to full level. */
	attack: number;
	/** Seconds from full level down to `sustain`. */
	decay: number;
	/** The level held while the note lasts, from 0 to 1. */
	sustain: number;
	/** Seconds from the held level to silence after the note ends. */
	release: number;
}

/** A resonant filter on each note, which the envelope can open. */
export interface Filter {
	type: "lowpass" | "highpass" | "bandpass";
	/** Where it cuts, in hertz. */
	cutoff: number;
	/** How much it rings at the cutoff, from 0 (none) to 1 (close to whistling). Default: 0. */
	resonance?: number;
	/** Hertz the envelope adds to the cutoff at its peak, for a pluck that brightens then dulls. Default: 0. */
	envelope?: number;
	/** Hertz the cutoff rises per octave of pitch above middle C, so high notes stay bright. Default: 0. */
	tracking?: number;
}

/** A fall in pitch at a note's start, the snap of a kick drum or a laser. */
export interface PitchSweep {
	/** Semitones above the note it starts from. */
	from: number;
	/** Seconds it takes to fall about two thirds of the way. */
	time: number;
}

/** A voice the synthesizer plays every note of a track with. */
export interface Instrument {
	oscillators: Oscillator[];
	envelope: Envelope;
	filter?: Filter;
	sweep?: PitchSweep;
	/** Plays every note at this pitch, as drums do, whatever the note says. */
	fixedPitch?: number;
	/** The instrument's overall level. Default: 1. */
	gain?: number;
}

/**
 * Ready-made instruments, each a plain {@link Instrument} to use as it is or spread and change.
 *
 * @example { ...PRESETS.pluck, filter: { type: "lowpass", cutoff: 900, envelope: 3000 } }
 */
export const PRESETS = {
	pad: {
		oscillators: [
			{ waveform: "saw", gain: 0.5 },
			{ waveform: "saw", gain: 0.5, detune: 9 },
			{ waveform: "triangle", gain: 0.4, octave: -1 },
		],
		envelope: { attack: 0.8, decay: 0.6, sustain: 0.8, release: 1.4 },
		filter: { type: "lowpass", cutoff: 1400, resonance: 0.1, tracking: 200 },
		gain: 0.5,
	},
	keys: {
		oscillators: [
			{ waveform: "square", gain: 0.35 },
			{ waveform: "sine", gain: 0.6 },
		],
		envelope: { attack: 0.01, decay: 0.5, sustain: 0.4, release: 0.4 },
		filter: { type: "lowpass", cutoff: 1800, envelope: 1200 },
		gain: 0.55,
	},
	bass: {
		oscillators: [
			{ waveform: "saw", gain: 0.6 },
			{ waveform: "sine", gain: 0.8, octave: -1 },
		],
		envelope: { attack: 0.005, decay: 0.25, sustain: 0.6, release: 0.08 },
		filter: { type: "lowpass", cutoff: 380, resonance: 0.25, envelope: 900 },
		gain: 0.8,
	},
	subBass: {
		oscillators: [{ waveform: "sine" }],
		envelope: { attack: 0.01, decay: 0.2, sustain: 0.85, release: 0.12 },
		gain: 0.9,
	},
	pluck: {
		oscillators: [
			{ waveform: "saw", gain: 0.6 },
			{ waveform: "square", gain: 0.3, detune: -6 },
		],
		envelope: { attack: 0.003, decay: 0.28, sustain: 0, release: 0.2 },
		filter: { type: "lowpass", cutoff: 700, resonance: 0.3, envelope: 3500 },
		gain: 0.55,
	},
	lead: {
		oscillators: [
			{ waveform: "square", gain: 0.5 },
			{ waveform: "saw", gain: 0.4, detune: 7 },
		],
		envelope: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.25 },
		filter: { type: "lowpass", cutoff: 2400, resonance: 0.2, tracking: 300 },
		gain: 0.45,
	},
	bell: {
		oscillators: [
			{ waveform: "sine", gain: 0.7 },
			{ waveform: "sine", gain: 0.25, octave: 2, detune: 14 },
			{ waveform: "triangle", gain: 0.2, octave: 1 },
		],
		envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 0.8 },
		gain: 0.5,
	},
	organ: {
		oscillators: [
			{ waveform: "sine", gain: 0.6 },
			{ waveform: "sine", gain: 0.35, octave: 1 },
			{ waveform: "sine", gain: 0.2, octave: 2 },
		],
		envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.08 },
		gain: 0.5,
	},
	kick: {
		oscillators: [{ waveform: "sine" }],
		envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.05 },
		sweep: { from: 26, time: 0.035 },
		fixedPitch: 31,
		gain: 1,
	},
	snare: {
		oscillators: [
			{ waveform: "noise", gain: 0.7 },
			{ waveform: "triangle", gain: 0.5 },
		],
		envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05 },
		filter: { type: "bandpass", cutoff: 1800, resonance: 0.2 },
		sweep: { from: 7, time: 0.02 },
		fixedPitch: 55,
		gain: 0.6,
	},
	hat: {
		oscillators: [{ waveform: "noise" }],
		envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
		filter: { type: "highpass", cutoff: 6500 },
		fixedPitch: 60,
		gain: 0.35,
	},
	clap: {
		oscillators: [{ waveform: "noise" }],
		envelope: { attack: 0.004, decay: 0.12, sustain: 0, release: 0.05 },
		filter: { type: "bandpass", cutoff: 1200, resonance: 0.35 },
		fixedPitch: 60,
		gain: 0.5,
	},
} satisfies Record<string, Instrument>;

/** The name of a preset instrument. */
export type PresetName = keyof typeof PRESETS;
