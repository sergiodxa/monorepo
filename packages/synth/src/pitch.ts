/**
 * Pitch as music is written: note names to MIDI numbers to hertz, scales by mode, and chords
 * by quality, so a score can say `"C#4"` or `chord("A3", "min7")` instead of frequencies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A pitch: a MIDI note number (60 is middle C) or a name such as `"C4"`, `"F#3"` or `"Bb2"`. */
export type Pitch = number | string;

/** The semitone of each natural note above C. */
const NATURALS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The semitones each mode climbs from its root. */
export const MODES = {
	major: [0, 2, 4, 5, 7, 9, 11],
	minor: [0, 2, 3, 5, 7, 8, 10],
	dorian: [0, 2, 3, 5, 7, 9, 10],
	phrygian: [0, 1, 3, 5, 7, 8, 10],
	lydian: [0, 2, 4, 6, 7, 9, 11],
	mixolydian: [0, 2, 4, 5, 7, 9, 10],
	pentatonic: [0, 2, 4, 7, 9],
	blues: [0, 3, 5, 6, 7, 10],
} as const;

/** A scale a melody or a chord progression can be written in. */
export type Mode = keyof typeof MODES;

/** The intervals of each chord quality above its root. */
export const CHORDS = {
	major: [0, 4, 7],
	minor: [0, 3, 7],
	dim: [0, 3, 6],
	aug: [0, 4, 8],
	sus2: [0, 2, 7],
	sus4: [0, 5, 7],
	maj7: [0, 4, 7, 11],
	min7: [0, 3, 7, 10],
	dom7: [0, 4, 7, 10],
	add9: [0, 4, 7, 14],
} as const;

/** A chord quality. */
export type ChordQuality = keyof typeof CHORDS;

/**
 * Reads a pitch as a MIDI note number. Names take a letter, any number of `#` or `b`, and an
 * octave where C4 is 60.
 *
 * @param pitch A MIDI number or a note name.
 * @returns The MIDI note number.
 * @throws {RangeError} When a name is not a note.
 * @example noteNumber("A4") // 69
 * @example noteNumber("Bb2") // 46
 */
export function noteNumber(pitch: Pitch): number {
	if (typeof pitch === "number") return pitch;
	let match = /^([A-Ga-g])([#b]*)(-?\d+)$/.exec(pitch.trim());
	if (match === null) throw new RangeError(`Not a note name: ${pitch}`);
	let [, letter = "C", accidentals = "", octave = "4"] = match;
	let shift = accidentals.split("").reduce((sum, mark) => sum + (mark === "#" ? 1 : -1), 0);
	return (Number(octave) + 1) * 12 + (NATURALS[letter.toUpperCase()] ?? 0) + shift;
}

/**
 * The frequency of a pitch in equal temperament, A4 tuned to 440 Hz.
 *
 * @param pitch A MIDI number (fractions bend it) or a note name.
 * @example frequency("A4") // 440
 */
export function frequency(pitch: Pitch): number {
	return 440 * 2 ** ((noteNumber(pitch) - 69) / 12);
}

/**
 * The pitches of a chord on a root, lowest first.
 *
 * @param root The chord's root.
 * @param quality Its quality. Default: `"major"`.
 * @example chord("A3", "min7") // [57, 60, 64, 67]
 */
export function chord(root: Pitch, quality: ChordQuality = "major"): number[] {
	let base = noteNumber(root);
	return CHORDS[quality].map((interval) => base + interval);
}

/**
 * A note of a scale by its degree from zero, climbing octaves past the last step and falling
 * below the root for a negative degree.
 *
 * @param root The scale's root.
 * @param mode The scale.
 * @param degree Zero for the root, one for the next step, and so on.
 * @example scaleNote("C4", "major", 4) // 67, the G above
 * @example scaleNote("C4", "major", 7) // 72, C an octave up
 */
export function scaleNote(root: Pitch, mode: Mode, degree: number): number {
	let steps = MODES[mode];
	let size = steps.length;
	let wrapped = ((degree % size) + size) % size;
	let octave = Math.floor(degree / size);
	return noteNumber(root) + 12 * octave + (steps[wrapped] ?? 0);
}

/**
 * The chord built on a degree of a scale by stacking every other step, the way a progression
 * such as I–V–vi–IV picks its chords.
 *
 * @param root The scale's root.
 * @param mode The scale.
 * @param degree The chord's root degree, from zero.
 * @param size How many notes to stack. Default: 3.
 * @example scaleChord("C4", "major", 5) // [69, 72, 76], A minor
 */
export function scaleChord(root: Pitch, mode: Mode, degree: number, size = 3): number[] {
	return Array.from({ length: size }, (_, index) => scaleNote(root, mode, degree + index * 2));
}
