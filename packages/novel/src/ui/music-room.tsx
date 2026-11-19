/**
 * The music room: every declared music track, the unlocked ones playable on the music channel of
 * an `AudioMixer` (the player's own, or one the room makes for itself) and the locked ones
 * listed without a way to play them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { Button } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { Novel } from "../novel.js";

import type { LibraryAsset } from "./library.js";
import type { NovelLabels } from "./settings.js";

import { AudioMixer } from "./audio.js";
import { libraryReader } from "./library.js";
import { Message } from "./message.js";
import { DEFAULT_LABELS, DEFAULT_SETTINGS } from "./settings.js";

export namespace MusicRoom {
	/** Props {@link MusicRoom} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		novel: Novel;
		/** The stored `Persistent` value, or a play's `persistent`; keep one value while it shows. */
		persistent: unknown;
		/**
		 * The mixer to play through. A mixer passed in keeps playing after the room closes, for its
		 * owner to restore; without one the room makes its own and stops it when it unmounts.
		 */
		mixer?: AudioMixer;
		/** Each track's title as a message key, by asset id; a track without one shows its key. */
		titles?: Readonly<Record<string, string>>;
		labels?: Partial<Pick<NovelLabels, "loading" | "locked" | "play" | "stop">>;
	}
}

/**
 * Lists the novel's music; playing a track crossfades from whatever the music channel played.
 *
 * @example <MusicRoom novel={novel} persistent={stored} titles={{ "music.chill": "music.chill" }} />
 */
export function MusicRoom(handle: Handle<MusicRoom.Props>) {
	let read = libraryReader(handle);
	let own: AudioMixer | undefined;
	let playing: string | null = null;
	handle.signal.addEventListener("abort", () => own?.dispose());

	/** The mixer to play through, making the room's own on first use. */
	function mixer(): AudioMixer {
		if (handle.props.mixer !== undefined) return handle.props.mixer;
		own ??= new AudioMixer(DEFAULT_SETTINGS.volume);
		return own;
	}

	/** Plays a track on the music channel, or stops the music with `null`. */
	function select(track: LibraryAsset | null): void {
		let target = mixer();
		void target.resume();
		target.reconcile(
			{
				music: track === null ? null : { id: track.id, src: track.src },
				ambience: [],
				sounds: [],
				voice: null,
			},
			intl(handle).locale,
		);
		playing = track?.id ?? null;
		void handle.update();
	}

	return () => {
		let {
			novel,
			persistent,
			mixer: _mixer,
			titles = {},
			labels: overrides,
			mix,
			...rest
		} = handle.props;
		let labels = { ...DEFAULT_LABELS, ...overrides };
		let library = read(novel, persistent, intl(handle).locale);
		return (
			<div
				{...rest}
				data-novel-music-room=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={mix}
			>
				{library === undefined ? <p>{labels.loading}</p> : null}
				<ol mix={css({ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" })}>
					{(library?.music ?? []).map((track) => {
						let title = titles[track.id];
						return (
							<li
								key={track.id}
								data-track={track.id}
								data-unlocked={String(track.unlocked)}
								data-playing={String(playing === track.id)}
								mix={css({
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "0.75rem",
									'&[data-unlocked="false"]': { opacity: 0.6 },
									'&[data-playing="true"]': { color: "var(--novel-accent, #f4c95d)" },
								})}
							>
								<span>
									{!track.unlocked ? labels.locked : null}
									{track.unlocked && title !== undefined ? <Message i18nKey={title} /> : null}
									{track.unlocked && title === undefined ? track.id.replace(/^music\./, "") : null}
								</span>
								{track.unlocked ? (
									<Button
										size="sm"
										variant="ghost"
										aria-pressed={playing === track.id}
										mix={on("click", () => select(playing === track.id ? null : track))}
									>
										{playing === track.id ? labels.stop : labels.play}
									</Button>
								) : null}
							</li>
						);
					})}
				</ol>
			</div>
		);
	};
}
