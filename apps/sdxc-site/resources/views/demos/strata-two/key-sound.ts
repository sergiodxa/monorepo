/**
 * Synthesises Strata Two's key sounds in the browser with Web Audio: a filtered noise click
 * for the stem and a short decaying tone for the case, tuned per switch and per key size.
 * Nothing is downloaded, so the sound board costs no audio files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Which switch the board is fitted with: the soft linear or the tactile one. */
export type SwitchKind = "silk" | "notch";

/** How a switch sounds: the click's centre frequency, the case tone, and the tactile tick. */
interface Voice {
	click: number;
	clickQ: number;
	tone: number;
	toneDecay: number;
	tick: boolean;
}

/**
 * Silk bottoms out deep and round; Notch has a bright tick at the bump before a sharper
 * bottom-out. Values were tuned by ear against each other, not measured from a recording.
 */
const VOICES: Record<SwitchKind, Voice> = {
	silk: { click: 1900, clickQ: 0.9, tone: 170, toneDecay: 0.09, tick: false },
	notch: { click: 3400, clickQ: 1.4, tone: 230, toneDecay: 0.06, tick: true },
};

/** One second of white noise every click is cut from, made once per context. */
let noise: AudioBuffer | undefined;

/** The page's one audio context, created on the first press so autoplay rules are met. */
let context: AudioContext | undefined;

/** The context, created or resumed inside the gesture that needs it. */
function audio(): AudioContext {
	context ??= new AudioContext();
	if (context.state === "suspended") void context.resume();
	if (!noise) {
		noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
		let data = noise.getChannelData(0);
		for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
	}
	return context;
}

/** A burst of band-passed noise starting at `at`, the sound of plastic meeting plastic. */
function click(ctx: AudioContext, at: number, frequency: number, q: number, gain: number) {
	let source = ctx.createBufferSource();
	source.buffer = noise ?? null;
	let filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = frequency * (0.94 + Math.random() * 0.12);
	filter.Q.value = q;
	let envelope = ctx.createGain();
	envelope.gain.setValueAtTime(gain, at);
	envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
	source.connect(filter).connect(envelope).connect(ctx.destination);
	source.start(at, Math.random() * 0.5, 0.05);
}

/** A short falling tone, the case resonating under the plate. */
function thock(ctx: AudioContext, at: number, frequency: number, decay: number, gain: number) {
	let oscillator = ctx.createOscillator();
	oscillator.type = "triangle";
	oscillator.frequency.setValueAtTime(frequency * (0.96 + Math.random() * 0.08), at);
	oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.6, at + decay);
	let envelope = ctx.createGain();
	envelope.gain.setValueAtTime(gain, at);
	envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay);
	oscillator.connect(envelope).connect(ctx.destination);
	oscillator.start(at);
	oscillator.stop(at + decay + 0.02);
}

/**
 * Plays a key going down. Wider keys sound lower, as their longer caps and stabilisers do.
 *
 * @param kind The fitted switch.
 * @param width The key's width in units; the space bar is 6.25.
 */
export function playPress(kind: SwitchKind, width: number) {
	let ctx = audio();
	let voice = VOICES[kind];
	let now = ctx.currentTime;
	let size = 1 / Math.sqrt(Math.max(1, width));
	if (voice.tick) click(ctx, now, voice.click * 1.4, 2, 0.12);
	let bottom = now + (voice.tick ? 0.014 : 0.004);
	click(ctx, bottom, voice.click * (0.6 + size * 0.4), voice.clickQ, 0.5);
	thock(ctx, bottom, voice.tone * (0.55 + size * 0.45), voice.toneDecay * (2 - size), 0.35);
}

/**
 * Plays a key coming back up: a quieter, higher click as the stem returns to the housing.
 *
 * @param kind The fitted switch.
 */
export function playRelease(kind: SwitchKind) {
	let ctx = audio();
	let voice = VOICES[kind];
	click(ctx, ctx.currentTime, voice.click * 1.25, voice.clickQ, 0.16);
}
