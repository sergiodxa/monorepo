/**
 * A small seeded song generator: from a style, a key, a tempo and a seed it writes a whole
 * arranged piece (pads, bass, plucked lead, drums, an echo) as mono PCM, and wraps it as WAV.
 * The same inputs always give the same samples, so every track sounds the same on every visit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The samples per second every track renders at: enough for these timbres, a quarter of CD. */
export const SAMPLE_RATE = 22_050;

/** The length of each wavetable; a power of two so a phase wraps with a mask. */
const TABLE_SIZE = 4096;

/** One cycle of a sine. */
const SINE = Float32Array.from({ length: TABLE_SIZE }, (_, i) =>
	Math.sin((2 * Math.PI * i) / TABLE_SIZE),
);

/** One cycle of a soft sawtooth: its first eight harmonics, so nothing aliases at 22 kHz. */
const SAW = Float32Array.from({ length: TABLE_SIZE }, (_, i) => {
	let value = 0;
	for (let n = 1; n <= 8; n++) value += Math.sin((2 * Math.PI * n * i) / TABLE_SIZE) / n;
	return value * 0.55;
});

/** One cycle of a hollow square: its odd harmonics up to the ninth. */
const SQUARE = Float32Array.from({ length: TABLE_SIZE }, (_, i) => {
	let value = 0;
	for (let n = 1; n <= 9; n += 2) value += Math.sin((2 * Math.PI * n * i) / TABLE_SIZE) / n;
	return value * 0.7;
});

/** The scale each mode plays, as semitones above the key. */
const MODES = {
	major: [0, 2, 4, 5, 7, 9, 11],
	minor: [0, 2, 3, 5, 7, 8, 10],
	dorian: [0, 2, 3, 5, 7, 9, 10],
	lydian: [0, 2, 4, 6, 7, 9, 11],
	mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const;

/** A scale a song is written in. */
export type Mode = keyof typeof MODES;

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

/** How a style arranges a song: which parts play, how hard, and how they move. */
interface StyleRecipe {
	/** Beats per minute when a track names none. */
	tempo: [number, number];
	/** Bars per section. */
	sectionBars: number;
	/** Drum pattern, or none. */
	drums: "none" | "soft" | "four" | "broken";
	/** Swing on off-beat sixteenths, from 0 (straight) to 0.33 (triplet feel). */
	swing: number;
	/** The pad's wavetable and how loud it sits. */
	pad: { table: Float32Array; level: number; attack: number };
	/** How often the lead plays a note on a sixteenth, from 0 to 1. */
	leadDensity: number;
	/** The lead's wavetable. */
	lead: Float32Array;
	/** The bass's wavetable and its rhythm: a note per bar, per beat, or on eighths. */
	bass: { table: Float32Array; rhythm: "whole" | "beats" | "eighths" };
	/** How much of the signal returns through the echo. */
	echo: number;
	/** Pink-ish noise under everything, like a record's surface. */
	crackle: number;
}

/** Every style a track can be written in. */
const STYLES = {
	ambient: {
		tempo: [64, 76],
		sectionBars: 8,
		drums: "none",
		swing: 0,
		pad: { table: SAW, level: 0.2, attack: 1.6 },
		leadDensity: 0.12,
		lead: SINE,
		bass: { table: SINE, rhythm: "whole" },
		echo: 0.45,
		crackle: 0,
	},
	lofi: {
		tempo: [78, 90],
		sectionBars: 8,
		drums: "soft",
		swing: 0.18,
		pad: { table: SQUARE, level: 0.12, attack: 0.08 },
		leadDensity: 0.32,
		lead: SINE,
		bass: { table: SINE, rhythm: "beats" },
		echo: 0.28,
		crackle: 0.012,
	},
	synthpop: {
		tempo: [104, 118],
		sectionBars: 8,
		drums: "four",
		swing: 0,
		pad: { table: SAW, level: 0.11, attack: 0.04 },
		leadDensity: 0.55,
		lead: SQUARE,
		bass: { table: SAW, rhythm: "eighths" },
		echo: 0.22,
		crackle: 0,
	},
	house: {
		tempo: [120, 124],
		sectionBars: 8,
		drums: "four",
		swing: 0.06,
		pad: { table: SQUARE, level: 0.1, attack: 0.02 },
		leadDensity: 0.4,
		lead: SAW,
		bass: { table: SINE, rhythm: "eighths" },
		echo: 0.18,
		crackle: 0,
	},
	downtempo: {
		tempo: [86, 98],
		sectionBars: 8,
		drums: "broken",
		swing: 0.1,
		pad: { table: SAW, level: 0.14, attack: 0.4 },
		leadDensity: 0.28,
		lead: SQUARE,
		bass: { table: SINE, rhythm: "beats" },
		echo: 0.35,
		crackle: 0.004,
	},
	cinematic: {
		tempo: [70, 84],
		sectionBars: 8,
		drums: "broken",
		swing: 0,
		pad: { table: SAW, level: 0.18, attack: 0.9 },
		leadDensity: 0.18,
		lead: SINE,
		bass: { table: SAW, rhythm: "whole" },
		echo: 0.4,
		crackle: 0,
	},
} satisfies Record<string, StyleRecipe>;

/** A style a track is written in. */
export type Style = keyof typeof STYLES;

/** What one song is: everything the generator needs to write it the same way every time. */
export interface SongSpec {
	/** Varies the progression, the melody and the drum fills between songs of one style. */
	seed: number;
	style: Style;
	/** The key's root as a MIDI note number in the bass octave, such as 45 for A2. */
	key: number;
	mode: Mode;
	/** Length in seconds; the arrangement fills it and fades out at the end. */
	duration: number;
	/** Beats per minute; the style's own range is used when omitted. */
	tempo?: number;
}

/**
 * A deterministic pseudo-random sequence (mulberry32): the same seed gives the same numbers.
 *
 * @param seed Any 32-bit integer.
 * @returns A function returning the next number in [0, 1).
 */
export function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

/** The frequency of a MIDI note number, A4 = 440 Hz. */
function frequency(note: number): number {
	return 440 * 2 ** ((note - 69) / 12);
}

/** One sounding note: when, how long, what pitch, how loud, and its shape. */
interface Voice {
	/** Start in seconds. */
	at: number;
	/** Length in seconds before the release. */
	length: number;
	frequency: number;
	gain: number;
	table: Float32Array;
	attack: number;
	release: number;
	/** Exponential decay per second while held, for plucks and bass; 0 holds level. */
	decay?: number;
	/** Second oscillator detuned by this ratio, for width. */
	detune?: number;
}

/**
 * Adds one note into the buffer through a wavetable with an attack, an optional decay and a
 * release, so a note never clicks at either end.
 */
function addVoice(buffer: Float32Array, voice: Voice) {
	let start = Math.floor(voice.at * SAMPLE_RATE);
	let held = Math.floor(voice.length * SAMPLE_RATE);
	let release = Math.max(1, Math.floor(voice.release * SAMPLE_RATE));
	let attack = Math.max(1, Math.floor(voice.attack * SAMPLE_RATE));
	let end = Math.min(buffer.length, start + held + release);
	let step = (voice.frequency * TABLE_SIZE) / SAMPLE_RATE;
	let step2 = step * (voice.detune ?? 1);
	let decay = voice.decay === undefined ? 1 : Math.exp(-voice.decay / SAMPLE_RATE);
	let level = 1;
	let phase = 0;
	let phase2 = TABLE_SIZE / 3;
	let table = voice.table;
	let two = voice.detune !== undefined;
	let mask = TABLE_SIZE - 1;
	for (let i = Math.max(0, start); i < end; i++) {
		let n = i - start;
		let envelope = n < attack ? n / attack : level;
		if (n >= held) envelope *= 1 - (n - held) / release;
		level *= decay;
		let sample = table[(phase | 0) & mask] ?? 0;
		if (two) sample = (sample + (table[(phase2 | 0) & mask] ?? 0)) * 0.5;
		buffer[i] = (buffer[i] ?? 0) + sample * envelope * voice.gain;
		phase += step;
		phase2 += step2;
	}
}

/** A drum hit's sound. */
type Drum = "kick" | "snare" | "hat";

/** How long each drum rings, in seconds. */
const DRUM_LENGTHS: Record<Drum, number> = { kick: 0.32, snare: 0.2, hat: 0.05 };

/** Where a bar's bass notes fall, in beats, for each rhythm. */
const BASS_HITS: Record<StyleRecipe["bass"]["rhythm"], number[]> = {
	whole: [0],
	beats: [0, 1, 2, 3],
	eighths: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
};

/** Which sixteenths of a bar the kick plays on, for each drum pattern. */
const KICKS: Record<StyleRecipe["drums"], number[]> = {
	none: [],
	soft: [0, 7, 10],
	four: [0, 4, 8, 12],
	broken: [0, 6, 10],
};

/** Adds one drum hit: a falling sine for the kick, filtered noise for the snare and the hat. */
function addDrum(buffer: Float32Array, drum: Drum, at: number, gain: number, random: () => number) {
	let start = Math.floor(at * SAMPLE_RATE);
	let length = Math.floor(DRUM_LENGTHS[drum] * SAMPLE_RATE);
	let end = Math.min(buffer.length, start + length);
	let phase = 0;
	let last = 0;
	for (let i = Math.max(0, start); i < end; i++) {
		let t = (i - start) / SAMPLE_RATE;
		let sample = 0;
		if (drum === "kick") {
			let pitch = 48 + 90 * Math.exp(-t * 28);
			phase += (pitch * TABLE_SIZE) / SAMPLE_RATE;
			sample = (SINE[(phase | 0) & (TABLE_SIZE - 1)] ?? 0) * Math.exp(-t * 9);
		} else {
			let noise = random() * 2 - 1;
			let high = noise - last;
			last = noise;
			if (drum === "hat") sample = high * 0.5 * Math.exp(-t * 70);
			else {
				phase += (190 * TABLE_SIZE) / SAMPLE_RATE;
				let body = (SINE[(phase | 0) & (TABLE_SIZE - 1)] ?? 0) * Math.exp(-t * 30);
				sample = (noise * 0.6 + body * 0.5) * Math.exp(-t * 16);
			}
		}
		buffer[i] = (buffer[i] ?? 0) + sample * gain;
	}
}

/** The arrangement of a song: which parts play in each section, by section index. */
interface Section {
	pad: boolean;
	bass: boolean;
	drums: boolean;
	lead: boolean;
}

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

/** The tempo a song plays at: its own, or one the seed picks inside the style's range. */
function songTempo(spec: SongSpec, random: () => number): number {
	if (spec.tempo !== undefined) return spec.tempo;
	let [low, high] = STYLES[spec.style].tempo;
	return Math.round(low + (high - low) * random());
}

/**
 * Writes a song as mono samples between -1 and 1. Each bar plays one chord of a progression
 * the seed picks; the lead walks the chord's tones, and an echo and a soft limiter finish it.
 *
 * @param spec What to write.
 * @returns `duration × SAMPLE_RATE` samples.
 * @example renderSong({ seed: 7, style: "lofi", key: 45, mode: "dorian", duration: 150 })
 */
export function renderSong(spec: SongSpec): Float32Array {
	let random = seededRandom(spec.seed);
	let noise = seededRandom(spec.seed ^ 0x9e3779b9);
	let style: StyleRecipe = STYLES[spec.style];
	let tempo = songTempo(spec, random);
	let beat = 60 / tempo;
	let bar = beat * 4;
	let scale = MODES[spec.mode];
	let progression = PROGRESSIONS[Math.floor(random() * PROGRESSIONS.length)] ?? [0, 4, 5, 3];
	let buffer = new Float32Array(Math.ceil(spec.duration * SAMPLE_RATE));
	let bars = Math.floor(spec.duration / bar);
	let sections = planSections(Math.max(3, Math.ceil(bars / style.sectionBars)));
	let leadPattern = Array.from({ length: 16 }, () => random() < style.leadDensity);
	let leadSteps = Array.from({ length: 16 }, () => Math.floor(random() * 4));
	let hatPattern = Array.from({ length: 16 }, (_, step) => step % 2 === 0 || random() < 0.3);

	/** The MIDI note of a scale degree above the key, wrapping into higher octaves. */
	let degree = (value: number, octave: number) => {
		let wrapped = ((value % 7) + 7) % 7;
		let lift = Math.floor(value / 7);
		return spec.key + 12 * (octave + lift) + (scale[wrapped] ?? 0);
	};

	for (let index = 0; index < bars; index++) {
		let section = sections[Math.floor(index / style.sectionBars)] ?? sections[0];
		if (section === undefined) continue;
		let at = index * bar;
		let root = progression[index % progression.length] ?? 0;
		let chord = [root, root + 2, root + 4, root + 6];
		if (section.pad) {
			for (let tone of chord.slice(0, 3)) {
				addVoice(buffer, {
					at,
					length: bar,
					frequency: frequency(degree(tone, 1)),
					gain: style.pad.level / 3,
					table: style.pad.table,
					attack: Math.min(style.pad.attack, bar / 2),
					release: 0.6,
					detune: 1.004,
				});
			}
		}
		if (section.bass) addBass(buffer, style, at, beat, frequency(degree(root, 0)));
		if (section.drums && style.drums !== "none") {
			addBar(buffer, style, at, beat, hatPattern, noise, index % 8 === 7);
		}
		if (section.lead) {
			for (let step = 0; step < 16; step++) {
				if (!leadPattern[step]) continue;
				let tone = chord[leadSteps[(step + index) % 16] ?? 0] ?? root;
				addVoice(buffer, {
					at: at + stepTime(step, beat, style.swing),
					length: beat / 4,
					frequency: frequency(degree(tone, 2)),
					gain: 0.09,
					table: style.lead,
					attack: 0.004,
					release: 0.18,
					decay: 5,
				});
			}
		}
	}
	return master(buffer, style, beat, noise);
}

/** When a sixteenth falls in its bar, with the style's swing on the off-beats. */
function stepTime(step: number, beat: number, swing: number): number {
	let sixteenth = beat / 4;
	return step * sixteenth + (step % 2 === 1 ? sixteenth * swing : 0);
}

/** Adds one bar of bass on the chord's root in the style's rhythm. */
function addBass(
	buffer: Float32Array,
	style: StyleRecipe,
	at: number,
	beat: number,
	pitch: number,
) {
	let hits = BASS_HITS[style.bass.rhythm];
	let length = style.bass.rhythm === "whole" ? beat * 4 : beat * (hits.length > 4 ? 0.4 : 0.8);
	for (let hit of hits) {
		addVoice(buffer, {
			at: at + hit * beat,
			length,
			frequency: pitch,
			gain: 0.2,
			table: style.bass.table,
			attack: 0.006,
			release: 0.08,
			decay: style.bass.rhythm === "whole" ? 0.3 : 2.5,
		});
	}
}

/** Adds one bar of drums in the style's pattern; the last bar of a phrase adds a fill. */
function addBar(
	buffer: Float32Array,
	style: StyleRecipe,
	at: number,
	beat: number,
	hats: boolean[],
	random: () => number,
	fill: boolean,
) {
	let soft = style.drums === "soft" ? 0.6 : 1;
	for (let step of KICKS[style.drums])
		addDrum(buffer, "kick", at + stepTime(step, beat, style.swing), 0.55 * soft, random);
	for (let step of fill ? [4, 12, 14, 15] : [4, 12]) {
		addDrum(buffer, "snare", at + stepTime(step, beat, style.swing), 0.22 * soft, random);
	}
	for (let step = 0; step < 16; step++) {
		if (!hats[step]) continue;
		addDrum(
			buffer,
			"hat",
			at + stepTime(step, beat, style.swing),
			(step % 4 === 2 ? 0.2 : 0.12) * soft,
			random,
		);
	}
}

/**
 * Finishes the mix: a dotted-eighth echo, the record-surface noise, a gentle fade at each end
 * and a soft limiter, so every song sits at the same loudness without clipping.
 */
function master(
	buffer: Float32Array,
	style: StyleRecipe,
	beat: number,
	random: () => number,
): Float32Array {
	let delay = Math.floor(beat * 0.75 * SAMPLE_RATE);
	let fadeIn = Math.floor(0.5 * SAMPLE_RATE);
	let fadeOut = Math.floor(4 * SAMPLE_RATE);
	let smooth = 0;
	for (let i = 0; i < buffer.length; i++) {
		let dry = buffer[i] ?? 0;
		if (i >= delay) dry += (buffer[i - delay] ?? 0) * style.echo;
		if (style.crackle > 0) {
			smooth = smooth * 0.97 + (random() * 2 - 1) * 0.03;
			dry +=
				smooth * style.crackle * 8 +
				(random() < 0.0004 ? (random() - 0.5) * style.crackle * 10 : 0);
		}
		buffer[i] = dry;
	}
	for (let i = 0; i < buffer.length; i++) {
		let sample = buffer[i] ?? 0;
		let gain = Math.min(1, i / fadeIn, (buffer.length - i) / fadeOut);
		buffer[i] = Math.tanh(sample * 1.4) * 0.8 * gain;
	}
	return buffer;
}

/**
 * Wraps mono samples as a 16-bit PCM WAV file, which every browser's `<audio>` plays and seeks.
 *
 * @param samples Mono samples between -1 and 1.
 * @param sampleRate Samples per second. Default: {@link SAMPLE_RATE}.
 * @returns The file's bytes.
 */
export function encodeWav(
	samples: Float32Array,
	sampleRate = SAMPLE_RATE,
): Uint8Array<ArrayBuffer> {
	let bytes = new Uint8Array(44 + samples.length * 2);
	let view = new DataView(bytes.buffer);
	let text = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
	};
	text(0, "RIFF");
	view.setUint32(4, 36 + samples.length * 2, true);
	text(8, "WAVE");
	text(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	text(36, "data");
	view.setUint32(40, samples.length * 2, true);
	for (let i = 0; i < samples.length; i++) {
		let clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
		view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
	}
	return bytes;
}
