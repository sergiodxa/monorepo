# @sdxc/synth

A deterministic software synthesizer: instruments, notes and scores rendered to PCM and WAV, with a seeded song generator on top.

## Installation

```sh
npm add @sdxc/synth
```

## Usage

Write a score by hand and render it to a WAV file:

```ts
import { PRESETS, encodeWav, renderScore } from "@sdxc/synth";

let samples = renderScore({
	tempo: 100,
	tracks: [
		{
			instrument: PRESETS.pluck,
			notes: [
				{ at: 0, length: 1, pitch: "C4" },
				{ at: 1, length: 1, pitch: "E4" },
				{ at: 2, length: 2, pitch: "G4", velocity: 1 },
			],
		},
	],
});

let wav = encodeWav(samples); // 16-bit mono PCM at 44.1 kHz
```

Build chords and repeating patterns, and put effects on a track or the whole mix:

```ts
import { PRESETS, chord, chordNotes, concat, pattern, renderScore, repeat } from "@sdxc/synth";

let progression = concat(
	pattern(chordNotes(chord("C3", "maj7"), 0, 4), 4),
	pattern(chordNotes(chord("A2", "min7"), 0, 4), 4),
);

let samples = renderScore({
	tempo: 90,
	tracks: [
		{ instrument: PRESETS.pad, notes: repeat(progression, 4).notes, gain: 0.5 },
		{
			instrument: PRESETS.kick,
			notes: repeat(pattern([{ at: 0, length: 0.25, pitch: 36 }], 1), 32).notes,
		},
	],
	effects: [{ type: "reverb", size: 0.6, mix: 0.25 }],
});
```

Let a seed write the score instead:

```ts
import { encodeWav, renderSong } from "@sdxc/synth";

let samples = renderSong(
	{ seed: 7, style: "lofi", key: "A2", mode: "dorian", duration: 150 },
	{ sampleRate: 22_050 },
);
let wav = encodeWav(samples, 22_050);
```

The same score, or the same seed, gives the same samples on every run, in a browser, a Worker or Node.

## API

### Rendering

#### `renderScore(score: Score, options?: RenderOptions): Float32Array`

Renders a score to mono samples between -1 and 1. Options: `sampleRate` (default `44100`),
`tail` (seconds kept after the last beat; default none when the score sets `length`, else the
longest release), and `limit` (a soft limiter, default `true`).

#### `encodeWav(samples: Float32Array, sampleRate?: number): Uint8Array`

Wraps mono samples as a 16-bit PCM WAV file, clipping past full scale.

#### `envelopeLevel(envelope: Envelope, held: number, time: number): number`

An envelope's level at a time into a note held for `held` seconds.

#### `DEFAULT_SAMPLE_RATE`

`44100`.

### Scores

A `Score` has a `tempo` in beats per minute, an optional `meter` (`[4, 4]`), an optional
`length` in beats, `tracks`, master `effects`, and a `seed` for noise. A `Track` plays `notes` on
an `instrument` with a `gain` and its own `effects`. A `Note` has `at` and `length` in beats, a
`pitch`, and a `velocity` from 0 to 1.

#### `pattern(notes: Note[], length?: number): Pattern`

A run of notes that occupies `length` beats, or until its last note ends.

#### `repeat(pattern: Pattern, times: number): Pattern` and `concat(...patterns: Pattern[]): Pattern`

Play a pattern back to back, or join patterns end to end.

#### `shift(notes: Note[], beats: number): Note[]` and `transpose(notes: Note[], semitones: number): Note[]`

Move notes in time or in pitch.

#### `chordNotes(pitches: Pitch[], at: number, length: number, velocity?: number): Note[]`

A chord's pitches as notes that start together.

#### `scoreBeats(score: Score): number` and `beatSeconds(tempo: number): number`

How many beats a score lasts, and how long one beat is.

### Pitch

#### `noteNumber(pitch: Pitch): number`

A MIDI note number from a number or a name such as `"C#4"` or `"Bb2"` (C4 is 60). Throws a
`RangeError` for a name that is not a note.

#### `frequency(pitch: Pitch): number`

Hertz in equal temperament, A4 at 440.

#### `chord(root: Pitch, quality?: ChordQuality): number[]`

A chord's pitches: `major`, `minor`, `dim`, `aug`, `sus2`, `sus4`, `maj7`, `min7`, `dom7` or `add9`.

#### `scaleNote(root: Pitch, mode: Mode, degree: number): number` and `scaleChord(root, mode, degree, size?): number[]`

A scale step by degree from zero, and the chord stacked on it. Modes: `major`, `minor`,
`dorian`, `phrygian`, `lydian`, `mixolydian`, `pentatonic` and `blues` (`MODES`, `CHORDS`).

### Instruments

An `Instrument` mixes `oscillators` (`sine`, `triangle`, `saw`, `square` or `noise`, each with
`gain`, `detune` in cents and `octave`), shapes them with an ADSR `envelope`, and optionally runs
a resonant `filter` (`lowpass`, `highpass` or `bandpass`, with `cutoff`, `resonance`, an
`envelope` amount and keyboard `tracking`), a pitch `sweep`, a `fixedPitch` for drums, and a `gain`.

#### `PRESETS`

`pad`, `keys`, `bass`, `subBass`, `pluck`, `lead`, `bell`, `organ`, `kick`, `snare`, `hat` and
`clap`, each a plain instrument to use or spread and change.

### Effects

`{ type: "delay", time, feedback?, mix? }` with `time` in beats, `{ type: "reverb", size?, mix? }`,
`{ type: "drive", amount? }`, and `{ type: "lowpass" | "highpass", cutoff }`, applied in order.

#### `applyEffects(samples: Float32Array, effects: Effect[], context: EffectContext): Float32Array`

Runs a chain over samples in place, for sound you made yourself.

### Generation

#### `generateSong(spec: SongSpec): Score`

Writes a score from a `seed`, a `style` (`ambient`, `lofi`, `synthpop`, `house`, `downtempo` or
`cinematic`), a `key`, a `mode`, a `duration` in seconds and an optional `tempo`. The result is an
ordinary score to inspect, change or render.

#### `renderSong(spec: SongSpec, options?: RenderOptions): Float32Array`

`generateSong` and `renderScore` in one step, with a short fade at each end.

#### `seededRandom(seed: number): () => number` and `seedFrom(text: string): number`

A repeatable random sequence, and a seed from a string such as a track's id.

## Patterns

### Play a generated song in a browser

```ts
import { encodeWav, renderSong, seedFrom } from "@sdxc/synth";

function play(trackId: string) {
	let samples = renderSong(
		{ seed: seedFrom(trackId), style: "downtempo", key: "D2", mode: "minor", duration: 180 },
		{ sampleRate: 22_050 },
	);
	let url = URL.createObjectURL(new Blob([encodeWav(samples, 22_050)], { type: "audio/wav" }));
	let audio = new Audio(url);
	void audio.play();
	return audio;
}
```

A real `<audio>` element seeks, reports its time, and shows on the lock screen through the
[Media Session API](https://developer.mozilla.org/docs/Web/API/Media_Session_API).

### Change a generated song before rendering

```ts
import { PRESETS, generateSong, renderScore } from "@sdxc/synth";

let score = generateSong({ seed: 3, style: "house", key: "F2", mode: "minor", duration: 60 });
let lead = score.tracks.find((track) => track.name === "lead");
if (lead) lead.instrument = PRESETS.bell;
let samples = renderScore(score);
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/synth": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
