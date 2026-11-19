/**
 * Hands a music player's state to the operating system through the Media Session API, so the
 * media keys, the lock screen, a headset's buttons and the browser's own media hub show the
 * track and drive the player. Browsers without the API are left alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Types associated with {@link syncMediaSession}. */
export namespace MediaSessionSync {
	/** What the system shows for the track playing. */
	export interface Track {
		title: string;
		artist: string;
		album?: string;
		/** Square pictures, largest last; a PNG or JPEG reaches every platform. */
		artwork?: Array<{ src: string; sizes?: string; type?: string }>;
	}

	/** The player's commands the system may call; one left out disables its button. */
	export interface Actions {
		play: () => void;
		pause: () => void;
		previous?: () => void;
		next?: () => void;
		/** Moves to an absolute time in seconds. */
		seek?: (time: number) => void;
	}
}

/** How far the system's skip buttons move, in seconds, when it names no offset. */
const SKIP_SECONDS = 10;

/**
 * Publishes the track and the media's position, and routes the system's buttons to the
 * player's commands. Call it when the track changes; position and play state follow the
 * media's own events until `signal` aborts, which clears the handlers.
 *
 * @param media The `<audio>` or `<video>` element that plays.
 * @param track What plays, or `null` to clear what the system shows.
 * @param actions The player's commands.
 * @param signal Ends the sync, such as when the player unmounts or the track changes.
 * @example syncMediaSession(audio, { title: "Tidelight", artist: "Lumen Harbor" }, { play, pause, next }, controller.signal)
 */
export function syncMediaSession(
	media: HTMLMediaElement,
	track: MediaSessionSync.Track | null,
	actions: MediaSessionSync.Actions,
	signal: AbortSignal,
): void {
	if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
	let session = navigator.mediaSession;
	session.metadata =
		track === null || typeof MediaMetadata === "undefined"
			? null
			: new MediaMetadata({
					title: track.title,
					artist: track.artist,
					album: track.album ?? "",
					artwork: track.artwork ?? [],
				});

	/** Sets a handler, skipping an action the browser does not know rather than throwing. */
	let handle = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
		try {
			session.setActionHandler(action, handler);
			return true;
		} catch {
			return false;
		}
	};
	let seek = actions.seek;
	handle("play", () => actions.play());
	handle("pause", () => actions.pause());
	handle("previoustrack", actions.previous ? () => actions.previous?.() : null);
	handle("nexttrack", actions.next ? () => actions.next?.() : null);
	handle("seekto", seek ? (details) => seek(details.seekTime ?? media.currentTime) : null);
	handle(
		"seekbackward",
		seek ? (details) => seek(media.currentTime - (details.seekOffset ?? SKIP_SECONDS)) : null,
	);
	handle(
		"seekforward",
		seek ? (details) => seek(media.currentTime + (details.seekOffset ?? SKIP_SECONDS)) : null,
	);

	/** Reports where the media is, which the system draws as its own progress bar. */
	let position = () => {
		session.playbackState = media.paused ? "paused" : "playing";
		if (!Number.isFinite(media.duration) || media.duration <= 0) return false;
		try {
			session.setPositionState({
				duration: media.duration,
				position: Math.min(media.currentTime, media.duration),
				playbackRate: media.playbackRate || 1,
			});
			return true;
		} catch {
			return false;
		}
	};
	position();
	for (let type of ["play", "pause", "seeked", "loadedmetadata", "ratechange"]) {
		media.addEventListener(type, position, { signal });
	}
	signal.addEventListener("abort", () => {
		for (let action of [
			"play",
			"pause",
			"previoustrack",
			"nexttrack",
			"seekto",
			"seekbackward",
			"seekforward",
		] as const) {
			handle(action, null);
		}
	});
}
