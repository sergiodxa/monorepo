/**
 * Encore's sound effects in the browser: the app's own reveal and shuffle sounds rebuilt from
 * the formulas its SwiftUI code synthesizes them with, plus the page's own ticks and blips, and
 * the reader's on/off choice, remembered in this browser and on by default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The `localStorage` key holding the reader's choice, `"off"` when they muted the page. */
const STORAGE_KEY = "encore:sound";

/** The event the page hears when the reader turns sound on or off, with the new state. */
export const SOUND_CHANGE = "encore:sound-change";

/** One sample of an effect at `time` seconds into an effect `duration` seconds long. */
type Sample = (time: number, duration: number) => number;

/** The app's reveal: a 0.1 s rising chirp from 620 to 980 Hz under a sine envelope. */
function reveal(time: number, duration: number): number {
	let progress = time / duration;
	return Math.sin(2 * Math.PI * (620 + 360 * progress) * time) * Math.sin(Math.PI * progress) * 0.5;
}

/** The app's shuffle: a 0.28 s fluttering tone, like a deck riffled under a thumb. */
function shuffle(time: number, duration: number): number {
	let progress = time / duration;
	let pulses = Math.max(0, Math.sin(2 * Math.PI * 15 * time)) ** 3;
	let frequency = 680 + 180 * Math.sin(2 * Math.PI * 6 * time);
	return Math.sin(2 * Math.PI * frequency * time) * (1 - progress) * (0.35 + 0.65 * pulses) * 0.6;
}

/** A card turning back face down: the reveal's chirp in reverse, falling from 980 to 620 Hz. */
function conceal(time: number, duration: number): number {
	let progress = time / duration;
	return Math.sin(2 * Math.PI * (980 - 360 * progress) * time) * Math.sin(Math.PI * progress) * 0.4;
}

/** A tour step picked: a soft 40 ms tick, a short high note that fades at once. */
function tick(time: number, duration: number): number {
	let progress = time / duration;
	return Math.sin(2 * Math.PI * 1320 * time) * (1 - progress) ** 3 * 0.35;
}

/** Sound turning on: two quick rising notes, a fifth apart. */
function on(time: number, duration: number): number {
	let frequency = time < duration / 2 ? 660 : 990;
	let local = (time % (duration / 2)) / (duration / 2);
	return Math.sin(2 * Math.PI * frequency * time) * Math.sin(Math.PI * local) * 0.4;
}

/** Sound turning off: the same two notes falling. */
function off(time: number, duration: number): number {
	let frequency = time < duration / 2 ? 990 : 660;
	let local = (time % (duration / 2)) / (duration / 2);
	return Math.sin(2 * Math.PI * frequency * time) * Math.sin(Math.PI * local) * 0.4;
}

/** Every effect, with its length in seconds. */
const EFFECTS = {
	reveal: [reveal, 0.1],
	conceal: [conceal, 0.1],
	tick: [tick, 0.04],
	shuffle: [shuffle, 0.28],
	on: [on, 0.16],
	off: [off, 0.16],
} as const satisfies Record<string, readonly [Sample, number]>;

/** The name of one effect. */
export type Effect = keyof typeof EFFECTS;

/** The audio session's kind, which Safari reads to follow the ringer switch. */
interface AudioSessionNavigator {
	audioSession?: { type: string };
}

/** The page's one audio context, made on the first sound so it always follows a tap. */
let context: AudioContext | undefined;

/**
 * Whether the reader wants sound: on unless they muted it in this browser. Storage can be
 * unavailable in a private window, which keeps the default.
 *
 * @returns `true` unless the reader turned sound off.
 */
export function soundOn(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) !== "off";
	} catch {
		return true;
	}
}

/**
 * Records the reader's choice in this browser and tells the page, so every control that
 * shows it follows along.
 *
 * @param enabled Whether sound plays.
 */
export function setSoundOn(enabled: boolean): void {
	remember(enabled);
	window.dispatchEvent(new CustomEvent(SOUND_CHANGE, { detail: enabled }));
}

/**
 * Stores the choice in this browser. Without storage, in a private window, the choice still
 * holds for the page the reader is on through the event that announces it.
 *
 * @returns Whether the browser kept the choice.
 */
function remember(enabled: boolean): boolean {
	try {
		if (enabled) localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, "off");
		return true;
	} catch {
		return false;
	}
}

/**
 * Plays one effect, built sample by sample the way the app builds its buffers. Call it only
 * from a reader's tap; `force` plays even while sound is off, for the blip that turns it off.
 *
 * @param effect The effect to play.
 * @param force Plays whatever the reader's choice.
 */
export function play(effect: Effect, force = false): void {
	if (!force && !soundOn()) return;
	let session = (navigator as AudioSessionNavigator).audioSession;
	if (session) session.type = "ambient";
	context ??= new AudioContext();
	let [sample, duration] = EFFECTS[effect];
	let buffer = context.createBuffer(
		1,
		Math.floor(context.sampleRate * duration),
		context.sampleRate,
	);
	let data = buffer.getChannelData(0);
	for (let frame = 0; frame < data.length; frame++) {
		data[frame] = sample(frame / context.sampleRate, duration);
	}
	let source = context.createBufferSource();
	source.buffer = buffer;
	source.connect(context.destination);
	source.start();
}
