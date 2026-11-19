/**
 * Music as data: notes placed in beats, tracks that play them on an instrument through
 * effects, and a score with a tempo and meter. Patterns are reusable runs of notes that
 * repeat, join and shift, so a score is written by hand as easily as it is generated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Effect } from "./effects.js";
import type { Instrument } from "./instrument.js";
import type { Pitch } from "./pitch.js";

import { noteNumber } from "./pitch.js";

/** One note: where it starts and how long it lasts in beats, its pitch and how hard it is played. */
export interface Note {
	/** Beats from the start of the score (or of the pattern holding it). */
	at: number;
	/** Beats it is held before its release. */
	length: number;
	pitch: Pitch;
	/** From 0 to 1. Default: 0.8. */
	velocity?: number;
}

/** One part of a score: an instrument, the notes it plays, and the effects on its sound. */
export interface Track {
	name?: string;
	instrument: Instrument;
	notes: Note[];
	/** The track's level in the mix. Default: 1. */
	gain?: number;
	/** Applied in order to the track alone. */
	effects?: Effect[];
}

/** A whole piece: its tempo and meter, its tracks, and what runs over the mix. */
export interface Score {
	/** Beats per minute. */
	tempo: number;
	/** Beats per bar and the beat's note value, such as `[3, 4]`. Default: `[4, 4]`. */
	meter?: [number, number];
	/** Beats the piece lasts; the end of its last note when omitted. */
	length?: number;
	tracks: Track[];
	/** Applied in order to the whole mix. */
	effects?: Effect[];
	/** Seeds the noise oscillators, so a render is the same every time. Default: 1. */
	seed?: number;
}

/** A run of notes and how many beats it occupies, to repeat or join with others. */
export interface Pattern {
	length: number;
	notes: Note[];
}

/**
 * Makes a pattern from notes, its length the end of its last note unless given.
 *
 * @param notes Notes placed from the pattern's own start.
 * @param length Beats it occupies, such as a full bar for a phrase with a rest at its end.
 * @example pattern([{ at: 0, length: 1, pitch: "C4" }], 4)
 */
export function pattern(notes: Note[], length?: number): Pattern {
	return { length: length ?? notesEnd(notes), notes };
}

/**
 * Plays a pattern several times back to back.
 *
 * @param source The pattern.
 * @param times How many times.
 */
export function repeat(source: Pattern, times: number): Pattern {
	return concat(...Array.from({ length: Math.max(0, times) }, () => source));
}

/**
 * Joins patterns end to end into one.
 *
 * @param patterns In playing order.
 */
export function concat(...patterns: Pattern[]): Pattern {
	let notes: Note[] = [];
	let offset = 0;
	for (let part of patterns) {
		notes.push(...shift(part.notes, offset));
		offset += part.length;
	}
	return { length: offset, notes };
}

/**
 * Moves notes later (or earlier, for a negative offset) by a number of beats.
 *
 * @param notes The notes.
 * @param beats How far.
 */
export function shift(notes: readonly Note[], beats: number): Note[] {
	return notes.map((note) => ({ ...note, at: note.at + beats }));
}

/**
 * Moves notes up or down in pitch.
 *
 * @param notes The notes.
 * @param semitones How far; negative goes down.
 */
export function transpose(notes: readonly Note[], semitones: number): Note[] {
	return notes.map((note) => ({ ...note, pitch: noteNumber(note.pitch) + semitones }));
}

/**
 * Writes a chord as notes that start together.
 *
 * @param pitches The chord's pitches.
 * @param at Where it starts, in beats.
 * @param length How long it is held, in beats.
 * @param velocity How hard. Default: 0.8.
 * @example chordNotes(chord("C3", "maj7"), 0, 4)
 */
export function chordNotes(
	pitches: readonly Pitch[],
	at: number,
	length: number,
	velocity = 0.8,
): Note[] {
	return pitches.map((pitch) => ({ at, length, pitch, velocity }));
}

/** The beat where the last of some notes ends, or 0 for none. */
function notesEnd(notes: readonly Note[]): number {
	return notes.reduce((end, note) => Math.max(end, note.at + note.length), 0);
}

/**
 * How many beats a score lasts: its `length`, or where its last note ends.
 *
 * @param score The score.
 */
export function scoreBeats(score: Score): number {
	return score.length ?? Math.max(0, ...score.tracks.map((track) => notesEnd(track.notes)));
}

/**
 * How long one beat lasts at a tempo, in seconds.
 *
 * @param tempo Beats per minute.
 */
export function beatSeconds(tempo: number): number {
	return 60 / tempo;
}
