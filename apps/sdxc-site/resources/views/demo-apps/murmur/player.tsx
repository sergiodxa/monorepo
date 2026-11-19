/**
 * Murmur's player: one `<audio>` outside the swapped `main` frame, so the music never stops
 * while the listener browses. It takes over every play form on the page, keeps the queue,
 * shuffle, repeat and volume, drives the bar, the phone's mini player, the queue panel and
 * the now-playing view, and hands the track to the system through the Media Session API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PlayQueue } from "@sdxc/ui/audio";
import type { Handle } from "remix/component";

import {
	ChevronDownIcon,
	ListMusicIcon,
	Maximize2Icon,
	PauseIcon,
	PlayIcon,
	Repeat1Icon,
	RepeatIcon,
	ShuffleIcon,
	SkipBackIcon,
	SkipForwardIcon,
	Volume1Icon,
	Volume2Icon,
	VolumeXIcon,
	XIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import {
	PlayerBar,
	QueueList,
	syncMediaSession,
	createPlayQueue,
	currentIndex,
	cycleRepeat,
	jumpTo,
	nextInQueue,
	previousInQueue,
	toggleShuffle,
	upcoming,
} from "@sdxc/ui/audio";
import { clientEntry, on, ref } from "remix/component";

import type { Track } from "./data";
import type { NowPlaying } from "./state";

import { albumArt } from "./art";
import {
	artistName,
	contextPlace,
	contextTracks,
	findAlbum,
	findTrack,
	href,
	songSpec,
} from "./data";
import { NOW_COOKIE, nowPlayingValue, readListener } from "./state";
import { encodeWav, renderSong } from "./synth";

/** The id of the queue panel, a popover. */
export const QUEUE_PANEL = "murmur-queue";

/** The name of the sidebar's library frame, which reloads after a save, like or follow. */
export const LIBRARY_FRAME = "murmur-library";

/** The id of the now-playing view, a modal dialog. */
export const NOW_VIEW = "murmur-now";

/** From here the desktop bar shows; under it the mini player does. */
export const DESKTOP = "(min-width: 48rem)";

/** How many rendered tracks stay in memory, the playing one and those around it. */
const SOURCE_CACHE = 4;

/** Where the listener's volume is remembered between visits. */
const VOLUME_KEY = "murmur.volume";

/** The cookie path the player writes what plays under, the same the server uses. */
const COOKIE_PATH = href();

/** What the listener sees for each repeat mode, and its button's name. */
const REPEAT_LABELS: Record<PlayQueue.Repeat, string> = {
	off: "Enable repeat",
	all: "Enable repeat one",
	one: "Disable repeat",
};

namespace MurmurPlayer {
	/** What the server knows was last playing, with the ids of the list it plays from. */
	export interface Initial extends NowPlaying {
		tracks: string[];
	}

	export interface Props {
		/** The last track played, drawn paused until the listener presses play. */
		initial: Initial | null;
	}
}

/**
 * The player island. Its first render, on the server and at hydration, shows the cookie's
 * track paused; every later change comes from the listener or the media itself.
 */
export const MurmurPlayer = clientEntry(
	import.meta.url,
	function MurmurPlayer(handle: Handle<MurmurPlayer.Props>) {
		let initial = handle.props.initial;
		let context = initial?.context ?? "";
		let list: Track[] = (initial?.tracks ?? [])
			.map(findTrack)
			.filter((track) => track !== undefined);
		let start = initial === null ? -1 : list.findIndex((track) => track.id === initial.track);
		let queue: PlayQueue.State | null = start === -1 ? null : createPlayQueue(list.length, start);
		let playing = false;
		let time = 0;
		let duration = 0;
		let volume = 0.8;
		let muted = false;
		let loadedId: string | null = null;
		let audio: HTMLAudioElement | undefined;
		let canvas: HTMLCanvasElement | undefined;
		let sources = new Map<string, string>();
		let session: AbortController | undefined;
		let visuals: { context: AudioContext; analyser: AnalyserNode } | undefined;
		let frame = 0;
		let viewOpen = false;
		let libraryStale = false;

		/** The track the queue is on, if any. */
		function current(): Track | undefined {
			let index = queue === null ? undefined : currentIndex(queue);
			return index === undefined ? undefined : list[index];
		}

		/**
		 * The address of a track's sound, written by the synthesizer on first use and kept for
		 * the next few plays; the oldest beyond the cache is released, never the one playing.
		 */
		function sourceFor(track: Track): string {
			let cached = sources.get(track.id);
			if (cached !== undefined) return cached;
			let bytes = encodeWav(renderSong(songSpec(track)));
			let url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
			sources.set(track.id, url);
			for (let [id, old] of sources) {
				if (sources.size <= SOURCE_CACHE) break;
				if (id === track.id || id === loadedId) continue;
				URL.revokeObjectURL(old);
				sources.delete(id);
			}
			return url;
		}

		/** Writes what plays to the cookie the server reads, so a reload shows the same track. */
		function remember(track: Track) {
			let value = nowPlayingValue({ context, track: track.id });
			document.cookie = `${NOW_COOKIE}=${value}; Path=${COOKIE_PATH}; Max-Age=604800; SameSite=Lax`;
		}

		/**
		 * Loads the queue's track into the media element and, when asked, starts it. The sound
		 * is written after the next paint, so the bar shows the new track while it renders.
		 */
		async function load(autoplay: boolean) {
			let track = current();
			if (track === undefined || audio === undefined) return;
			time = 0;
			duration = track.duration;
			void handle.update();
			await new Promise((resolve) => setTimeout(resolve, 16));
			if (current() !== track) return;
			let media = audio;
			let src = sourceFor(track);
			if (loadedId !== track.id) {
				media.src = src;
				loadedId = track.id;
			} else media.currentTime = 0;
			remember(track);
			publish(track);
			markPage();
			if (autoplay) await media.play().catch(() => undefined);
			void handle.update();
			prefetchNext();
		}

		/** Writes the next track's sound while the current one plays, so Next starts at once. */
		function prefetchNext() {
			if (queue === null) return;
			let next = upcoming(queue, 1)[0];
			let track = next === undefined ? undefined : list[next];
			if (track === undefined || sources.has(track.id)) return;
			setTimeout(() => {
				if (!handle.signal.aborted) sourceFor(track);
			}, 1500);
		}

		/** Starts or pauses; with nothing loaded yet, loads the queue's track and plays it. */
		async function toggle() {
			if (audio === undefined || current() === undefined) return;
			if (loadedId !== current()?.id) return await load(true);
			if (audio.paused) await audio.play().catch(() => undefined);
			else audio.pause();
		}

		/** Moves on: by the listener's press, or because the track ended by itself. */
		async function next(ended = false) {
			if (queue === null) return;
			let moved = nextInQueue(queue, ended);
			if (moved === null) {
				queue = { ...queue, position: 0 };
				await load(false);
				return;
			}
			queue = moved;
			await load(true);
		}

		/** Restarts the track, or goes back one when it has barely started. */
		async function previous() {
			if (queue === null || audio === undefined) return;
			let result = previousInQueue(queue, audio.currentTime);
			queue = result.queue;
			if (result.restart) {
				audio.currentTime = 0;
				return;
			}
			await load(true);
		}

		/** Moves the media to a time, clamped to the track. */
		function seek(to: number) {
			if (audio === undefined || !Number.isFinite(to)) return;
			audio.currentTime = Math.max(0, Math.min(to, audio.duration || duration));
			time = audio.currentTime;
			void handle.update();
		}

		/**
		 * Plays a list from a play form: the rows on the page when the form sits among them,
		 * so the queue is exactly what the listener sees, or the catalogue's list otherwise.
		 * Pressing play on the list already playing pauses or resumes it instead.
		 */
		async function playFrom(form: HTMLFormElement) {
			let wanted = form.dataset.context ?? "";
			let track = form.dataset.track;
			let shuffle = form.hasAttribute("data-shuffle");
			let playingNow = current();
			if (!shuffle && wanted === context && (track === undefined || track === playingNow?.id)) {
				return await toggle();
			}
			let container = form.closest<HTMLElement>("[data-track-context]");
			let rows =
				container?.dataset.trackContext === wanted
					? [...container.querySelectorAll<HTMLElement>("[data-track-id]")]
							.map((row) => findTrack(row.dataset.trackId ?? ""))
							.filter((entry) => entry !== undefined)
					: [];
			let tracks =
				rows.length > 0 ? rows : contextTracks(wanted, readListener(document.cookie).liked);
			if (tracks.length === 0) return;
			let first = track === undefined ? -1 : tracks.findIndex((entry) => entry.id === track);
			if (first === -1) first = shuffle ? Math.floor(Math.random() * tracks.length) : 0;
			context = wanted;
			list = tracks;
			queue = createPlayQueue(tracks.length, first, {
				shuffle: shuffle || (queue?.shuffle ?? false),
				repeat: queue?.repeat ?? "off",
			});
			await load(true);
		}

		/**
		 * Marks the page for what plays: the playing row in every track table, the list's play
		 * buttons as Pause, and the paused state the equalizers hold still for.
		 */
		function markPage() {
			let root = document.documentElement;
			let track = current();
			root.toggleAttribute("data-audio-paused", audio?.paused ?? true);
			if (track === undefined) root.removeAttribute("data-now-context");
			else root.setAttribute("data-now-context", context);
			for (let container of document.querySelectorAll<HTMLElement>("[data-track-context]")) {
				let mine =
					container.dataset.trackContext === context ||
					container.dataset.trackContext?.startsWith("search:");
				for (let row of container.querySelectorAll<HTMLElement>("[data-track-id]")) {
					let isCurrent = mine && row.dataset.trackId === track?.id && loadedId !== null;
					if (isCurrent) row.setAttribute("aria-current", "true");
					else row.removeAttribute("aria-current");
				}
			}
			let paused = audio?.paused ?? true;
			for (let button of document.querySelectorAll<HTMLElement>("[data-play-context]")) {
				let active = button.dataset.playContext === context && !paused;
				let label = active ? button.dataset.labelPause : button.dataset.labelPlay;
				if (label !== undefined) button.setAttribute("aria-label", label);
			}
		}

		/** Hands the track to the operating system's media controls. */
		function publish(track: Track) {
			if (audio === undefined) return;
			session?.abort();
			session = new AbortController();
			let entry = findAlbum(track.album);
			let art = entry === undefined ? undefined : new URL(albumArt(entry), location.href).href;
			let metadata = {
				title: track.title,
				artist: track.artists.map(artistName).join(", "),
				album: entry?.title,
				artwork: art === undefined ? [] : [{ src: art, sizes: "600x600", type: "image/svg+xml" }],
			};
			let actions = {
				play: () => void audio?.play().catch(() => undefined),
				pause: () => audio?.pause(),
				next: () => void next(),
				previous: () => void previous(),
				seek,
			};
			syncMediaSession(audio, metadata, actions, session.signal);
			if (art !== undefined) void rasterize(art, track.id, metadata, actions);
		}

		/**
		 * Draws the cover into a PNG for platforms whose media controls show no SVG, then
		 * publishes it, as long as the same track still plays.
		 */
		async function rasterize(
			art: string,
			trackId: string,
			metadata: Parameters<typeof syncMediaSession>[1] & object,
			actions: Parameters<typeof syncMediaSession>[2],
		) {
			try {
				let image = new Image();
				image.src = art;
				await image.decode();
				let surface = document.createElement("canvas");
				surface.width = 512;
				surface.height = 512;
				surface.getContext("2d")?.drawImage(image, 0, 0, 512, 512);
				let blob = await new Promise<Blob | null>((resolve) =>
					surface.toBlob(resolve, "image/png"),
				);
				if (blob === null || current()?.id !== trackId || audio === undefined) return false;
				session?.abort();
				session = new AbortController();
				let png = URL.createObjectURL(blob);
				syncMediaSession(
					audio,
					{ ...metadata, artwork: [{ src: png, sizes: "512x512", type: "image/png" }] },
					actions,
					session.signal,
				);
				session.signal.addEventListener("abort", () => URL.revokeObjectURL(png));
				return true;
			} catch {
				return false;
			}
		}

		/** Starts the analyser behind the now-playing view's visuals, once, on a press. */
		function startVisuals() {
			if (visuals !== undefined || audio === undefined) return;
			if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
			try {
				let audioContext = new AudioContext();
				let source = audioContext.createMediaElementSource(audio);
				let analyser = audioContext.createAnalyser();
				analyser.fftSize = 128;
				analyser.smoothingTimeConstant = 0.82;
				source.connect(analyser);
				analyser.connect(audioContext.destination);
				visuals = { context: audioContext, analyser };
			} catch {
				visuals = undefined;
			}
		}

		/** Draws the visuals: bars in a ring around the cover, following the music's spectrum. */
		function draw() {
			cancelAnimationFrame(frame);
			if (!viewOpen || canvas === undefined) return;
			let surface = canvas;
			let paint = surface.getContext("2d");
			let size = surface.clientWidth * devicePixelRatio;
			if (paint === null || size === 0) return;
			if (surface.width !== size) {
				surface.width = size;
				surface.height = size;
			}
			let bins = new Uint8Array(visuals?.analyser.frequencyBinCount ?? 64);
			visuals?.analyser.getByteFrequencyData(bins);
			paint.clearRect(0, 0, size, size);
			let color = getComputedStyle(surface).color;
			let center = size / 2;
			let inner = size * 0.36;
			let count = 72;
			paint.strokeStyle = color;
			paint.lineCap = "round";
			paint.lineWidth = Math.max(2, size / 180);
			for (let i = 0; i < count; i++) {
				let bin =
					bins[Math.floor(((i < count / 2 ? i : count - i) / (count / 2)) * (bins.length * 0.7))] ??
					0;
				let length = size * 0.012 + (bin / 255) * size * 0.11;
				let angle = (i / count) * Math.PI * 2 - Math.PI / 2;
				paint.globalAlpha = 0.35 + (bin / 255) * 0.65;
				paint.beginPath();
				paint.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
				paint.lineTo(
					center + Math.cos(angle) * (inner + length),
					center + Math.sin(angle) * (inner + length),
				);
				paint.stroke();
			}
			frame = requestAnimationFrame(draw);
		}

		/** Starts and stops the visuals with the view: they run only while it is open. */
		function onViewToggle(open: boolean) {
			viewOpen = open;
			if (open) {
				startVisuals();
				void visuals?.context.resume();
				draw();
			} else cancelAnimationFrame(frame);
		}

		/** Whether a key press belongs to a control that uses Space itself. */
		function typingIn(target: EventTarget | null): boolean {
			return (
				target instanceof HTMLElement &&
				(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName))
			);
		}

		if (typeof document !== "undefined") {
			audio = document.createElement("audio");
			audio.id = "murmur-audio";
			audio.preload = "none";
			audio.hidden = true;
		}

		handle.queueTask(() => {
			if (handle.signal.aborted || audio === undefined) return;
			let signal = handle.signal;
			let media = audio;
			document.body.appendChild(media);
			signal.addEventListener("abort", () => media.remove());
			try {
				let stored = Number(localStorage.getItem(VOLUME_KEY));
				if (localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(stored)) volume = stored;
			} catch {
				volume = 0.8;
			}
			media.volume = volume;
			media.addEventListener(
				"timeupdate",
				() => {
					time = media.currentTime;
					void handle.update();
				},
				{ signal },
			);
			media.addEventListener(
				"durationchange",
				() => {
					if (Number.isFinite(media.duration)) duration = media.duration;
					void handle.update();
				},
				{ signal },
			);
			for (let type of ["play", "pause"]) {
				media.addEventListener(
					type,
					() => {
						playing = !media.paused;
						markPage();
						void handle.update();
					},
					{ signal },
				);
			}
			media.addEventListener("ended", () => void next(true), { signal });
			media.addEventListener(
				"volumechange",
				() => {
					volume = media.volume;
					muted = media.muted;
					try {
						localStorage.setItem(VOLUME_KEY, String(volume));
					} catch {
						volume = media.volume;
					}
					void handle.update();
				},
				{ signal },
			);
			document.addEventListener(
				"submit",
				(event) => {
					let form = event.target;
					if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-murmur-play")) return;
					event.preventDefault();
					event.stopPropagation();
					void playFrom(form);
				},
				{ capture: true, signal },
			);
			document.addEventListener(
				"keydown",
				(event) => {
					if (event.defaultPrevented || typingIn(event.target)) return;
					if (event.shiftKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
						event.preventDefault();
						void (event.key === "ArrowRight" ? next() : previous());
						return;
					}
					if (event.key === " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
						if (document.querySelector("dialog[open]:not(#" + NOW_VIEW + ")")) return;
						event.preventDefault();
						void toggle();
					}
				},
				{ signal },
			);
			document.addEventListener(
				"submit",
				(event) => {
					if (
						event.target instanceof HTMLFormElement &&
						event.target.hasAttribute("data-murmur-library")
					) {
						libraryStale = true;
					}
				},
				{ signal },
			);
			let region = document.querySelector("[data-main-region]");
			if (region !== null) {
				let observer = new MutationObserver(() => {
					markPage();
					if (!libraryStale) return;
					libraryStale = false;
					void handle.frames.get(LIBRARY_FRAME)?.reload();
				});
				observer.observe(region, { childList: true, subtree: true });
				signal.addEventListener("abort", () => observer.disconnect());
			}
			signal.addEventListener("abort", () => {
				session?.abort();
				cancelAnimationFrame(frame);
				for (let url of sources.values()) URL.revokeObjectURL(url);
				void visuals?.context.close();
			});
			markPage();
		});

		return () => {
			let track = current();
			let entry = track === undefined ? undefined : findAlbum(track.album);
			let place = contextPlace(context);
			let share = duration > 0 ? time / duration : 0;
			let repeat = queue?.repeat ?? "off";
			let following =
				queue === null ? [] : upcoming(queue, 30).map((index) => ({ index, track: list[index] }));
			let disabled = track === undefined;
			let art =
				entry === undefined ? undefined : (
					<img src={albumArt(entry)} alt="" width="64" height="64" />
				);
			let title =
				track === undefined || entry === undefined ? (
					"Nothing playing"
				) : (
					<a href={href(`album/${entry.id}`)}>{track.title}</a>
				);
			let artists =
				track === undefined ? (
					"Pick a song, an album or a playlist"
				) : (
					<Artists ids={track.artists} />
				);
			let playButton = (
				<PlayerBar.Button
					label={playing ? "Pause" : "Play"}
					primary
					disabled={disabled}
					data-player-toggle=""
					mix={on("click", () => void toggle())}
				>
					{playing ? (
						<PauseIcon size={20} fill="currentColor" />
					) : (
						<PlayIcon size={20} fill="currentColor" />
					)}
				</PlayerBar.Button>
			);
			let transport = (
				<div mix={[raw({ display: "flex", alignItems: "center", gap: "0.5rem" })]}>
					<PlayerBar.Button
						label={queue?.shuffle ? "Disable shuffle" : "Enable shuffle"}
						pressed={queue?.shuffle ?? false}
						disabled={disabled}
						mix={on("click", () => {
							if (queue === null) return;
							queue = toggleShuffle(queue);
							void handle.update();
						})}
					>
						<ShuffleIcon size={18} />
					</PlayerBar.Button>
					<PlayerBar.Button
						label="Previous"
						disabled={disabled}
						mix={on("click", () => void previous())}
					>
						<SkipBackIcon size={20} fill="currentColor" />
					</PlayerBar.Button>
					{playButton}
					<PlayerBar.Button
						label="Next"
						disabled={disabled}
						data-player-next=""
						mix={on("click", () => void next())}
					>
						<SkipForwardIcon size={20} fill="currentColor" />
					</PlayerBar.Button>
					<PlayerBar.Button
						label={REPEAT_LABELS[repeat]}
						pressed={repeat !== "off"}
						disabled={disabled}
						mix={on("click", () => {
							if (queue === null) return;
							queue = cycleRepeat(queue);
							void handle.update();
						})}
					>
						{repeat === "one" ? <Repeat1Icon size={18} /> : <RepeatIcon size={18} />}
					</PlayerBar.Button>
				</div>
			);
			let seekBar = (
				<PlayerBar.Seek
					aria-label="Seek"
					current={time}
					duration={duration || (track?.duration ?? 0)}
					disabled={disabled}
					data-player-seek=""
					mix={on("input", (event) => seek(Number(event.currentTarget.value)))}
				/>
			);
			let VolumeIcon = volumeIcon(muted ? 0 : volume);
			return (
				<div data-murmur-player="" mix={[raw({ display: "contents" })]}>
					<PlayerBar
						label="Player"
						data-player-bar=""
						mix={[
							raw({
								gridArea: "player",
								display: "none",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
								backgroundColor: "var(--murmur-chrome)",
								[`@media ${DESKTOP}`]: { display: "grid" },
							}),
						]}
						track={
							<PlayerBar.Track
								art={art}
								title={title}
								subtitle={artists}
								data-player-track={track?.id}
							/>
						}
						controls={
							<>
								{transport}
								{seekBar}
								<noscript>
									<span mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
										Playback needs JavaScript; the rest of Murmur works without it.
									</span>
								</noscript>
							</>
						}
						extras={
							<>
								<PlayerBar.Button
									label="Now playing view"
									disabled={disabled}
									commandfor={NOW_VIEW}
									command="show-modal"
								>
									<Maximize2Icon size={16} />
								</PlayerBar.Button>
								<PlayerBar.Button label="Queue" popovertarget={QUEUE_PANEL} disabled={disabled}>
									<ListMusicIcon size={18} />
								</PlayerBar.Button>
								<PlayerBar.Button
									label={muted ? "Unmute" : "Mute"}
									mix={on("click", () => {
										if (audio !== undefined) audio.muted = !audio.muted;
									})}
								>
									<VolumeIcon size={18} />
								</PlayerBar.Button>
								<PlayerBar.Range
									aria-label="Volume"
									value={muted ? 0 : volume * 100}
									max={100}
									mix={[
										raw({ inlineSize: "7rem", flex: "none" }),
										on("input", (event) => {
											if (audio === undefined) return;
											audio.volume = Number(event.currentTarget.value) / 100;
											audio.muted = false;
										}),
									]}
								/>
							</>
						}
					/>
					{track === undefined ? null : (
						<PlayerBar.Mini
							data-player-mini=""
							title={track.title}
							subtitle={track.artists.map(artistName).join(", ")}
							art={art}
							progress={share}
							mix={[
								raw({
									position: "fixed",
									insetInline: "0.5rem",
									insetBlockEnd: "calc(3.5rem + env(safe-area-inset-bottom) + 0.5rem)",
									zIndex: "20",
									[`@media ${DESKTOP}`]: { display: "none" },
								}),
							]}
							expand={
								<button
									type="button"
									data-slot="player-bar-mini-expand"
									commandfor={NOW_VIEW}
									command="show-modal"
									aria-label={`Open now playing: ${track.title}`}
								/>
							}
							actions={
								<PlayerBar.Button
									label={playing ? "Pause" : "Play"}
									mix={on("click", () => void toggle())}
								>
									{playing ? (
										<PauseIcon size={22} fill="currentColor" />
									) : (
										<PlayIcon size={22} fill="currentColor" />
									)}
								</PlayerBar.Button>
							}
						/>
					)}
					<aside
						id={QUEUE_PANEL}
						popover="auto"
						aria-label="Queue"
						mix={[
							raw({
								position: "fixed",
								inset: "auto",
								insetInlineEnd: "0.75rem",
								insetBlockStart: "0.75rem",
								insetBlockEnd: "calc(5.5rem + 0.75rem)",
								margin: "0",
								inlineSize: "min(22rem, calc(100vw - 1.5rem))",
								boxSizing: "border-box",
								overflow: "auto",
								padding: "1rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-lg)",
								color: "var(--ui-neutral-fg)",
								backgroundColor: "var(--ui-surface-raised, Canvas)",
								boxShadow: "0 24px 60px -20px rgb(0 0 0 / 0.45)",
								"&:not(:popover-open)": { display: "none" },
							}),
						]}
					>
						<div
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									marginBlockEnd: "0.75rem",
								}),
							]}
						>
							<h2
								mix={[
									raw({
										margin: "0",
										fontSize: "1.125rem",
										fontWeight: "800",
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								Queue
							</h2>
							<PlayerBar.Button
								label="Close queue"
								popovertarget={QUEUE_PANEL}
								popovertargetaction="hide"
							>
								<XIcon size={18} />
							</PlayerBar.Button>
						</div>
						<QueueBody
							track={track}
							place={place}
							next={following}
							onJump={(index) => {
								if (queue === null) return;
								queue = jumpTo(queue, index);
								void load(true);
							}}
						/>
					</aside>
					<dialog
						id={NOW_VIEW}
						aria-label="Now playing"
						mix={[
							nowViewStyles(),
							on("toggle", (event) => onViewToggle((event as ToggleEvent).newState === "open")),
						]}
					>
						<div data-now-layout="">
							<header data-now-head="">
								<PlayerBar.Button label="Close now playing" commandfor={NOW_VIEW} command="close">
									<ChevronDownIcon size={22} />
								</PlayerBar.Button>
								<span data-now-from="">
									<span>Playing from</span>
									<strong>{place?.name ?? "Murmur"}</strong>
								</span>
								<span mix={[raw({ inlineSize: "2.25rem" })]} />
							</header>
							<div data-now-stage="">
								<canvas
									aria-hidden="true"
									mix={ref((node: HTMLCanvasElement) => (canvas = node))}
								/>
								<div data-now-art="">{art}</div>
							</div>
							<div data-now-info="">
								<div data-now-titles="">
									<h2>{track?.title ?? "Nothing playing"}</h2>
									<p>{track === undefined ? "" : <Artists ids={track.artists} />}</p>
								</div>
								{seekBar}
								<div data-now-transport="">{transport}</div>
								<div data-now-next="">
									<QueueList.Section title="Up next" empty="Nothing else queued">
										{following.slice(0, 4).map(({ index, track: queued }) =>
											queued === undefined ? null : (
												<QueueList.Item
													title={queued.title}
													subtitle={queued.artists.map(artistName).join(", ")}
													duration={queued.duration}
													art={<QueuedArt track={queued} />}
													action={
														<button
															type="button"
															aria-label={`Play ${queued.title}`}
															mix={on("click", () => {
																if (queue === null) return;
																queue = jumpTo(queue, index);
																void load(true);
															})}
														/>
													}
												/>
											),
										)}
									</QueueList.Section>
								</div>
							</div>
						</div>
					</dialog>
				</div>
			);
		};
	},
);

/** The volume icon for a level: crossed out when silent, one wave when quiet, two when loud. */
function volumeIcon(level: number) {
	if (level === 0) return VolumeXIcon;
	return level < 0.5 ? Volume1Icon : Volume2Icon;
}

/** A track's artists as links to their pages. */
function Artists(handle: Handle<{ ids: readonly string[] }>) {
	return () => (
		<>
			{handle.props.ids.map((id, index) => (
				<>
					{index > 0 ? ", " : null}
					<a href={href(`artist/${id}`)}>{artistName(id)}</a>
				</>
			))}
		</>
	);
}

/** A queued track's cover. */
function QueuedArt(handle: Handle<{ track: Track }>) {
	return () => {
		let entry = findAlbum(handle.props.track.album);
		return entry === undefined ? null : (
			<img src={albumArt(entry)} alt="" width="40" height="40" loading="lazy" />
		);
	};
}

namespace QueueBody {
	export interface Props {
		track: Track | undefined;
		place: { name: string; page: string } | undefined;
		next: Array<{ index: number; track: Track | undefined }>;
		onJump: (index: number) => void;
	}
}

/** The queue panel's content: the track on, where it plays from, and what comes next. */
function QueueBody(handle: Handle<QueueBody.Props>) {
	return () => {
		let { next, onJump, place, track } = handle.props;
		return (
			<div mix={[raw({ display: "grid", gap: "1.25rem" })]}>
				<QueueList.Section title="Now playing" empty="Nothing playing">
					{track === undefined
						? null
						: [
								<QueueList.Item
									current
									title={track.title}
									subtitle={track.artists.map(artistName).join(", ")}
									duration={track.duration}
									art={<QueuedArt track={track} />}
								/>,
							]}
				</QueueList.Section>
				<QueueList.Section
					title={
						place === undefined ? (
							"Next up"
						) : (
							<>
								Next from:{" "}
								<a href={href(place.page)} mix={[raw({ color: "inherit" })]}>
									{place.name}
								</a>
							</>
						)
					}
					empty="Nothing else queued"
				>
					{next.length === 0
						? null
						: next.map(({ index, track: queued }) =>
								queued === undefined ? null : (
									<QueueList.Item
										title={queued.title}
										subtitle={queued.artists.map(artistName).join(", ")}
										duration={queued.duration}
										art={<QueuedArt track={queued} />}
										action={
											<button
												type="button"
												aria-label={`Play ${queued.title}`}
												mix={on("click", () => onJump(index))}
											/>
										}
									/>
								),
							)}
				</QueueList.Section>
			</div>
		);
	};
}

/**
 * The now-playing view's look: the whole screen on a phone, a large panel on a desktop, its
 * art in a ring of visuals beside the titles, transport and what comes next.
 */
function nowViewStyles() {
	return raw({
		boxSizing: "border-box",
		inlineSize: "100vw",
		maxInlineSize: "100vw",
		blockSize: "100dvh",
		maxBlockSize: "100dvh",
		margin: "0",
		padding: "0",
		border: "0",
		color: "var(--ui-neutral-fg)",
		backgroundColor: "var(--ui-bg, Canvas)",
		backgroundImage:
			"radial-gradient(120% 80% at 50% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 35%, transparent), transparent 70%)",
		"&::backdrop": { backgroundColor: "rgb(0 0 0 / 0.5)" },
		"&[open]": { display: "grid" },
		"& [data-now-layout]": {
			display: "grid",
			gridTemplateRows: "auto auto 1fr",
			gap: "1.5rem",
			inlineSize: "100%",
			maxInlineSize: "72rem",
			marginInline: "auto",
			padding:
				"max(1rem, env(safe-area-inset-top)) 1.25rem max(1.5rem, env(safe-area-inset-bottom))",
			boxSizing: "border-box",
			overflow: "auto",
		},
		"& [data-now-head]": {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "1rem",
		},
		"& [data-now-from]": {
			display: "grid",
			justifyItems: "center",
			fontSize: "0.75rem",
			color: "var(--ui-neutral-fg-muted)",
			textTransform: "uppercase",
			letterSpacing: "0.06em",
			"& strong": {
				fontSize: "0.875rem",
				textTransform: "none",
				letterSpacing: "0",
				color: "var(--ui-neutral-fg-emphasis)",
			},
		},
		"& [data-now-stage]": {
			position: "relative",
			display: "grid",
			placeItems: "center",
			inlineSize: "min(100%, 30rem, 52dvh)",
			aspectRatio: "1",
			justifySelf: "center",
			color: "var(--ui-brand-fg)",
		},
		"& [data-now-stage] > canvas": {
			position: "absolute",
			inset: "0",
			inlineSize: "100%",
			blockSize: "100%",
		},
		"& [data-now-art]": {
			position: "relative",
			inlineSize: "68%",
			aspectRatio: "1",
			overflow: "clip",
			borderRadius: "var(--ui-radius-lg)",
			boxShadow: "0 30px 70px -25px rgb(0 0 0 / 0.65)",
			"& > img": { display: "block", inlineSize: "100%", blockSize: "100%" },
		},
		"& [data-now-info]": {
			display: "grid",
			alignContent: "start",
			gap: "1.25rem",
			minInlineSize: "0",
		},
		"& [data-now-titles] h2": {
			margin: "0",
			fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
			lineHeight: "1.1",
			fontWeight: "850",
			letterSpacing: "-0.03em",
			color: "var(--ui-neutral-fg-emphasis)",
		},
		"& [data-now-titles] p": {
			margin: "0.25rem 0 0",
			fontSize: "1rem",
			color: "var(--ui-neutral-fg-muted)",
		},
		"& [data-now-titles] a": { color: "inherit", textDecoration: "none" },
		"& [data-now-titles] a:hover": { textDecoration: "underline" },
		"& [data-now-info] [data-slot=player-bar-seek]": { maxInlineSize: "none" },
		"& [data-now-transport]": { display: "flex", justifyContent: "center" },
		"& [data-now-transport] [data-slot=player-bar-button]": {
			inlineSize: "3rem",
			blockSize: "3rem",
		},
		"& [data-now-transport] [data-primary]": { inlineSize: "4rem", blockSize: "4rem" },
		"@media (min-width: 56rem)": {
			"& [data-now-layout]": {
				gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
				gridTemplateRows: "auto 1fr",
				columnGap: "3rem",
				alignItems: "center",
			},
			"& [data-now-head]": { gridColumn: "1 / -1" },
		},
	});
}
