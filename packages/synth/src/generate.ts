/**
 * A procedural composer on top of the synthesizer: from a style, a key, a mode, a length and a
 * seed it writes an arranged score (pads, bass, a lead, drums, effects) using the same notes,
 * tracks and presets a hand-written score uses. A seed is one way to get a score, not the only one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Effect } from "./effects.js";
import type { Instrument } from "./instrument.js";
import type { Mode, Pitch } from "./pitch.js";
import type { RenderOptions } from "./render.js";
import type { Note, Score, Track } from "./score.js";

import { PRESETS } from "./instrument.js";
import { scaleNote } from "./pitch.js";
import { seededRandom } from "./random.js";
import { renderScore } from "./render.js";

/** Chord progressions as scale degrees from zero, one chord per bar. */
const PROGRESSIONS = [
	[0, 4, 5, 3],
	[5, 3, 0, 4],
	[0, 5, 1, 4],
	[1, 4, 0, 5],
	[0, 2, 3, 3],
	[0, 3, 5, 4],
	[3, 4, 2, 5],
	[0, 0, 3, 4],
];

/** How a style arranges a song. */
interface StyleRecipe {
	/** The tempo range a seed picks from, in beats per minute. */
	tempo: [number, number];
	/** Which sixteenths of a bar the kick plays on; none for a song without drums. */
	kicks: number[];
	/** Snare sixteenths; a fill adds more on a phrase's last bar. */
	snares: number[];
	/** Swing on off-beat sixteenths, from 0 (straight) to 0.33 (triplet feel). */
	swing: number;
	pad: Instrument;
	lead: Instrument;
	bass: Instrument;
	/** Bass hits per bar, in beats. */
	bassHits: number[];
	/** How likely the lead plays on each sixteenth, from 0 to 1. */
	leadDensity: number;
	/** The mix's own effects. */
	master: Effect[];
	/** Echo on the lead. */
	echo: number;
}

/** The generator's pad: two detuned saws, light enough to hold under a whole song. */
const SONG_PAD: Instrument = {
	...PRESETS.pad,
	envelope: { attack: 0.5, decay: 0.6, sustain: 0.8, release: 0.6 },
	oscillators: [
		{ waveform: "saw", gain: 0.5 },
		{ waveform: "saw", gain: 0.5, detune: 9 },
	],
};

/** Every style the composer writes in. */
const STYLES = {
	ambient: {
		tempo: [64, 76],
		kicks: [],
		snares: [],
		swing: 0,
		pad: { ...SONG_PAD, envelope: { attack: 1.6, decay: 1, sustain: 0.85, release: 2 } },
		lead: PRESETS.bell,
		bass: PRESETS.subBass,
		bassHits: [0],
		leadDensity: 0.12,
		master: [{ type: "reverb", size: 0.85, mix: 0.4 }],
		echo: 0.45,
	},
	lofi: {
		tempo: [78, 90],
		kicks: [0, 7, 10],
		snares: [4, 12],
		swing: 0.18,
		pad: PRESETS.keys,
		lead: PRESETS.bell,
		bass: PRESETS.subBass,
		bassHits: [0, 1, 2, 3],
		leadDensity: 0.3,
		master: [
			{ type: "lowpass", cutoff: 5200 },
			{ type: "reverb", size: 0.35, mix: 0.18 },
			{ type: "drive", amount: 0.3 },
		],
		echo: 0.28,
	},
	synthpop: {
		tempo: [104, 118],
		kicks: [0, 4, 8, 12],
		snares: [4, 12],
		swing: 0,
		pad: SONG_PAD,
		lead: PRESETS.lead,
		bass: PRESETS.bass,
		bassHits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
		leadDensity: 0.5,
		master: [
			{ type: "reverb", size: 0.45, mix: 0.18 },
			{ type: "drive", amount: 0.3 },
		],
		echo: 0.22,
	},
	house: {
		tempo: [120, 124],
		kicks: [0, 4, 8, 12],
		snares: [4, 12],
		swing: 0.06,
		pad: PRESETS.organ,
		lead: PRESETS.pluck,
		bass: PRESETS.bass,
		bassHits: [0.5, 1.5, 2.5, 3.5],
		leadDensity: 0.4,
		master: [
			{ type: "reverb", size: 0.3, mix: 0.14 },
			{ type: "drive", amount: 0.4 },
		],
		echo: 0.18,
	},
	downtempo: {
		tempo: [86, 98],
		kicks: [0, 6, 10],
		snares: [4, 12],
		swing: 0.1,
		pad: SONG_PAD,
		lead: PRESETS.keys,
		bass: PRESETS.subBass,
		bassHits: [0, 1, 2, 3],
		leadDensity: 0.28,
		master: [{ type: "reverb", size: 0.6, mix: 0.25 }],
		echo: 0.35,
	},
	cinematic: {
		tempo: [70, 84],
		kicks: [0, 10],
		snares: [8],
		swing: 0,
		pad: { ...SONG_PAD, envelope: { attack: 1, decay: 0.8, sustain: 0.85, release: 1.8 } },
		lead: PRESETS.bell,
		bass: PRESETS.bass,
		bassHits: [0],
		leadDensity: 0.18,
		master: [{ type: "reverb", size: 0.9, mix: 0.35 }],
		echo: 0.4,
	},
} satisfies Record<string, StyleRecipe>;

/** A style the composer writes in. */
export type Style = keyof typeof STYLES;

/** What one generated song is: everything needed to write it the same way every time. */
export interface SongSpec {
	/** Varies the tempo, progression, melody and fills between songs of one style. */
	seed: number;
	style: Style;
	/** The key's root, in the bass octave, such as `"A2"` or 45. */
	key: Pitch;
	mode: Mode;
	/** Length in seconds; the arrangement fills it. */
	duration: number;
	/** Beats per minute; a seed picks one inside the style's range when omitted. */
	tempo?: number;
}

/** Which parts play in one section of a song. */
interface Section {
	pad: boolean;
	bass: boolean;
	drums: boolean;
	lead: boolean;
}

/** Bars per section: an intro, the body with a breakdown in the middle, and an outro. */
const SECTION_BARS = 8;

/** Plans a song's sections: a sparse intro, the full body with a breakdown, and a sparse end. */
function planSections(count: number): Section[] {
	return Array.from({ length: count }, (_, index) => {
		if (index === 0) return { pad: true, bass: false, drums: false, lead: false };
		if (index === count - 1) return { pad: true, bass: true, drums: false, lead: true };
		if (count > 4 && index === Math.floor(count / 2))
			return { pad: true, bass: false, drums: false, lead: true };
		return { pad: true, bass: true, drums: true, lead: index % 2 === 0 || index > 2 };
	});
}

/** Where a sixteenth falls in its bar, in beats, with the style's swing on the off-beats. */
function stepBeat(step: number, swing: number): number {
	return step / 4 + (step % 2 === 1 ? swing / 4 : 0);
}

/**
 * Writes a song as a score. Each bar plays one chord of a progression the seed picks; the lead
 * walks the chord's tones in a seeded rhythm, the drums follow the style, and the mix runs the
 * style's effects. The score lasts exactly `duration` seconds.
 *
 * @param spec What to write.
 * @returns A score to render, inspect or change before rendering.
 * @example generateSong({ seed: 7, style: "lofi", key: "A2", mode: "dorian", duration: 150 })
 */
export function generateSong(spec: SongSpec): Score {
	let random = seededRandom(spec.seed);
	let style: StyleRecipe = STYLES[spec.style];
	let [low, high] = style.tempo;
	let tempo = spec.tempo ?? Math.round(low + (high - low) * random());
	let beats = (spec.duration * tempo) / 60;
	let bars = Math.floor(beats / 4);
	let progression = PROGRESSIONS[Math.floor(random() * PROGRESSIONS.length)] ?? [0, 4, 5, 3];
	let sections = planSections(Math.max(3, Math.ceil(bars / SECTION_BARS)));
	let leadSteps = Array.from({ length: 16 }, () =>
		random() < style.leadDensity ? Math.floor(random() * 4) : -1,
	);
	let hats = Array.from({ length: 16 }, (_, step) => step % 2 === 0 || random() < 0.3);
	let parts = {
		pad: [] as Note[],
		bass: [] as Note[],
		lead: [] as Note[],
		kick: [] as Note[],
		snare: [] as Note[],
		hat: [] as Note[],
	};

	for (let bar = 0; bar < bars; bar++) {
		let section = sections[Math.floor(bar / SECTION_BARS)] ?? sections[0];
		if (section === undefined) continue;
		let at = bar * 4;
		let root = progression[bar % progression.length] ?? 0;
		let tones = [root, root + 2, root + 4, root + 6];
		if (section.pad) {
			for (let tone of tones.slice(0, 3)) {
				parts.pad.push({
					at,
					length: 4,
					pitch: scaleNote(spec.key, spec.mode, tone + 7),
					velocity: 0.6,
				});
			}
		}
		if (section.bass) {
			let length = style.bassHits.length > 4 ? 0.4 : 4 / style.bassHits.length - 0.1;
			for (let hit of style.bassHits) {
				parts.bass.push({
					at: at + hit,
					length,
					pitch: scaleNote(spec.key, spec.mode, root),
					velocity: 0.8,
				});
			}
		}
		if (section.lead) {
			leadSteps.forEach((tone, step) => {
				if (tone === -1) return;
				let index = leadSteps[(step + bar) % 16] ?? 0;
				parts.lead.push({
					at: at + stepBeat(step, style.swing),
					length: 0.25,
					pitch: scaleNote(spec.key, spec.mode, (tones[Math.max(0, index)] ?? root) + 14),
					velocity: 0.55 + random() * 0.3,
				});
			});
		}
		if (section.drums && style.kicks.length > 0) {
			let fill = bar % SECTION_BARS === SECTION_BARS - 1;
			for (let step of style.kicks)
				parts.kick.push({
					at: at + stepBeat(step, style.swing),
					length: 0.25,
					pitch: 36,
					velocity: 0.9,
				});
			for (let step of fill ? [...style.snares, 14, 15] : style.snares) {
				parts.snare.push({
					at: at + stepBeat(step, style.swing),
					length: 0.25,
					pitch: 38,
					velocity: 0.8,
				});
			}
			hats.forEach((on, step) => {
				if (on)
					parts.hat.push({
						at: at + stepBeat(step, style.swing),
						length: 0.1,
						pitch: 42,
						velocity: step % 4 === 2 ? 0.8 : 0.5,
					});
			});
		}
	}

	let tracks: Track[] = [
		{ name: "pad", instrument: style.pad, notes: parts.pad, gain: 0.25 },
		{ name: "bass", instrument: style.bass, notes: parts.bass, gain: 0.32 },
		{
			name: "lead",
			instrument: style.lead,
			notes: parts.lead,
			gain: 0.23,
			effects: [{ type: "delay", time: 0.75, feedback: 0.4, mix: style.echo }],
		},
		{ name: "kick", instrument: PRESETS.kick, notes: parts.kick, gain: 0.36 },
		{ name: "snare", instrument: PRESETS.snare, notes: parts.snare, gain: 0.25 },
		{ name: "hat", instrument: PRESETS.hat, notes: parts.hat, gain: 0.2 },
	];
	return {
		tempo,
		length: beats,
		seed: spec.seed,
		tracks: tracks.filter((track) => track.notes.length > 0),
		effects: style.master,
	};
}

/**
 * Generates a song and renders it in one step, with a short fade at each end.
 *
 * @param spec What to write.
 * @param options How to render it.
 * @returns `duration × sampleRate` samples.
 * @example encodeWav(renderSong({ seed: 3, style: "house", key: "F2", mode: "minor", duration: 30 }, { sampleRate: 22_050 }), 22_050)
 */
export function renderSong(spec: SongSpec, options: RenderOptions = {}): Float32Array {
	let samples = renderScore(generateSong(spec), options);
	let sampleRate = options.sampleRate ?? 44_100;
	let fadeIn = Math.floor(0.05 * sampleRate);
	let fadeOut = Math.floor(Math.min(4, spec.duration / 4) * sampleRate);
	for (let i = 0; i < samples.length; i++) {
		let gain = Math.min(1, i / fadeIn, (samples.length - i) / fadeOut);
		samples[i] = (samples[i] ?? 0) * gain;
	}
	return samples;
}
