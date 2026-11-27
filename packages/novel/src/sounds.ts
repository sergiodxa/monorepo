/**
 * The `@sdxc/novel/sounds` entry: ready-made interface sounds synthesized with `@sdxc/synth`, so
 * a novel gets hover and select sounds without an audio file to ship. Each preset is plain data,
 * and rendering waits for `renderInterfaceSounds()`, called in the browser where the player plays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Instrument, Note } from "@sdxc/synth";

import { encodeWav, renderScore } from "@sdxc/synth";

import type { AssetDeclaration } from "./declarations.js";

import { assets } from "./declarations.js";

/** One interface sound: notes on an instrument, cut `tail` seconds after the last one ends. */
export interface InterfaceSound {
	instrument: Instrument;
	/** Played at 120 beats per minute, so a beat is half a second. */
	notes: Note[];
	/** The track's level, kept low since the sound plays on every hover and pick. */
	gain: number;
	/** Seconds kept after the last note, which also caps how long the sound rings. */
	tail: number;
}

/** The two sounds of a preset, matching the player's `sounds` prop. */
export interface InterfaceSoundPreset {
	hover: InterfaceSound;
	select: InterfaceSound;
}

/** A preset rendered and declared, ready for the player's `sounds` prop. */
export interface RenderedInterfaceSounds {
	hover: AssetDeclaration<"sound">;
	select: AssetDeclaration<"sound">;
}

/** Low enough for a click-sized sound, and a quarter of the samples CD quality takes. */
const SAMPLE_RATE = 22_050;

/** A sine that falls a fifth in its first 12ms, which the ear hears as a rounded pop. */
const POP: Instrument = {
	oscillators: [{ waveform: "sine" }],
	envelope: { attack: 0.002, decay: 0.045, sustain: 0, release: 0.02 },
	sweep: { from: 7, time: 0.012 },
};

/** Noise that swells in 12ms and fades through a closing lowpass: paper brushed by a page. */
const PAPER: Instrument = {
	oscillators: [{ waveform: "noise" }],
	envelope: { attack: 0.012, decay: 0.12, sustain: 0, release: 0.05 },
	filter: { type: "lowpass", cutoff: 1800, envelope: 1500 },
};

/** A few milliseconds of highpassed noise, the dry tick of a mechanical switch. */
const TICK: Instrument = {
	oscillators: [{ waveform: "noise" }],
	envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.008 },
	filter: { type: "highpass", cutoff: 2500 },
};

/** A triangle that snaps down an octave in 4ms, a click with a little body under it. */
const CLICK: Instrument = {
	oscillators: [{ waveform: "triangle" }],
	envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.015 },
	sweep: { from: 12, time: 0.004 },
};

/** A sine with a quiet octave above, gone within a tenth of a second so it never rings. */
const BELL: Instrument = {
	oscillators: [{ waveform: "sine" }, { waveform: "sine", octave: 1, gain: 0.15 }],
	envelope: { attack: 0.004, decay: 0.08, sustain: 0, release: 0.04 },
};

/** One short note at the start of the sound. */
function note(pitch: string, at = 0): Note {
	return { at, length: 0.02, pitch };
}

/**
 * The ready-made presets. `soft` pops on hover and brushes paper on a pick; `tick` is crisp and
 * dry; `chime` is a quiet sine with a two-note rise on a pick. Spread one to change a sound.
 *
 * @example renderInterfaceSounds({ ...INTERFACE_SOUND_PRESETS.soft, select: myPick })
 */
export const INTERFACE_SOUND_PRESETS = {
	soft: {
		hover: { instrument: POP, notes: [note("C6")], gain: 0.25, tail: 0.05 },
		select: { instrument: PAPER, notes: [note("C4")], gain: 0.3, tail: 0.1 },
	},
	tick: {
		hover: { instrument: TICK, notes: [note("C4")], gain: 0.12, tail: 0.02 },
		select: { instrument: CLICK, notes: [note("A5")], gain: 0.22, tail: 0.04 },
	},
	chime: {
		hover: { instrument: BELL, notes: [note("E6")], gain: 0.12, tail: 0.08 },
		select: { instrument: BELL, notes: [note("G5"), note("C6", 0.12)], gain: 0.15, tail: 0.1 },
	},
} satisfies Record<string, InterfaceSoundPreset>;

/** The name of a ready-made preset. */
export type InterfaceSoundPresetName = keyof typeof INTERFACE_SOUND_PRESETS;

/** Renders presets once per page, so a remounted player reuses the Blobs it already played. */
const RENDERED = new WeakMap<InterfaceSoundPreset, RenderedInterfaceSounds>();

/** A WAV Blob of one sound, rendered at {@link SAMPLE_RATE}. */
function renderSound(sound: InterfaceSound): Blob {
	let samples = renderScore(
		{
			tempo: 120,
			tracks: [{ instrument: sound.instrument, notes: sound.notes, gain: sound.gain }],
		},
		{ sampleRate: SAMPLE_RATE, tail: sound.tail },
	);
	return new Blob([encodeWav(samples, SAMPLE_RATE)], { type: "audio/wav" });
}

/**
 * Renders a preset into sound assets for the player's `sounds` prop. Synthesis takes a few
 * milliseconds of CPU, so call it in the browser where the player mounts; repeated calls with the
 * same preset answer the declarations rendered the first time.
 *
 * @param preset - A preset name, or a preset of your own. Default: `"soft"`.
 * @returns `hover` and `select`, each a sound declaration holding a WAV Blob.
 * @example <NovelPlayer.Default novel={novel} sounds={renderInterfaceSounds("tick")} />
 */
export function renderInterfaceSounds(
	preset: InterfaceSoundPresetName | InterfaceSoundPreset = "soft",
): RenderedInterfaceSounds {
	let source: InterfaceSoundPreset =
		typeof preset === "string" ? INTERFACE_SOUND_PRESETS[preset] : preset;
	let cached = RENDERED.get(source);
	if (cached !== undefined) return cached;
	let declared = assets({
		sounds: { hover: renderSound(source.hover), select: renderSound(source.select) },
	}).sounds;
	RENDERED.set(source, declared);
	return declared;
}
