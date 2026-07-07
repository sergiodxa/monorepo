/**
 * Web Audio playback for music, sound effects, and creature cries.
 *
 * Three gain channels (bgm, sfx, cries) route through a master gain so volume is
 * adjustable per category. Music crossfades on change and honours intro-then-loop
 * points from the manifest; effects and cries are fire-and-forget. Browsers block
 * audio until a user gesture, so `unlock()` resumes the context from the Boot
 * scene's "press any button" screen. Every method is a safe no-op when a buffer
 * is missing, so the game runs before any audio assets exist.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AssetStore } from "./assets";
import type { SfxName } from "./sfx";

import { playSfx } from "./sfx";

/** A mixable audio category. */
type Channel = "bgm" | "sfx" | "cries";

/** Owns the audio context, channel mixing, and music/effect playback. */
export class AudioManager {
	/** The shared audio context; also used to decode buffers at load time. */
	readonly context: AudioContext = new AudioContext();

	/** Master gain all channels route through. */
	private readonly master = this.context.createGain();

	/** Per-channel gain nodes feeding the master. */
	private readonly channels: Record<Channel, GainNode> = {
		bgm: this.context.createGain(),
		sfx: this.context.createGain(),
		cries: this.context.createGain(),
	};

	/** The currently playing music source, stopped when the track changes. */
	private currentBgm: AudioBufferSourceNode | null = null;

	/** The id of the currently playing track, to avoid restarting it. */
	private currentBgmId: string | null = null;

	/** @param assets - Source of decoded audio buffers and their loop points. */
	constructor(private readonly assets: AssetStore) {
		this.master.connect(this.context.destination);
		for (let channel of Object.values(this.channels)) channel.connect(this.master);
	}

	/** Resumes the audio context; must run inside a user-gesture handler. */
	unlock() {
		if (this.context.state === "suspended") void this.context.resume();
	}

	/** Plays a looping music track, crossfading out the previous one. */
	playBgm(id: string, fadeMs = 400) {
		if (this.currentBgmId === id) return;
		let buffer = this.assets.audioBuffer(id);
		this.stopBgm(fadeMs);
		if (!buffer) {
			this.currentBgmId = id; // remember intent even without the asset
			return;
		}

		let source = this.context.createBufferSource();
		source.buffer = buffer;
		let loop = this.assets.audioLoopPoints(id);
		source.loop = true;
		if (loop.loopStart !== undefined) source.loopStart = loop.loopStart;
		if (loop.loopEnd !== undefined) source.loopEnd = loop.loopEnd;
		source.connect(this.channels.bgm);
		source.start();
		this.currentBgm = source;
		this.currentBgmId = id;
	}

	/** Stops the current music track with a short fade. */
	stopBgm(fadeMs = 400) {
		let source = this.currentBgm;
		this.currentBgm = null;
		this.currentBgmId = null;
		if (!source) return;
		let gain = this.channels.bgm.gain;
		let now = this.context.currentTime;
		try {
			gain.setValueAtTime(gain.value, now);
			gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
		} catch {
			// ignore ramp failures on a suspended context
		}
		try {
			source.stop(now + fadeMs / 1000);
		} catch {
			// already stopped
		}
		// restore channel gain after the fade so future tracks are audible
		globalThis.setTimeout(() => gain.setValueAtTime(1, this.context.currentTime), fadeMs + 20);
	}

	/** Plays a one-shot sound effect; overlapping plays are allowed. */
	playSfx(id: string) {
		this.playOneShot(id, "sfx");
	}

	/**
	 * Plays an original, procedurally-synthesized sound effect on the sfx channel.
	 *
	 * The effect is synthesized on the fly (no asset buffer needed) and routed
	 * through the sfx channel so its volume follows `setVolume("sfx", ...)`. A
	 * zero sfx-channel volume schedules nothing; an unknown name is a no-op.
	 */
	playSynthSfx(name: SfxName | string) {
		// The sfx channel gain node already scales volume, so pass gain: 1 to avoid
		// double-attenuating; gate on the channel volume so a muted channel schedules nothing.
		if (this.channels.sfx.gain.value <= 0) return;
		playSfx(name, { context: this.context, destination: this.channels.sfx, gain: 1 });
	}

	/** Plays a creature cry by its species number. */
	playCry(speciesNumber: number) {
		this.playOneShot(`cry-${speciesNumber}`, "cries");
	}

	/** Sets the volume of one channel in the 0..1 range. */
	setVolume(channel: Channel, value: number) {
		this.channels[channel].gain.value = Math.max(0, Math.min(1, value));
	}

	/** Plays a buffer once on a channel, doing nothing when the buffer is absent. */
	private playOneShot(id: string, channel: Channel) {
		let buffer = this.assets.audioBuffer(id);
		if (!buffer) return;
		let source = this.context.createBufferSource();
		source.buffer = buffer;
		source.connect(this.channels[channel]);
		source.start();
	}
}
