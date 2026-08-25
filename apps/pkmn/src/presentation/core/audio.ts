/**
 * Three gain channels (bgm, sfx, cries) route through a master gain, each
 * independently adjustable. Music crossfades on change and honours
 * intro-then-loop points from the manifest. Browsers block audio until a user
 * gesture, so `unlock()` resumes the context from the Boot scene. Every method
 * is a safe no-op when a buffer is missing, so the game runs before assets exist.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AssetStore } from "./assets";
import type { SfxNameInput } from "./sfx";

import { playSfx } from "./sfx";

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

	/**
	 * Plays a looping music track, crossfading out the previous one. Remembers
	 * the track id even when its buffer is missing, so a later call with the
	 * same id does not retry the lookup.
	 */
	playBgm(id: string, fadeMs = 400) {
		if (this.currentBgmId === id) return;
		let buffer = this.assets.audioBuffer(id);
		this.stopBgm(fadeMs);
		if (!buffer) {
			this.currentBgmId = id;
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

	/**
	 * Stops the current music track with a short fade, then restores channel
	 * gain after the fade so the next track is audible. Ramp and stop failures
	 * are ignored: the context may be suspended, or the source already stopped.
	 */
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
		} catch {}
		try {
			source.stop(now + fadeMs / 1000);
		} catch {}
		globalThis.setTimeout(() => gain.setValueAtTime(1, this.context.currentTime), fadeMs + 20);
	}

	/** Plays a one-shot sound effect; overlapping plays are allowed. */
	playSfx(id: string) {
		this.playOneShot(id, "sfx");
	}

	/**
	 * Plays a procedurally-synthesized effect on the sfx channel. Passes
	 * gain: 1 since the channel node already scales volume, avoiding double
	 * attenuation, and skips scheduling entirely when the channel is muted.
	 */
	playSynthSfx(name: SfxNameInput) {
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
