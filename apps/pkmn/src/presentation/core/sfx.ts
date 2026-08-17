/**
 * Original, procedurally-synthesized sound effects for the game.
 *
 * Every effect is defined as plain data: an oscillator type, a short pitch
 * envelope (time-stamped frequency points the oscillator sweeps through), a
 * duration, and a peak gain. `playSfx` reads a definition and schedules the
 * oscillator(s) on a Web Audio context, applying a tiny attack/release so the
 * blips do not click. Nothing here is sampled or copyrighted; the sounds are
 * simple synth shapes (blips, sweeps, arpeggios) built from oscillators alone.
 *
 * The module is safe in a headless or test environment: it never constructs an
 * `AudioContext` itself, and `playSfx` no-ops (without throwing) when no context
 * is supplied and Web Audio is unavailable. Callers that already own a context
 * (the `AudioManager`) pass it in, so effects route through their mixer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The names of every effect the game can synthesize. */
export type SfxName =
	| "menu-move"
	| "menu-confirm"
	| "menu-cancel"
	| "hit"
	| "faint"
	| "heal"
	| "level-up"
	| "encounter";

/**
 * Any effect name a caller may ask for.
 *
 * The `string & {}` branch keeps arbitrary names assignable — callers driven by
 * authored data can pass a name that has no definition, which is a documented
 * no-op — while still offering the {@link SfxName} literals as completions.
 */
export type SfxNameInput = SfxName | (string & {});

/** One time-stamped point in a pitch envelope: `[offsetSeconds, frequencyHz]`. */
export type FrequencyPoint = [offset: number, frequency: number];

/** A single oscillator layer within an effect. */
export interface SfxLayer {
	/** The oscillator waveform. */
	type: OscillatorType;
	/** Pitch envelope, ordered by offset; the first point sets the start pitch. */
	envelope: FrequencyPoint[];
	/** How long the layer sounds, in seconds. */
	duration: number;
	/** Peak gain for the layer, in the 0..1 range (before any mixer scaling). */
	gain: number;
	/** Delay before the layer starts relative to the effect, in seconds. */
	delay?: number;
}

/** A complete sound effect: one or more oscillator layers played together. */
export type SfxDefinition = SfxLayer[];

/** How long the linear attack ramp lasts before a layer reaches its peak gain. */
const ATTACK_SECONDS = 0.005;

/** The smallest audible gain a release ramp targets (never truly zero, to allow exponential ramps). */
const SILENCE_GAIN = 0.0001;

/**
 * The original effect designs, each a small hand-tuned synth patch.
 *
 * Menu blips are single short square/triangle notes; confirm rises two notes,
 * cancel falls two notes. Combat effects lean on sweeps and noise-like square
 * tones: `hit` is a fast downward sawtooth thud, `faint` a long downward sweep,
 * `heal` a gentle upward sine shimmer, `level-up` a three-note major arpeggio,
 * and `encounter` an alternating alarm.
 */
export const SFX_DEFINITIONS: Record<SfxName, SfxDefinition> = {
	"menu-move": [{ type: "square", envelope: [[0, 660]], duration: 0.06, gain: 0.2 }],
	"menu-confirm": [
		{ type: "square", envelope: [[0, 660]], duration: 0.07, gain: 0.25 },
		{ type: "square", envelope: [[0, 990]], duration: 0.09, gain: 0.25, delay: 0.07 },
	],
	"menu-cancel": [
		{ type: "square", envelope: [[0, 440]], duration: 0.07, gain: 0.22 },
		{ type: "square", envelope: [[0, 294]], duration: 0.1, gain: 0.22, delay: 0.07 },
	],
	hit: [
		{
			type: "sawtooth",
			envelope: [
				[0, 320],
				[0.09, 90],
			],
			duration: 0.12,
			gain: 0.3,
		},
	],
	faint: [
		{
			type: "triangle",
			envelope: [
				[0, 520],
				[0.5, 70],
			],
			duration: 0.55,
			gain: 0.3,
		},
	],
	heal: [
		{
			type: "sine",
			envelope: [
				[0, 520],
				[0.25, 780],
			],
			duration: 0.3,
			gain: 0.25,
		},
		{
			type: "sine",
			envelope: [
				[0, 780],
				[0.25, 1040],
			],
			duration: 0.3,
			gain: 0.15,
			delay: 0.08,
		},
	],
	"level-up": [
		{ type: "square", envelope: [[0, 523]], duration: 0.1, gain: 0.22 },
		{ type: "square", envelope: [[0, 659]], duration: 0.1, gain: 0.22, delay: 0.1 },
		{ type: "square", envelope: [[0, 784]], duration: 0.18, gain: 0.24, delay: 0.2 },
	],
	encounter: [
		{ type: "square", envelope: [[0, 880]], duration: 0.09, gain: 0.25 },
		{ type: "square", envelope: [[0, 587]], duration: 0.09, gain: 0.25, delay: 0.1 },
		{ type: "square", envelope: [[0, 880]], duration: 0.12, gain: 0.25, delay: 0.2 },
	],
};

/** Options controlling where and how loud an effect plays. */
export interface PlaySfxOptions {
	/**
	 * The audio context to schedule on. When omitted, a global `AudioContext` is
	 * required to play; without one the call is a safe no-op.
	 */
	context?: AudioContext;
	/**
	 * The node the effect connects to (e.g. a channel gain). Defaults to the
	 * context's `destination` when omitted.
	 */
	destination?: AudioNode;
	/** Overall gain multiplier applied to every layer, in the 0..1 range. Defaults to 1. */
	gain?: number;
}

/** Returns true when Web Audio can be used in the current environment. */
export function isAudioSupported(): boolean {
	return typeof globalThis !== "undefined" && typeof globalThis.AudioContext !== "undefined";
}

/**
 * Synthesizes and plays one sound effect, scheduling its oscillator layers.
 *
 * Unknown names, a missing context (with no global `AudioContext`), and a
 * non-zero-effective-gain of zero are all safe no-ops. Never throws: any Web
 * Audio failure is swallowed so audio can never crash the game.
 *
 * @param name - The effect to play.
 * @param options - Where to route it and how loud, see {@link PlaySfxOptions}.
 */
export function playSfx(name: SfxNameInput, options: PlaySfxOptions = {}): void {
	let definition = (SFX_DEFINITIONS as Record<string, SfxDefinition | undefined>)[name];
	if (!definition) return;

	// A context is required to schedule anything. In a headless/test environment
	// there is no global AudioContext and no caller-supplied one, so we no-op.
	let context = options.context;
	if (!context) return;

	let masterGain = options.gain ?? 1;
	if (masterGain <= 0) return;

	let destination = options.destination ?? context.destination;

	try {
		let now = context.currentTime;
		for (let layer of definition) playLayer(context, destination, layer, masterGain, now);
	} catch {
		// Web Audio can throw on a closed/suspended context; audio must never crash the game.
	}
}

/** Schedules a single oscillator layer of an effect. */
function playLayer(
	context: AudioContext,
	destination: AudioNode,
	layer: SfxLayer,
	masterGain: number,
	now: number,
): void {
	let start = now + (layer.delay ?? 0);
	let end = start + layer.duration;
	let peak = layer.gain * masterGain;

	let oscillator = context.createOscillator();
	oscillator.type = layer.type;

	let [firstOffset, firstFrequency] = layer.envelope[0] ?? [0, 440];
	oscillator.frequency.setValueAtTime(firstFrequency, start + firstOffset);
	for (let index = 1; index < layer.envelope.length; index++) {
		let [offset, frequency] = layer.envelope[index]!;
		oscillator.frequency.linearRampToValueAtTime(frequency, start + offset);
	}

	let gain = context.createGain();
	gain.gain.setValueAtTime(SILENCE_GAIN, start);
	gain.gain.linearRampToValueAtTime(peak, start + ATTACK_SECONDS);
	gain.gain.exponentialRampToValueAtTime(SILENCE_GAIN, end);

	oscillator.connect(gain);
	gain.connect(destination);
	oscillator.start(start);
	oscillator.stop(end);
}
