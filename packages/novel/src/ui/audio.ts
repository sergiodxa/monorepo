/**
 * The player's Web Audio mixer: one `AudioContext`, a gain per channel under a master gain,
 * music and ambience streamed through media elements, and sounds and voices played from
 * decoded buffers. It reconciles against each frame's audio, so it never replays a sound. A Blob
 * file streams through its object URL and decodes straight from its bytes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Audio, AudioTrack } from "../stage.js";

import type { AudioChannel, NovelSettings } from "./settings.js";

import { objectUrl, pickSource, resolveSource } from "./source.js";

/** How long a changed music track crossfades, unless the track sets its own `fade`. */
const DEFAULT_CROSSFADE_MS = 1000;

/** The music level while a voice speaks, as a fraction of its volume. */
const DUCKED_MUSIC = 0.4;

/** How long the music takes to lower under a voice and to come back. */
const DUCK_MS = 200;

/** A looping track the mixer is streaming. */
interface Stream {
	id: string;
	url: string;
	element: HTMLAudioElement;
	gain: GainNode;
}

/** What the mixer is playing, for a test or a developer panel to read. */
export interface MixerSnapshot {
	music: string | null;
	ambience: string[];
	/** Every sound occurrence started, so a re-rendered frame never plays one again. */
	sounds: string[];
	voice: string | null;
	/** The gain each channel and the master run at. */
	volume: Record<AudioChannel | "master", number>;
	/** The music's level under a voice: 1 normally, lower while a voice speaks. */
	duck: number;
}

/**
 * Mixes a play's five channels. It creates its context on first use, which browsers keep
 * suspended until the reader interacts; call {@link AudioMixer.resume} from that interaction.
 */
export class AudioMixer {
	#context: AudioContext | undefined;
	#master: GainNode | undefined;
	#channels = new Map<AudioChannel, GainNode>();
	#duck: GainNode | undefined;
	#music: Stream | null = null;
	#ambience = new Map<string, Stream>();
	#played = new Set<string>();
	#buffers = new Map<string | Blob, Promise<AudioBuffer | null>>();
	#voice: { url: string; source: AudioBufferSourceNode } | null = null;
	#volume: NovelSettings["volume"];

	/**
	 * Creates a mixer at the given volumes; no audio starts until a frame is reconciled.
	 *
	 * @param volume - The reader's volumes.
	 */
	constructor(volume: NovelSettings["volume"]) {
		this.#volume = { ...volume };
	}

	/** What is playing now. */
	get snapshot(): MixerSnapshot {
		return {
			music: this.#music?.id ?? null,
			ambience: [...this.#ambience.keys()],
			sounds: [...this.#played],
			voice: this.#voice?.url ?? null,
			volume: {
				master: this.#master?.gain.value ?? this.#volume.master,
				music: this.#channels.get("music")?.gain.value ?? this.#volume.music,
				ambience: this.#channels.get("ambience")?.gain.value ?? this.#volume.ambience,
				sound: this.#channels.get("sound")?.gain.value ?? this.#volume.sound,
				voice: this.#channels.get("voice")?.gain.value ?? this.#volume.voice,
				interface: this.#channels.get("interface")?.gain.value ?? this.#volume.interface,
			},
			duck: this.#duck?.gain.value ?? 1,
		};
	}

	/** The context, created with its gain graph on first use. */
	get context(): AudioContext {
		if (this.#context !== undefined) return this.#context;
		let context = new AudioContext();
		let master = context.createGain();
		master.connect(context.destination);
		let duck = context.createGain();
		duck.connect(master);
		for (let channel of ["music", "ambience", "sound", "voice", "interface"] as const) {
			let gain = context.createGain();
			gain.connect(channel === "music" ? duck : master);
			this.#channels.set(channel, gain);
		}
		this.#context = context;
		this.#master = master;
		this.#duck = duck;
		this.setVolume(this.#volume);
		return context;
	}

	/**
	 * Resumes a suspended context; browsers allow it only during a user interaction.
	 *
	 * @returns Once the context runs, or at once when it cannot.
	 */
	async resume(): Promise<void> {
		if (this.context.state !== "suspended") return;
		await this.context.resume().catch(() => undefined);
	}

	/**
	 * Applies the reader's volumes to the channel gains.
	 *
	 * @param volume - The master and per-channel volumes, between 0 and 1.
	 */
	setVolume(volume: NovelSettings["volume"]): void {
		this.#volume = { ...volume };
		if (this.#context === undefined) return;
		if (this.#master !== undefined) this.#master.gain.value = volume.master;
		for (let [channel, gain] of this.#channels) gain.gain.value = volume[channel];
	}

	/**
	 * Brings the mixer in line with a frame's audio: crossfades music, layers and drops ambience,
	 * and starts each sound occurrence not yet played. The voice is started separately, once the
	 * stage has settled.
	 *
	 * @param audio - What each channel should be playing at the frame.
	 * @param locale - The reader's locale, which picks a localized file.
	 * @param silent - Records the frame's sounds as played without playing them, for skip mode.
	 */
	reconcile(audio: Audio, locale: string, silent = false): void {
		this.#reconcileMusic(audio.music, locale);
		let wanted = new Set(audio.ambience.map((track) => track.id));
		for (let [id, stream] of this.#ambience) {
			if (wanted.has(id)) continue;
			this.#fadeOut(stream, DEFAULT_CROSSFADE_MS);
			this.#ambience.delete(id);
		}
		for (let track of audio.ambience) {
			if (this.#ambience.has(track.id)) continue;
			this.#ambience.set(track.id, this.#stream(track, "ambience", locale));
		}
		for (let sound of audio.sounds) {
			if (this.#played.has(sound.occurrence)) continue;
			this.#played.add(sound.occurrence);
			if (silent) continue;
			void this.#playBuffer(pickSource(sound.src, locale), "sound", sound.volume ?? 1);
		}
	}

	/**
	 * Plays a line's voice, stopping the previous one and lowering the music while it speaks.
	 *
	 * @param file - The voice file's URL, or the file itself.
	 * @returns Once the voice ends, is stopped, or fails to load.
	 */
	async playVoice(file: string | Blob): Promise<void> {
		this.stopVoice();
		let url = typeof file === "string" ? file : objectUrl(file);
		let buffer = await this.#buffer(file);
		if (buffer === null) return;
		let source = this.context.createBufferSource();
		source.buffer = buffer;
		source.connect(this.#channels.get("voice") as GainNode);
		this.#voice = { url, source };
		this.#rampDuck(DUCKED_MUSIC);
		let ended = new Promise<void>((resolve) => {
			source.addEventListener("ended", () => resolve(), { once: true });
		});
		source.start();
		await ended;
		if (this.#voice?.source === source) {
			this.#voice = null;
			this.#rampDuck(1);
		}
	}

	/**
	 * Fetches and decodes a sound or voice ahead of its line, so playing it later starts at once.
	 *
	 * @param file - The file's URL, or the file itself.
	 * @returns Once the file is decoded, or failed to load.
	 */
	async preload(file: string | Blob): Promise<void> {
		await this.#buffer(file);
	}

	/**
	 * Plays an interface sound once the context runs. Before the reader's first interaction it
	 * only decodes the file, so sounds never queue up and burst out when the context starts.
	 *
	 * @param file - The sound's URL, or the file itself.
	 */
	playInterface(file: string | Blob): void {
		if (this.context.state !== "running") {
			void this.#buffer(file);
			return;
		}
		void this.#playBuffer(file, "interface", 1);
	}

	/** Stops the voice, which advancing past its line does. */
	stopVoice(): void {
		let voice = this.#voice;
		if (voice === null) return;
		this.#voice = null;
		try {
			voice.source.stop();
		} catch {
			voice.source.disconnect();
		}
		this.#rampDuck(1);
	}

	/** Stops everything and closes the context, when the player leaves the page. */
	dispose(): void {
		this.stopVoice();
		for (let stream of [this.#music, ...this.#ambience.values()]) {
			stream?.element.pause();
		}
		this.#music = null;
		this.#ambience.clear();
		void this.#context?.close().catch(() => undefined);
		this.#context = undefined;
	}

	/** Starts, swaps or stops the music loop, crossfading between tracks. */
	#reconcileMusic(track: AudioTrack | null, locale: string): void {
		let current = this.#music;
		if (track !== null && current?.id === track.id) return;
		if (current !== null) this.#fadeOut(current, track?.fade ?? DEFAULT_CROSSFADE_MS);
		this.#music = track === null ? null : this.#stream(track, "music", locale);
	}

	/** Streams a loop through a media element, fading it in. */
	#stream(track: AudioTrack, channel: AudioChannel, locale: string): Stream {
		let context = this.context;
		let url = resolveSource(track.src, locale);
		let element = new Audio();
		if (new URL(url, location.href).origin !== location.origin) element.crossOrigin = "anonymous";
		element.src = url;
		element.loop = true;
		let gain = context.createGain();
		context.createMediaElementSource(element).connect(gain);
		gain.connect(this.#channels.get(channel) as GainNode);
		let fade =
			track.fade ?? (channel === "music" && this.#music !== null ? DEFAULT_CROSSFADE_MS : 0);
		let level = track.volume ?? 1;
		gain.gain.setValueAtTime(fade > 0 ? 0 : level, context.currentTime);
		if (fade > 0) gain.gain.linearRampToValueAtTime(level, context.currentTime + fade / 1000);
		void element.play().catch(() => undefined);
		return { id: track.id, url, element, gain };
	}

	/** Fades a loop out and releases it. */
	#fadeOut(stream: Stream, fade: number): void {
		let context = this.context;
		let now = context.currentTime;
		stream.gain.gain.cancelScheduledValues(now);
		stream.gain.gain.setValueAtTime(stream.gain.gain.value, now);
		stream.gain.gain.linearRampToValueAtTime(0, now + fade / 1000);
		setTimeout(() => {
			stream.element.pause();
			stream.gain.disconnect();
		}, fade);
	}

	/** Lowers or restores the music under a voice. */
	#rampDuck(level: number): void {
		if (this.#duck === undefined || this.#context === undefined) return;
		let now = this.#context.currentTime;
		this.#duck.gain.cancelScheduledValues(now);
		this.#duck.gain.setValueAtTime(this.#duck.gain.value, now);
		this.#duck.gain.linearRampToValueAtTime(level, now + DUCK_MS / 1000);
	}

	/** Plays a one-shot from its decoded buffer. */
	async #playBuffer(file: string | Blob, channel: AudioChannel, volume: number): Promise<void> {
		let buffer = await this.#buffer(file);
		if (buffer === null) return;
		let source = this.context.createBufferSource();
		source.buffer = buffer;
		let gain = this.context.createGain();
		gain.gain.value = volume;
		source.connect(gain);
		gain.connect(this.#channels.get(channel) as GainNode);
		source.start();
	}

	/**
	 * Decodes a file once, fetching a URL or reading a Blob's bytes, and answers `null` when it
	 * cannot be played.
	 */
	#buffer(file: string | Blob): Promise<AudioBuffer | null> {
		let cached = this.#buffers.get(file);
		if (cached !== undefined) return cached;
		let bytes: Promise<ArrayBuffer | null> =
			typeof file === "string"
				? fetch(file).then((response) => (response.ok ? response.arrayBuffer() : null))
				: file.arrayBuffer();
		let loading = bytes
			.then((data) => (data === null ? null : this.context.decodeAudioData(data)))
			.catch(() => null);
		this.#buffers.set(file, loading);
		return loading;
	}
}
