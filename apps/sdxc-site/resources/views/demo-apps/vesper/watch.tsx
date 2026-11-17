/**
 * The watch page: the episode or film filling the window, resuming where the profile left it,
 * with the way back, the next episode and the season's episodes over the picture, and the
 * playback bar at its foot. Both fade while it plays and the pointer rests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowLeftIcon, ListIcon, SkipForwardIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { EpisodeList, VideoPlayer } from "@sdxc/ui/video";

import type { Episode, Season, Title } from "./data";
import type { Viewer } from "./state";

import { KeyArt, stillFrame } from "./art";
import { href, nextEpisode, watchHref } from "./data";
import { progressFor } from "./title";

/**
 * A one-pixel transparent GIF as the poster, so the browser paints nothing over the drawn
 * frame before playback.
 */
const CLEAR_POSTER =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * The clip a running time plays: a transparent WebM that long, so the bar, chapters and captions
 * run over the drawn art, an H.264 twin for browsers without WebM, and a `#t=` fragment on a
 * resumed episode so playback starts where the profile left it.
 */
function clip(minutes: number, start: number | undefined): { webm: string; mp4: string } {
	let from = start === undefined ? "" : `#t=${start}`;
	return {
		webm: `/demos/video/vesper/${minutes}.webm${from}`,
		mp4: `/demos/video/vesper/${minutes}.mp4${from}`,
	};
}

/** The chapters every episode and film has, placed by its running time. */
function chaptersFor(seconds: number, film: boolean): VideoPlayer.Chapter[] {
	return [
		{ start: 0, title: film ? "Opening" : "Previously" },
		{ start: 90, title: "Title sequence" },
		{ start: 150, title: film ? "Act one" : "Part one" },
		{ start: Math.round(seconds * 0.45), title: film ? "Act two" : "Part two" },
		{ start: Math.round(seconds * 0.8), title: film ? "Act three" : "Part three" },
		{ start: seconds - 120, title: "End credits" },
	];
}

/** The captions, described sound and the title's own lines, timed against the chapters. */
function captionsFor(
	seconds: number,
	title: Title,
	episode: Episode | undefined,
): VideoPlayer.Cue[] {
	return [
		{ start: 0, text: episode === undefined ? "[Quiet strings]" : `[Previously on ${title.name}]` },
		{ start: 90, text: "[Title music swells]" },
		{ start: 150, text: episode?.synopsis ?? title.tagline },
		{ start: Math.round(seconds * 0.3), text: "[Rain against the window]" },
		{ start: Math.round(seconds * 0.45), text: "Then we start again, from the beginning." },
		{ start: Math.round(seconds * 0.8), text: "[Footsteps, then silence]" },
		{ start: seconds - 120, text: "[Closing theme]" },
	];
}

namespace WatchPage {
	export interface Props {
		viewer: Viewer;
		title: Title;
		/** The season and episode for a series; `undefined` for a film. */
		playing: { season: Season; episode: Episode } | undefined;
	}
}

/** The id of the season's episodes panel, which the overlay's Episodes button opens. */
const EPISODES_PANEL = "vesper-episodes";

/** Renders the watch page. */
export default function WatchPage(handle: Handle<WatchPage.Props>) {
	return () => {
		let { playing, title, viewer } = handle.props;
		let minutes = playing?.episode.minutes ?? title.minutes ?? 90;
		let seconds = minutes * 60;
		let progress = progressFor(viewer, title);
		let resumes =
			progress !== undefined &&
			progress.season === playing?.season.number &&
			progress.episode === playing?.episode.number;
		let start =
			resumes && progress !== undefined ? Math.round(progress.share * seconds) : undefined;
		let label =
			playing === undefined
				? title.name
				: `${title.name}, season ${playing.season.number}, episode ${playing.episode.number}: ${playing.episode.title}`;
		let next =
			playing === undefined
				? undefined
				: nextEpisode(title, playing.season.number, playing.episode.number);
		let source = clip(minutes, start);
		return (
			<div
				mix={[
					raw({
						flex: "1 1 auto",
						blockSize: "100dvh",
						minBlockSize: "20rem",
						backgroundColor: "black",
					}),
				]}
			>
				<h1
					mix={[
						raw({
							position: "absolute",
							inlineSize: "1px",
							blockSize: "1px",
							overflow: "hidden",
							clipPath: "inset(50%)",
						}),
					]}
				>
					{label}
				</h1>
				<VideoPlayer
					layout="stage"
					tone="theater"
					duration={seconds}
					chapters={chaptersFor(seconds, playing === undefined)}
					transcript={captionsFor(seconds, title, playing?.episode)}
					current={start}
					mix={[
						raw({
							"--ui-video-player-progress-color": "var(--ui-color-brand-500)",
							"& [data-key-art]": {
								position: "absolute",
								inset: "0",
								inlineSize: "100%",
								blockSize: "100%",
							},
						}),
					]}
				>
					<VideoPlayer.Screen
						label={label}
						poster={CLEAR_POSTER}
						captionsLabel="English"
						chaptersLabel="Chapters"
						mix={[when("& > video:not([controls])", raw({ opacity: "0" }))]}
					>
						<VideoPlayer.Frame>
							<KeyArt
								title={title}
								frame={
									playing === undefined
										? undefined
										: stillFrame(playing.season.number, playing.episode.number)
								}
								named={false}
								priority
							/>
						</VideoPlayer.Frame>
						<VideoPlayer.Source src={source.webm} type="video/webm" label="1080p" badge="HD" />
						<VideoPlayer.Source src={source.mp4} type="video/mp4" />
						<VideoPlayer.Overlay>
							<a
								href={href(`title/${title.id}`)}
								aria-label={`Back to ${title.name}`}
								mix={[overlayButton()]}
							>
								<ArrowLeftIcon aria-hidden="true" size={22} />
							</a>
							<span
								mix={[
									raw({ display: "grid", gap: "0.125rem", minInlineSize: "0", flex: "1 1 auto" }),
								]}
							>
								<span
									mix={[
										raw({
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
											fontSize: "clamp(1.0625rem, 2.4cqi, 1.5rem)",
											fontWeight: "650",
										}),
									]}
								>
									{title.name}
								</span>
								{playing === undefined ? null : (
									<span
										mix={[
											raw({
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
												fontSize: "0.9375rem",
												color: "oklch(0.85 0 0)",
											}),
										]}
									>
										S{playing.season.number}:E{playing.episode.number} · {playing.episode.title}
									</span>
								)}
							</span>
							{next === undefined ? null : (
								<a
									href={watchHref(title, next.season.number, next.episode.number)}
									mix={[overlayButton()]}
								>
									<SkipForwardIcon aria-hidden="true" size={20} />
									<span>Next episode</span>
								</a>
							)}
							{playing === undefined ? null : (
								<>
									<button
										type="button"
										popovertarget={EPISODES_PANEL}
										mix={[
											overlayButton(),
											raw({ border: "0", fontFamily: "inherit", cursor: "pointer" }),
										]}
									>
										<ListIcon aria-hidden="true" size={20} />
										<span>Episodes</span>
									</button>
									<EpisodesPanel title={title} playing={playing} />
								</>
							)}
						</VideoPlayer.Overlay>
						<VideoPlayer.Controls label="Player controls">
							<VideoPlayer.Progress label="Seek" />
							<VideoPlayer.Group align="start">
								<VideoPlayer.Time />
							</VideoPlayer.Group>
							<VideoPlayer.Group align="center">
								<VideoPlayer.Skip seconds={-10} label="Back 10 seconds" />
								<VideoPlayer.Play label="Play" pauseLabel="Pause" />
								<VideoPlayer.Skip seconds={10} label="Forward 10 seconds" />
							</VideoPlayer.Group>
							<VideoPlayer.Group align="end">
								<VideoPlayer.Mute label="Mute" unmuteLabel="Unmute" mix={[hideOnPhone()]} />
								<VideoPlayer.CaptionsToggle label="Subtitles" />
								<VideoPlayer.Settings label="Settings">
									<VideoPlayer.CaptionsMenu label="Subtitles" offLabel="Off" backLabel="Back" />
									<VideoPlayer.SpeedMenu
										label="Playback speed"
										normalLabel="Normal"
										backLabel="Back"
										rates={[0.75, 1, 1.25, 1.5]}
									/>
								</VideoPlayer.Settings>
								<VideoPlayer.Fullscreen label="Full screen" />
							</VideoPlayer.Group>
						</VideoPlayer.Controls>
					</VideoPlayer.Screen>
				</VideoPlayer>
			</div>
		);
	};
}

/** A pill over the picture: the way back, the next episode and the episodes panel. */
function overlayButton() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.5rem",
			minBlockSize: "2.75rem",
			minInlineSize: "2.75rem",
			justifyContent: "center",
			paddingInline: "0.875rem",
			borderRadius: "999px",
			color: "oklch(0.97 0 0)",
			backgroundColor: "rgb(255 255 255 / 0.1)",
			fontSize: "0.9375rem",
			fontWeight: "600",
			textDecoration: "none",
			backdropFilter: "blur(8px)",
			transition: "background-color 140ms ease",
		}),
		when("&:hover", raw({ backgroundColor: "rgb(255 255 255 / 0.2)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
		),
		when("& > span", raw({ "@container (max-width: 36rem)": { display: "none" } })),
	];
}

/** Takes a bar control off a phone's narrow bar, where the device's own buttons do its job. */
function hideOnPhone() {
	return raw({ "@container (max-width: 36rem)": { display: "none" } });
}

/**
 * The season's episodes in a panel over the picture, opened from the overlay and closed by a
 * click outside or Escape; the one playing is marked. It works without script.
 */
function EpisodesPanel(
	handle: Handle<{ title: Title; playing: { season: Season; episode: Episode } }>,
) {
	return () => {
		let { playing, title } = handle.props;
		return (
			<div
				id={EPISODES_PANEL}
				popover="auto"
				aria-label={`${title.name}, season ${playing.season.number}`}
				mix={[
					raw({
						position: "fixed",
						inset: "auto",
						insetBlockStart: "5rem",
						insetInlineEnd: "clamp(0.75rem, 3vw, 2.5rem)",
						margin: "0",
						inlineSize: "min(30rem, calc(100vw - 1.5rem))",
						maxBlockSize: "calc(100dvh - 10rem)",
						overflow: "auto",
						padding: "0.75rem",
						border: "0",
						borderRadius: "0.75rem",
						color: "oklch(0.95 0.005 300)",
						backgroundColor: "rgb(18 15 24 / 0.97)",
						boxShadow: "0 0 0 1px rgb(255 255 255 / 0.1), 0 24px 60px -12px rgb(0 0 0 / 0.7)",
						colorScheme: "dark",
					}),
				]}
			>
				<h2 mix={[raw({ margin: "0.25rem 0.5rem 0.5rem", fontSize: "1.0625rem" })]}>
					Season {playing.season.number}
				</h2>
				<EpisodeList aria-label={`${title.name}, season ${playing.season.number}`}>
					{playing.season.episodes.map((episode) => (
						<EpisodeList.Item
							href={watchHref(title, playing.season.number, episode.number)}
							number={episode.number}
							title={episode.title}
							still={
								<KeyArt
									title={title}
									frame={stillFrame(playing.season.number, episode.number)}
									named={false}
								/>
							}
							duration={`${episode.minutes}m`}
							current={episode.number === playing.episode.number}
						/>
					))}
				</EpisodeList>
			</div>
		);
	};
}
