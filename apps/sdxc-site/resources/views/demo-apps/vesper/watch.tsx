/**
 * The watch page: the episode or film in the theater player with its chapters, captions and
 * settings, resuming where the profile left it, then what plays next and the rest of the
 * season. It draws its own frame, darker than browsing, with one way back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowLeftIcon, SkipForwardIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { EpisodeList, VideoPlayer } from "@sdxc/ui/video";

import type { Episode, Season, Title } from "./data";
import type { Viewer } from "./state";

import { KeyArt, stillFrame } from "./art";
import { formatMinutes, href, nextEpisode, watchHref } from "./data";
import { GUTTER, VesperMark } from "./shell";
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
						display: "grid",
						alignContent: "start",
						gap: "1.5rem",
						minBlockSize: "100dvh",
						paddingBlockEnd: "3rem",
						backgroundColor: "oklch(0.1 0.008 300)",
					}),
				]}
			>
				<WatchBar title={title} playing={playing} />
				<main mix={[raw({ display: "grid", gap: "2rem", paddingInline: GUTTER })]}>
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
						duration={seconds}
						chapters={chaptersFor(seconds, playing === undefined)}
						transcript={captionsFor(seconds, title, playing?.episode)}
						current={start}
						tone="theater"
						mix={[
							raw({
								"--ui-video-player-progress-color": "var(--ui-color-brand-500)",
								"--ui-video-player-transcript-height": "10rem",
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
							<VideoPlayer.Controls label="Player controls">
								<VideoPlayer.Progress label="Seek" />
								<VideoPlayer.Play label="Play" pauseLabel="Pause" />
								<VideoPlayer.Time />
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
							</VideoPlayer.Controls>
						</VideoPlayer.Screen>
						<VideoPlayer.Scrubber />
						<VideoPlayer.Caption
							meta={
								playing === undefined
									? `${title.year} · ${formatMinutes(minutes)}`
									: `S${playing.season.number}:E${playing.episode.number} · ${minutes}m`
							}
						>
							{playing === undefined ? title.name : playing.episode.title}
						</VideoPlayer.Caption>
						{next === undefined ? null : <NextUp title={title} next={next} />}
						<VideoPlayer.Side>
							<VideoPlayer.Chapters label="Chapters" />
							<VideoPlayer.Transcript label="Subtitles" />
						</VideoPlayer.Side>
					</VideoPlayer>
					{playing === undefined ? null : <SeasonList title={title} playing={playing} />}
				</main>
			</div>
		);
	};
}

/** The watch page's bar: the way back to the title's page, and what is playing. */
function WatchBar(handle: Handle<{ title: Title; playing: WatchPage.Props["playing"] }>) {
	return () => {
		let { playing, title } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "1rem",
						minBlockSize: "4rem",
						paddingInline: GUTTER,
					}),
				]}
			>
				<a
					href={href(`title/${title.id}`)}
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.5rem",
							minBlockSize: "2.75rem",
							paddingInline: "0.75rem 1rem",
							marginInlineStart: "-0.75rem",
							borderRadius: "999px",
							color: "var(--ui-neutral-fg-emphasis)",
							textDecoration: "none",
							fontWeight: "600",
						}),
						when("&:hover", raw({ backgroundColor: "rgb(255 255 255 / 0.08)" })),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "0" }),
						),
					]}
				>
					<ArrowLeftIcon aria-hidden="true" size={20} />
					{title.name}
				</a>
				{playing === undefined ? null : (
					<span
						mix={[
							raw({
								color: "var(--ui-neutral-fg-muted)",
								fontSize: "0.9375rem",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}),
						]}
					>
						S{playing.season.number}:E{playing.episode.number} · {playing.episode.title}
					</span>
				)}
				<span mix={[raw({ flex: "1 1 auto" })]} />
				<a href={href()} aria-label="Vesper home" mix={[raw({ display: "inline-flex" })]}>
					<VesperMark />
				</a>
			</div>
		);
	};
}

namespace NextUp {
	export interface Props {
		title: Title;
		next: { season: Season; episode: Episode };
	}
}

/** The card for the episode that plays next: its still, number, name and length. */
function NextUp(handle: Handle<NextUp.Props>) {
	return () => {
		let { next, title } = handle.props;
		return (
			<a
				href={watchHref(title, next.season.number, next.episode.number)}
				data-slot="vesper-next"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "6.5rem minmax(0, 1fr) auto",
						alignItems: "center",
						gap: "0.875rem",
						padding: "0.625rem",
						borderRadius: "0.75rem",
						color: "inherit",
						textDecoration: "none",
						backgroundColor: "oklch(1 0 0 / 0.06)",
						boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.1)",
					}),
					when("&:hover", raw({ backgroundColor: "oklch(1 0 0 / 0.1)" })),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
					),
				]}
			>
				<span
					mix={[
						raw({
							position: "relative",
							display: "block",
							aspectRatio: "16 / 9",
							overflow: "clip",
							borderRadius: "0.375rem",
							"& > *": { position: "absolute", inset: "0" },
						}),
					]}
				>
					<KeyArt
						title={title}
						frame={stillFrame(next.season.number, next.episode.number)}
						named={false}
					/>
				</span>
				<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
					<span
						mix={[
							raw({
								fontSize: "0.6875rem",
								fontWeight: "700",
								letterSpacing: "0.12em",
								textTransform: "uppercase",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						Next episode · {next.episode.minutes}m
					</span>
					<span mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
						S{next.season.number}:E{next.episode.number} · {next.episode.title}
					</span>
				</span>
				<SkipForwardIcon
					aria-hidden="true"
					size={20}
					mix={[raw({ color: "var(--ui-neutral-fg-muted)", marginInlineEnd: "0.5rem" })]}
				/>
			</a>
		);
	};
}

/** The rest of the playing season, the episode on screen marked. */
function SeasonList(
	handle: Handle<{ title: Title; playing: { season: Season; episode: Episode } }>,
) {
	return () => {
		let { playing, title } = handle.props;
		return (
			<section
				aria-labelledby="vesper-season"
				mix={[raw({ display: "grid", gap: "0.5rem", maxInlineSize: "60rem" })]}
			>
				<h2
					id="vesper-season"
					mix={[raw({ margin: "0", fontSize: "1.25rem", color: "var(--ui-neutral-fg-emphasis)" })]}
				>
					Season {playing.season.number}
				</h2>
				<EpisodeList
					aria-label={`${title.name}, season ${playing.season.number}`}
					mix={[raw({ marginInline: "-0.75rem" })]}
				>
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
							synopsis={episode.synopsis}
							current={episode.number === playing.episode.number}
						/>
					))}
				</EpisodeList>
			</section>
		);
	};
}
