/**
 * An episode player for a podcast or a read-aloud letter: the browser's own `<audio>`
 * controls, a list of chapters and a timed transcript. Every time is a media-fragment link,
 * so it plays from that point with no script; the island makes it seek the player instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { hidden } from "@sdxc/u/layout";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import { Heading } from "../components/heading.js";

import { episodeSync } from "./mixins/episode-sync.js";

/** Translucent ink the rules draw with, the page's hairline when it sets one. */
const HAIRLINE = "var(--ui-landing-hairline, color-mix(in oklch, CanvasText 12%, transparent))";

/**
 * Prop types for {@link EpisodePlayer}.
 */
export namespace EpisodePlayer {
	/** One chapter: where it starts and what it is called. */
	export interface Chapter {
		/** Seconds from the start of the audio. */
		start: number;
		title: RemixNode;
	}

	/** One transcript passage: where it starts, who speaks, and what they say. */
	export interface Cue {
		/** Seconds from the start of the audio. */
		start: number;
		/** The speaker's name, shown once at the start of the passage. */
		speaker?: RemixNode;
		text: RemixNode;
	}

	/**
	 * Props accepted by {@link EpisodePlayer}.
	 */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** Address of the audio file; chapter links append `#t=<seconds>` to it. */
		src: string;
		/** Media type of the file, such as `audio/mpeg`. */
		type?: string;
		/** The episode's title, rendered as a heading at the surrounding level. */
		title: RemixNode;
		/** A line under the title, such as the number, date and running time. */
		meta?: RemixNode;
		/** Chapters in playing order; the list is left out when empty. */
		chapters?: readonly Chapter[];
		/** Transcript passages in playing order; the disclosure is left out when empty. */
		transcript?: readonly Cue[];
		/** Accessible name of the chapter list, such as "Chapters". */
		chaptersLabel: string;
		/** Visible label of the transcript disclosure, such as "Read the transcript". */
		transcriptLabel: string;
		/** The WebVTT captions file for the audio, which assistive technology can read out. */
		captions: { src: string; srclang: string; label: string };
		/** Shown by a browser without audio support, such as a download link. */
		fallback: RemixNode;
		/** A line under the player, such as a credit or a download link. */
		note?: RemixNode;
	}
}

/**
 * Writes seconds as a clock reading: `m:ss` under an hour and `h:mm:ss` from one.
 *
 * @param seconds Whole or fractional seconds from the start.
 * @returns The reading, such as `1:52` or `1:02:03`.
 */
export function formatEpisodeTime(seconds: number): string {
	let total = Math.max(0, Math.floor(seconds));
	let h = Math.floor(total / 3600);
	let m = Math.floor((total % 3600) / 60);
	let s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** The same moment as an ISO 8601 duration, for a `<time dateTime>` attribute. */
function isoDuration(seconds: number): string {
	let total = Math.max(0, Math.floor(seconds));
	return `PT${Math.floor(total / 60)}M${total % 60}S`;
}

/** Styling shared by every time link: muted tabular figures that take the brand on hover. */
function timeLink() {
	return [
		fg("neutral.muted"),
		raw({
			fontVariantNumeric: "tabular-nums",
			textDecoration: "none",
			borderRadius: "var(--ui-radius-xs, 0.25rem)",
		}),
		hover(raw({ color: "var(--ui-brand-fg)" })),
		focusVisible(raw({ outline: "2px solid var(--ui-focus-ring, var(--ui-brand-fg))" })),
	];
}

/**
 * Renders the player, then the chapters as an ordered list of links and the transcript
 * in a closed `<details>`. Without script each link opens the audio at its moment; with
 * the island it seeks this player, starts it, and the playing chapter and passage carry
 * `aria-current`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the player.
 * @example
 * <EpisodePlayer src="/audio/63.mp3" captions={{ src: "/audio/63.vtt", srclang: "en", label: "English" }} title="No. 63" chaptersLabel="Chapters" transcriptLabel="Transcript" fallback={<a href="/audio/63.mp3">Download</a>} />
 */
export function EpisodePlayer(handle: Handle<EpisodePlayer.Props>) {
	return () => {
		let {
			captions,
			chapters = [],
			chaptersLabel,
			fallback,
			meta,
			mix,
			note,
			src,
			title,
			transcript = [],
			transcriptLabel,
			type,
			...rest
		} = handle.props;
		let at = (start: number) => `${src}#t=${Math.floor(start)}`;

		return (
			<div
				{...rest}
				data-slot="episode-player"
				mix={mergeMix(
					[raw({ display: "flex", flexDirection: "column", gap: "1.25rem", minInlineSize: "0" })],
					mix,
				)}
			>
				<div data-slot="episode-player-header">
					<Heading mix={[raw({ margin: "0", fontSize: "1.25rem", lineHeight: "1.3" })]}>
						{title}
					</Heading>
					{meta ? (
						<p
							mix={[
								fg("neutral.muted"),
								raw({ margin: "0.25rem 0 0", fontVariantNumeric: "tabular-nums" }),
							]}
						>
							{meta}
						</p>
					) : null}
				</div>
				<audio
					controls
					preload="metadata"
					data-slot="episode-player-audio"
					mix={[raw({ display: "block", inlineSize: "100%" })]}
				>
					<source src={src} type={type} />
					<track
						kind="captions"
						src={captions.src}
						srclang={captions.srclang}
						label={captions.label}
					/>
					{fallback}
				</audio>
				<EpisodeSync />
				{chapters.length > 0 ? (
					<nav aria-label={chaptersLabel} data-slot="episode-player-chapters">
						<ol
							mix={[
								raw({
									margin: "0",
									padding: "0",
									listStyle: "none",
									borderBlockStart: `1px solid ${HAIRLINE}`,
								}),
							]}
						>
							{chapters.map((chapter) => (
								<li key={chapter.start} mix={[raw({ borderBlockEnd: `1px solid ${HAIRLINE}` })]}>
									<a
										href={at(chapter.start)}
										data-start={chapter.start}
										mix={[
											raw({
												display: "grid",
												gridTemplateColumns: "4.5rem minmax(0, 1fr)",
												gap: "1rem",
												paddingBlock: "0.625rem",
												color: "var(--ui-neutral-fg)",
												textDecoration: "none",
											}),
											hover(raw({ color: "var(--ui-brand-fg)" })),
											focusVisible(
												raw({ outline: "2px solid var(--ui-focus-ring, var(--ui-brand-fg))" }),
											),
											when(
												'&[aria-current="true"]',
												raw({ color: "var(--ui-brand-fg)", fontWeight: "600" }),
											),
										]}
									>
										<time
											dateTime={isoDuration(chapter.start)}
											mix={[raw({ fontVariantNumeric: "tabular-nums", opacity: "0.75" })]}
										>
											{formatEpisodeTime(chapter.start)}
										</time>
										<span>{chapter.title}</span>
									</a>
								</li>
							))}
						</ol>
					</nav>
				) : null}
				{transcript.length > 0 ? (
					<details data-slot="episode-player-transcript">
						<summary
							mix={[
								raw({ cursor: "pointer", fontWeight: "600", inlineSize: "fit-content" }),
								focusVisible(
									raw({ outline: "2px solid var(--ui-focus-ring, var(--ui-brand-fg))" }),
								),
							]}
						>
							{transcriptLabel}
						</summary>
						<div
							mix={[
								raw({
									display: "flex",
									flexDirection: "column",
									gap: "1rem",
									marginBlockStart: "1rem",
								}),
							]}
						>
							{transcript.map((cue) => (
								<p
									key={cue.start}
									data-slot="episode-player-cue"
									data-cue={cue.start}
									mix={[
										raw({
											margin: "0",
											paddingInlineStart: "0.875rem",
											borderInlineStart: "2px solid transparent",
										}),
										when(
											'&[aria-current="true"]',
											raw({ borderInlineStartColor: "var(--ui-brand-fg)" }),
										),
									]}
								>
									<a href={at(cue.start)} data-start={cue.start} mix={timeLink()}>
										<time dateTime={isoDuration(cue.start)}>{formatEpisodeTime(cue.start)}</time>
									</a>{" "}
									{cue.speaker ? (
										<strong mix={[raw({ fontWeight: "600" })]}>{cue.speaker}</strong>
									) : null}{" "}
									{cue.text}
								</p>
							))}
						</div>
					</details>
				) : null}
				{note ? <p mix={[fg("neutral.muted"), raw({ margin: "0" })]}>{note}</p> : null}
			</div>
		);
	};
}

/**
 * The island inside every {@link EpisodePlayer}: a hidden marker that runs the seeking and
 * current-chapter behaviour. It loads from the `@sdxc/ui/landing/episode-player` specifier,
 * which the app's browser entry maps to a dynamic import.
 */
export const EpisodeSync: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/landing/episode-player#EpisodeSync",
	function EpisodeSync() {
		return () => <span mix={[hidden(), episodeSync()]} />;
	},
);
