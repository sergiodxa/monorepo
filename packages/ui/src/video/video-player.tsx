/**
 * A video player built on the browser's own `<video>`: chapters and captions written as
 * WebVTT tracks from data, time links that work without script, and a custom control bar
 * with a settings menu pages extend, which replaces the native controls once script runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { combine, mergeMix, raw } from "@sdxc/u/general";
import { container, hidden } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import { Popover } from "../components/popover.js";

import { videoPlayerSync } from "./mixins/video-player-sync.js";
import {
	formatVideoTime,
	isoDuration,
	playedShare,
	playingIndex,
	webVttUrl,
} from "./utils/timeline.js";

/** Container the player's two columns query. */
const CONTAINER = "ui-video-player";

/** Outer radius of the player; the screen and rows nest smaller radii inside it. */
const RADIUS = "var(--ui-video-player-radius, var(--ui-landing-radius-frame, 0.75rem))";

/** Ink of the bar and the settings menu, which sit on the picture in any page scheme. */
const ON_VIDEO = "var(--ui-video-player-on-video, oklch(0.97 0 0))";

/** Muted ink on the picture, for values and the time's length. */
const ON_VIDEO_MUTED = "var(--ui-video-player-on-video-muted, oklch(0.8 0 0))";

/** Wash behind a hovered control or row on the picture. */
const ON_VIDEO_WASH = "var(--ui-video-player-on-video-wash, rgb(255 255 255 / 0.14))";

/** Fill of the progress slider and an on switch. */
const ON_VIDEO_ACCENT = "var(--ui-video-player-progress-color, oklch(0.63 0.22 27))";

/**
 * The player's inks for each tone. `theater` keeps its night whatever scheme the page is in,
 * so a dark screening room can sit inside a bright page.
 */
const TONES: Record<VideoPlayer.Tone, Record<`--${string}`, string>> = {
	plain: {
		"--ui-video-player-bg": "var(--ui-surface-raised, Canvas)",
		"--ui-video-player-emphasis": "var(--ui-neutral-fg-emphasis)",
		"--ui-video-player-body": "var(--ui-neutral-fg)",
		"--ui-video-player-muted": "var(--ui-neutral-fg-muted)",
		"--ui-video-player-accent": "var(--ui-brand-fg)",
		"--ui-video-player-line":
			"var(--ui-landing-hairline, color-mix(in oklch, CanvasText 10%, transparent))",
		"--ui-video-player-wash": "color-mix(in oklch, CanvasText 5%, transparent)",
		"--ui-video-player-shadow": "0 0 0 1px var(--ui-video-player-line)",
	},
	theater: {
		"--ui-video-player-bg":
			"color-mix(in oklch, var(--ui-color-neutral-950, oklch(0.165 0.006 270)) 94%, var(--ui-color-brand-900, oklch(0.245 0.05 270)))",
		"--ui-video-player-emphasis": "var(--ui-color-neutral-50, oklch(0.985 0.002 270))",
		"--ui-video-player-body": "var(--ui-color-neutral-300, oklch(0.81 0.006 270))",
		"--ui-video-player-muted": "var(--ui-color-neutral-400, oklch(0.71 0.008 270))",
		"--ui-video-player-accent": "var(--ui-color-brand-300, oklch(0.81 0.08 270))",
		"--ui-video-player-line": "color-mix(in oklch, white 12%, transparent)",
		"--ui-video-player-wash": "color-mix(in oklch, white 7%, transparent)",
		"--ui-video-player-shadow":
			"0 0 0 1px var(--ui-video-player-line), 0 30px 60px -20px rgb(0 0 0 / 0.45)",
	},
};

/** Surface of the settings menu over the picture. */
const MENU_BG = "var(--ui-video-player-menu-bg, rgb(28 28 30 / 0.96))";

/** Colour scheme of a player that names none. */
const DEFAULT_TONE: VideoPlayer.Tone = "plain";

/** Language of the generated tracks when the screen names none. */
const DEFAULT_LANGUAGE = "en";

/** Playback rates {@link VideoPlayer.SpeedMenu} offers unless given its own. */
const DEFAULT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** Prop and context types for {@link VideoPlayer} and its parts. */
export namespace VideoPlayer {
	/** `plain` follows the page's scheme; `theater` is a dark screening room in either. */
	export type Tone = "plain" | "theater";

	/** One chapter, from its start to the next chapter's start or the video's end. */
	export interface Chapter {
		/** Seconds from the start of the video. */
		start: number;
		/** Shown in the chapter list and written to the chapters track. */
		title: string;
		/** A small 16:9 still for the chapter's row, usually inline SVG or an `<img>`. */
		thumbnail?: RemixNode;
	}

	/** One line of the transcript, shown until the next line starts. */
	export interface Cue {
		/** Seconds from the start of the video. */
		start: number;
		/** What is said; also written to the captions track. */
		text: string;
	}

	/**
	 * Props accepted by {@link VideoPlayer}: the timeline every part reads. Chapters and
	 * lines are given once, and feed the native tracks, the scrubber and the lists alike.
	 */
	export interface Props extends TagProps<"figure"> {
		/** Length in seconds; it closes the last chapter and the last caption. */
		duration: number;
		/** Chapters in playing order. */
		chapters?: readonly Chapter[];
		/** Spoken lines in playing order. */
		transcript?: readonly Cue[];
		/** The moment the page renders as now, in seconds, before the island takes over. */
		current?: number;
		/** Colour scheme of the player. @default "plain" */
		tone?: Tone;
		/** The parts, in reading order; a {@link VideoPlayer.Side} becomes the second column. */
		children: RemixNode;
	}

	/** One file the player may play, as the quality menu and the settings badge read it. */
	export interface SourceInfo {
		/** The file's address, which the quality menu swaps the video to. */
		src: string;
		/** The source's name in the quality menu, which falls back to the file's name. */
		label?: string;
		/** The source's `badge`, shown on the gear while this file plays. */
		badge?: string;
	}

	/** One captions or subtitles track, as the captions menu lists it. */
	export interface CaptionsInfo {
		/** The track's name in the captions menu. */
		label: string;
		/** The track's `srclang`, when it names one. */
		language?: string;
	}

	/** What {@link VideoPlayer} shares with its parts. */
	export interface Context {
		/** The player's `duration`, in seconds. */
		duration: number;
		/** The player's chapters, empty when it gives none. */
		chapters: readonly Chapter[];
		/** The player's transcript lines, empty when it gives none. */
		transcript: readonly Cue[];
		/** The moment the server renders as now, in seconds. */
		current?: number;
		/** The first source's address, which every time link points into. */
		href?: string;
		/** Every {@link VideoPlayer.Source}, in preference order. */
		sources: readonly SourceInfo[];
		/** The captions tracks in the order the video holds them. */
		captions: readonly CaptionsInfo[];
	}

	/** Props accepted by {@link VideoPlayer.Screen}. */
	export interface ScreenProps extends Omit<TagProps<"div">, "children"> {
		/** The video's accessible name. */
		label: string;
		/** Image shown before playback, as the native `poster`. */
		poster?: string;
		/** Language of the chapters and captions tracks. @default "en" */
		language?: string;
		/** The captions track's name in the player's menus, such as "English". */
		captionsLabel: string;
		/** The chapters track's name, such as "Chapters". */
		chaptersLabel: string;
		/**
		 * {@link VideoPlayer.Source} elements in preference order, any extra `<track>`, an
		 * optional {@link VideoPlayer.Frame} and an optional {@link VideoPlayer.Controls}.
		 */
		children: RemixNode;
	}

	/** Props accepted by {@link VideoPlayer.Source}. */
	export interface SourceProps extends Omit<TagProps<"source">, "children"> {
		/** The file's address; the first source's is where every time link points. */
		src: string;
		/** Media type, such as `video/webm`, so the browser skips files it cannot play. */
		type?: string;
		/** The file's name in the quality menu, such as `1080p`; the file name stands in when unset. */
		label?: string;
		/** Short mark beside the label and on the settings gear, such as `HD` or `4K`. */
		badge?: string;
	}

	/** Props accepted by {@link VideoPlayer.Caption}. */
	export interface CaptionProps extends TagProps<"figcaption"> {
		/** Small print at the inline end, such as "Lesson 7 · 11:43". */
		meta?: RemixNode;
	}

	/** Props accepted by {@link VideoPlayer.Chapters}. */
	export interface ChaptersProps extends Omit<TagProps<"nav">, "children"> {
		/** The visible label and the list's accessible name. */
		label: string;
	}

	/** Props accepted by {@link VideoPlayer.Transcript}. */
	export interface TranscriptProps extends Omit<TagProps<"div">, "children"> {
		/** The visible label and the scroll region's accessible name. */
		label: string;
	}

	/** Props accepted by {@link VideoPlayer.Controls}. */
	export interface ControlsProps extends TagProps<"div"> {
		/** The bar's accessible name, such as "Video controls". */
		label: string;
	}

	/** Props accepted by a bar button that only needs its accessible name. */
	export interface ButtonProps extends Omit<TagProps<"button">, "children" | "type"> {
		/** The button's accessible name. */
		label: string;
	}

	/** Props accepted by {@link VideoPlayer.Play}. */
	export interface PlayProps extends ButtonProps {
		/** The name while the video plays; `label` is the name while it is paused. */
		pauseLabel: string;
	}

	/** Props accepted by {@link VideoPlayer.Progress}. */
	export interface ProgressProps extends Omit<
		TagProps<"input">,
		"type" | "min" | "max" | "value" | "children" | "role"
	> {
		/** The slider's accessible name, such as "Seek". */
		label: string;
	}

	/** Props accepted by {@link VideoPlayer.Settings}. */
	export interface SettingsProps extends ButtonProps {
		/** The menu's id, which the gear's `commandfor` names. Defaults to a generated one. */
		id?: string;
		/**
		 * Mark on the gear. Left out, it is the playing source's badge and follows the
		 * quality menu; `false` draws none.
		 */
		badge?: string | false;
		/** Rows of the menu, in order. */
		children: RemixNode;
	}

	/** Props accepted by {@link VideoPlayer.SettingsToggle}. */
	export interface SettingsToggleProps extends Omit<
		TagProps<"input">,
		"type" | "name" | "children"
	> {
		/** The form name a `change` listener reads the switch by. */
		name: string;
		/** The row's visible label. */
		label: RemixNode;
	}

	/** Props accepted by {@link VideoPlayer.SettingsMenu}. */
	export interface SettingsMenuProps extends Omit<TagProps<"div">, "children"> {
		/** The radio group's form name, which a `change` listener reads the choice by. */
		name: string;
		/** The row's visible label, repeated on the submenu's back row. */
		label: RemixNode;
		/** The back row's accessible prefix, such as "Back". */
		backLabel: string;
		/** {@link VideoPlayer.SettingsOption} elements; the one marked `checked` is chosen. */
		children: RemixNode;
	}

	/** What {@link VideoPlayer.SettingsMenu} shares with its options. */
	export interface SettingsMenuContext {
		/** The radio group's form name every option takes. */
		name: string;
	}

	/** Props accepted by {@link VideoPlayer.SettingsOption}. */
	export interface SettingsOptionProps extends Omit<
		TagProps<"input">,
		"type" | "name" | "children" | "value"
	> {
		/** The value a `change` listener reads from the menu's `name` once this is chosen. */
		value: string;
		/** A short mark after the label, such as `4K`. */
		badge?: RemixNode;
		/** The option's visible label, which its submenu's row repeats once chosen. */
		children: RemixNode;
	}

	/** Props shared by the built-in submenus. */
	export interface BuiltInMenuProps extends Omit<TagProps<"div">, "children"> {
		/** The row's visible label. */
		label: string;
		/** The back row's accessible prefix, such as "Back". */
		backLabel: string;
	}

	/** Props accepted by {@link VideoPlayer.CaptionsMenu}. */
	export interface CaptionsMenuProps extends BuiltInMenuProps {
		/** The option that hides every track, such as "Off". */
		offLabel: string;
	}

	/** Props accepted by {@link VideoPlayer.SpeedMenu}. */
	export interface SpeedMenuProps extends BuiltInMenuProps {
		/** Rates offered, in order. @default [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] */
		rates?: readonly number[];
		/** The name of rate 1, such as "Normal". */
		normalLabel: string;
	}
}

/** Whether a rendered node is an element of the given component or tag. */
function isElementOf(node: unknown, type: unknown): node is { props: Record<string, unknown> } {
	return (
		typeof node === "object" &&
		node !== null &&
		"$rmx" in node &&
		"type" in node &&
		node.type === type
	);
}

/** The children of a node as a flat list, through arrays. */
function flatten(node: RemixNode): unknown[] {
	return Array.isArray(node) ? node.flatMap((child: RemixNode) => flatten(child)) : [node];
}

/**
 * Every element of `type` in a tree of children, in document order, searched depth first
 * through the children of every element on the way.
 */
function findAll(node: RemixNode, type: unknown): { props: Record<string, unknown> }[] {
	let found: { props: Record<string, unknown> }[] = [];
	for (let child of flatten(node)) {
		if (isElementOf(child, type)) found.push(child);
		else if (typeof child === "object" && child !== null && "props" in child) {
			found.push(...findAll((child as { props: { children?: RemixNode } }).props.children, type));
		}
	}
	return found;
}

/** A prop read as a string, or `undefined` when it is anything else. */
function text(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

/**
 * The captions tracks a video will hold: the page's own `<track>` elements of kind
 * captions or subtitles, then the one written from the transcript.
 */
function captionsOf(children: RemixNode, transcript: readonly VideoPlayer.Cue[]) {
	let screen = findAll(children, VideoPlayer.Screen)[0];
	let own = findAll(screen?.props.children as RemixNode, "track")
		.filter((track) => track.props.kind === "captions" || track.props.kind === "subtitles")
		.map((track) => ({
			label: text(track.props.label) ?? "",
			language: text(track.props.srcLang) ?? text(track.props.srclang),
		}));
	if (transcript.length === 0) return own;
	return [
		...own,
		{
			label: text(screen?.props.captionsLabel) ?? "",
			language: text(screen?.props.language) ?? DEFAULT_LANGUAGE,
		},
	];
}

/**
 * A `<figure>` sharing one timeline with its parts; with no script its native controls play and
 * time links open the file there. Map {@link VideoPlayerSync} (`@sdxc/ui/video/video-player`) for
 * the bar. Theming: `--ui-video-player-` radius, progress-color, menu-bg, on-video, transcript-height.
 *
 * @param handle Runtime handle carrying the host `<figure>`'s props.
 * @returns The render function producing the player.
 * @example
 * <VideoPlayer duration={703} chapters={chapters}>
 * 	<VideoPlayer.Screen label="Centering 3 kg" captionsLabel="English" chaptersLabel="Chapters"><VideoPlayer.Source src="/07.mp4" type="video/mp4" /></VideoPlayer.Screen>
 * 	<VideoPlayer.Side><VideoPlayer.Chapters label="Chapters" /></VideoPlayer.Side>
 * </VideoPlayer>
 * @example
 * <VideoPlayer duration={703} chapters={chapters} transcript={lines} tone="theater">
 * 	<VideoPlayer.Screen label="Centering 3 kg" captionsLabel="English" chaptersLabel="Chapters">
 * 		<VideoPlayer.Source src="/07.mp4" type="video/mp4" label="1080p" badge="HD" />
 * 		<VideoPlayer.Controls label="Video controls"><VideoPlayer.Progress label="Seek" /><VideoPlayer.Play label="Play" pauseLabel="Pause" /><VideoPlayer.Time /></VideoPlayer.Controls>
 * 	</VideoPlayer.Screen>
 * 	<VideoPlayer.Side><VideoPlayer.Transcript label="Transcript" /></VideoPlayer.Side>
 * </VideoPlayer>
 */
export function VideoPlayer(handle: Handle<VideoPlayer.Props, VideoPlayer.Context>) {
	return () => {
		let {
			chapters = [],
			children,
			current,
			duration,
			mix,
			tone = DEFAULT_TONE,
			transcript = [],
			...rest
		} = handle.props;
		let sources = findAll(children, VideoPlayer.Source).map((source) => ({
			src: text(source.props.src) ?? "",
			label: text(source.props.label),
			badge: text(source.props.badge),
		}));
		handle.context.set({
			duration,
			chapters,
			transcript,
			current,
			href: sources[0]?.src,
			sources,
			captions: captionsOf(children, transcript),
		});

		let parts = flatten(children);
		let side = parts.filter((part) => isElementOf(part, VideoPlayer.Side)) as RemixNode[];
		let main = parts.filter((part) => !isElementOf(part, VideoPlayer.Side)) as RemixNode[];

		return (
			<figure
				{...rest}
				data-slot="video-player"
				data-tone={tone}
				mix={mergeMix(
					[
						container(CONTAINER),
						raw({
							...TONES[tone],
							margin: "0",
							padding: "clamp(0.75rem, 2.5cqi, 1.5rem)",
							boxSizing: "border-box",
							inlineSize: "100%",
							colorScheme: tone === "theater" ? "dark" : "inherit",
							color: "var(--ui-video-player-body)",
							backgroundColor: "var(--ui-video-player-bg)",
							borderRadius: RADIUS,
							boxShadow: "var(--ui-video-player-shadow)",
							textAlign: "start",
						}),
					],
					mix,
				)}
			>
				<VideoPlayerSync />
				<div
					data-slot="video-player-layout"
					mix={[
						combine([
							raw({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1.25rem" }),
							side.length > 0
								? at(
										"lg",
										CONTAINER,
										raw({
											gridTemplateColumns: "minmax(0, 1.8fr) minmax(16rem, 1fr)",
											alignItems: "start",
										}),
									)
								: [],
							when("[data-theater] > &", raw({ gridTemplateColumns: "minmax(0, 1fr)" })),
						]),
					]}
				>
					<div
						data-slot="video-player-main"
						mix={[raw({ display: "grid", gap: "0.875rem", minInlineSize: "0" })]}
					>
						{main}
					</div>
					{side}
				</div>
			</figure>
		);
	};
}

/** Reads the timeline a part's {@link VideoPlayer} shares. */
function timeline(handle: Handle<unknown>): VideoPlayer.Context {
	let context = handle.context.get(VideoPlayer) as VideoPlayer.Context | undefined;
	return context ?? { duration: 0, chapters: [], transcript: [], sources: [], captions: [] };
}

/** The address a time link opens without script: the first source at that second. */
function timeHref(context: VideoPlayer.Context, start: number): string {
	return `${context.href ?? ""}#t=${Math.floor(start)}`;
}

/**
 * The 16:9 screen: a native `<video controls>` holding its sources and the chapters and
 * captions tracks written from the timeline, over a {@link VideoPlayer.Frame} when given,
 * under a {@link VideoPlayer.Controls} bar that takes over from the native controls.
 *
 * @param handle Runtime handle carrying the screen's props.
 * @returns The render function producing the screen.
 * @example
 * <VideoPlayer.Screen label="Centering 3 kg" poster="/07.jpg" captionsLabel="English" chaptersLabel="Chapters"><VideoPlayer.Source src="/07.mp4" type="video/mp4" /></VideoPlayer.Screen>
 */
VideoPlayer.Screen = function VideoPlayerScreen(handle: Handle<VideoPlayer.ScreenProps>) {
	return () => {
		let {
			captionsLabel,
			chaptersLabel,
			children,
			label,
			language = DEFAULT_LANGUAGE,
			mix,
			poster,
			...rest
		} = handle.props;
		let { chapters, duration, transcript } = timeline(handle);
		let nodes = flatten(children);
		let frames = nodes.filter((node) => isElementOf(node, VideoPlayer.Frame)) as RemixNode[];
		let bars = nodes.filter((node) => isElementOf(node, VideoPlayer.Controls)) as RemixNode[];
		let sources = nodes.filter(
			(node) => !isElementOf(node, VideoPlayer.Frame) && !isElementOf(node, VideoPlayer.Controls),
		) as RemixNode[];

		return (
			<div
				{...rest}
				data-slot="video-player-screen"
				mix={mergeMix(
					[
						raw({
							position: "relative",
							aspectRatio: "16 / 9",
							overflow: "clip",
							borderRadius: `max(0px, calc(${RADIUS} - 0.375rem))`,
							backgroundColor: "black",
						}),
						when(
							"& > video, & > [data-slot='video-player-frame']",
							raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" }),
						),
						when(
							"&:fullscreen",
							raw({
								aspectRatio: "auto",
								borderRadius: "0",
								inlineSize: "100%",
								blockSize: "100%",
							}),
						),
					],
					mix,
				)}
			>
				{frames}
				<video
					data-slot="video-player-video"
					controls
					preload="metadata"
					playsInline
					poster={poster}
					aria-label={label}
					mix={[raw({ objectFit: "contain", backgroundColor: "transparent" })]}
				>
					{sources}
					{chapters.length > 0 ? (
						<track
							kind="chapters"
							srcLang={language}
							label={chaptersLabel}
							src={webVttUrl(
								chapters.map((chapter) => ({ start: chapter.start, text: chapter.title })),
								duration,
							)}
						/>
					) : null}
					<track
						kind="captions"
						srcLang={language}
						label={captionsLabel}
						src={webVttUrl(transcript, duration)}
						data-empty={transcript.length === 0 ? "" : undefined}
					/>
				</video>
				{bars}
			</div>
		);
	};
};

/**
 * One file the video may play, in preference order, exactly as a `<source>` inside
 * `<video>`; the first one also gives every time link its address. A `label` names it in
 * the quality menu and a `badge` marks it there and on the settings gear.
 *
 * @param handle Runtime handle carrying the `<source>`'s props.
 * @returns The render function producing the source.
 * @example <VideoPlayer.Source src="/07-2160.mp4" type="video/mp4" label="2160p" badge="4K" />
 */
VideoPlayer.Source = function VideoPlayerSource(handle: Handle<VideoPlayer.SourceProps>) {
	return () => {
		let { badge, label, ...rest } = handle.props;
		return <source {...rest} data-label={label} data-badge={badge} />;
	};
};

/**
 * A drawn still under the video: it shows before playback and through any transparent
 * part of the picture while it plays. Decorative, so hidden from assistive technology.
 *
 * @param handle Runtime handle carrying the frame's props.
 * @returns The render function producing the frame.
 * @example <VideoPlayer.Frame><WheelFrame /></VideoPlayer.Frame>
 */
VideoPlayer.Frame = function VideoPlayerFrame(handle: Handle<TagProps<"div">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="video-player-frame"
				aria-hidden="true"
				mix={mergeMix(
					[when("& > svg", raw({ display: "block", inlineSize: "100%", blockSize: "100%" }))],
					mix,
				)}
			/>
		);
	};
};

/**
 * The chapters as one bar of segments as long as each chapter, filled to the current
 * moment, so the video's shape shows before it plays. It repeats the chapter list, so it is
 * hidden from assistive technology.
 *
 * @param handle Runtime handle carrying the bar's props.
 * @returns The render function producing the bar.
 */
VideoPlayer.Scrubber = function VideoPlayerScrubber(
	handle: Handle<Omit<TagProps<"div">, "children">>,
) {
	return () => {
		let { mix, ...rest } = handle.props;
		let { chapters, current, duration } = timeline(handle);
		return (
			<div
				{...rest}
				data-slot="video-player-scrubber"
				aria-hidden="true"
				mix={mergeMix([raw({ display: "flex", gap: "3px", blockSize: "0.375rem" })], mix)}
			>
				{chapters.map((chapter, index) => {
					let end = chapters[index + 1]?.start ?? duration;
					return (
						<span
							key={chapter.start}
							data-slot="video-player-segment"
							data-start={chapter.start}
							data-end={end}
							style={{
								"--ui-video-player-played": `${playedShare(chapter.start, end, current) * 100}%`,
							}}
							mix={[segment(end - chapter.start)]}
						/>
					);
				})}
			</div>
		);
	};
};

/**
 * The video's title line: the title at the start, small print at the end, wrapping
 * under each other on a narrow screen.
 *
 * @param handle Runtime handle carrying the `<figcaption>`'s props.
 * @returns The render function producing the caption.
 * @example <VideoPlayer.Caption meta="Lesson 7 · 11:43">Centering 3 kg</VideoPlayer.Caption>
 */
VideoPlayer.Caption = function VideoPlayerCaption(handle: Handle<VideoPlayer.CaptionProps>) {
	return () => {
		let { children, meta, mix, ...rest } = handle.props;
		return (
			<figcaption
				{...rest}
				data-slot="video-player-caption"
				mix={mergeMix(
					[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "baseline",
							justifyContent: "space-between",
							columnGap: "1rem",
							rowGap: "0.25rem",
						}),
					],
					mix,
				)}
			>
				<span
					data-slot="video-player-title"
					mix={[
						raw({
							color: "var(--ui-video-player-emphasis)",
							fontSize: "var(--ui-text-lg, 1.125rem)",
							lineHeight: "1.5rem",
							fontWeight: "600",
							textWrap: "balance",
						}),
					]}
				>
					{children}
				</span>
				{meta ? <span mix={[monoSmall()]}>{meta}</span> : null}
			</figcaption>
		);
	};
};

/**
 * The second column: chapters, transcript and anything the page adds, such as a card for
 * the next video, stacked in order.
 *
 * @param handle Runtime handle carrying the column's props.
 * @returns The render function producing the column.
 */
VideoPlayer.Side = function VideoPlayerSide(handle: Handle<TagProps<"div">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="video-player-side"
				mix={mergeMix([raw({ display: "grid", gap: "1.25rem", minInlineSize: "0" })], mix)}
			/>
		);
	};
};

/**
 * The chapters as links to their moments, each with its still when given; the chapter
 * playing carries `aria-current`.
 *
 * @param handle Runtime handle carrying the list's props.
 * @returns The render function producing the chapter list.
 * @example <VideoPlayer.Chapters label="Chapitres" />
 */
VideoPlayer.Chapters = function VideoPlayerChapters(handle: Handle<VideoPlayer.ChaptersProps>) {
	return () => {
		let { label, mix, ...rest } = handle.props;
		let context = timeline(handle);
		let playing = playingIndex(
			context.chapters.map((chapter) => chapter.start),
			context.current,
		);
		return (
			<nav
				{...rest}
				aria-label={label}
				mix={mergeMix([raw({ display: "grid", gap: "0.5rem" })], mix)}
			>
				<p aria-hidden="true" mix={[sideLabel()]}>
					{label}
				</p>
				<ol data-slot="video-player-chapters" mix={[plainList(), raw({ gap: "0.125rem" })]}>
					{context.chapters.map((chapter, index) => (
						<li key={chapter.start}>
							<a
								href={timeHref(context, chapter.start)}
								data-start={chapter.start}
								aria-current={index === playing ? "true" : undefined}
								mix={[chapterLink()]}
							>
								{chapter.thumbnail ? (
									<span data-slot="video-player-thumbnail" aria-hidden="true">
										{chapter.thumbnail}
									</span>
								) : null}
								<span mix={[raw({ minInlineSize: "0", textWrap: "pretty" })]}>{chapter.title}</span>
								<time dateTime={isoDuration(chapter.start)} mix={[monoSmall()]}>
									{formatVideoTime(chapter.start)}
								</time>
							</a>
						</li>
					))}
				</ol>
			</nav>
		);
	};
};

/**
 * The transcript in a scroll region, each line behind a link to its moment; the line
 * playing carries `aria-current` and the island keeps it in view.
 *
 * @param handle Runtime handle carrying the transcript's props.
 * @returns The render function producing the transcript.
 * @example <VideoPlayer.Transcript label="Transcription" />
 */
VideoPlayer.Transcript = function VideoPlayerTranscript(
	handle: Handle<VideoPlayer.TranscriptProps>,
) {
	return () => {
		let { label, mix, ...rest } = handle.props;
		let context = timeline(handle);
		let playing = playingIndex(
			context.transcript.map((cue) => cue.start),
			context.current,
		);
		return (
			<div {...rest} mix={mergeMix([raw({ display: "grid", gap: "0.5rem" })], mix)}>
				<p aria-hidden="true" mix={[sideLabel()]}>
					{label}
				</p>
				<div
					data-slot="video-player-transcript"
					role="region"
					aria-label={label}
					mix={[
						raw({
							position: "relative",
							maxBlockSize: "var(--ui-video-player-transcript-height, 11rem)",
							overflowY: "auto",
							overscrollBehavior: "contain",
							paddingInlineEnd: "0.5rem",
							borderRadius: "0.25rem",
						}),
					]}
				>
					<ol mix={[plainList(), raw({ gap: "0.5rem" })]}>
						{context.transcript.map((cue, index) => (
							<li
								key={cue.start}
								data-slot="video-player-cue"
								data-cue={cue.start}
								aria-current={index === playing ? "true" : undefined}
								mix={[cueRow()]}
							>
								<a href={timeHref(context, cue.start)} data-start={cue.start} mix={[timeLink()]}>
									<time dateTime={isoDuration(cue.start)}>{formatVideoTime(cue.start)}</time>
								</a>
								<span>{cue.text}</span>
							</li>
						))}
					</ol>
				</div>
			</div>
		);
	};
};

/**
 * The custom control bar along the bottom of the screen, rendered `hidden` until the island
 * swaps it for the native controls. A {@link VideoPlayer.Progress} spans its top line and a
 * {@link VideoPlayer.Time} pushes what follows it to the inline end.
 *
 * @param handle Runtime handle carrying the bar's props.
 * @returns The render function producing the bar.
 * @example
 * <VideoPlayer.Controls label="Video controls">
 * 	<VideoPlayer.Progress label="Seek" /><VideoPlayer.Play label="Play" pauseLabel="Pause" /><VideoPlayer.Time /><VideoPlayer.Fullscreen label="Full screen" />
 * </VideoPlayer.Controls>
 */
VideoPlayer.Controls = function VideoPlayerControls(handle: Handle<VideoPlayer.ControlsProps>) {
	return () => {
		let { label, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				hidden
				role="group"
				aria-label={label}
				data-slot="video-player-controls"
				mix={mergeMix(
					[
						raw({
							position: "absolute",
							insetInline: "0",
							insetBlockEnd: "0",
							zIndex: "1",
							flexWrap: "wrap",
							alignItems: "center",
							columnGap: "0.125rem",
							padding: "2rem 0.5rem 0.25rem",
							colorScheme: "dark",
							color: ON_VIDEO,
							backgroundImage: "linear-gradient(to top, rgb(0 0 0 / 0.72), transparent)",
						}),
						when("&:not([hidden])", raw({ display: "flex" })),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * The seek slider: a native range over the video's length, so arrow keys, Home and End
 * seek and assistive technology reads the time. It spans the bar's first line.
 *
 * @param handle Runtime handle carrying the `<input>`'s props.
 * @returns The render function producing the slider.
 * @example <VideoPlayer.Progress label="Buscar" />
 */
VideoPlayer.Progress = function VideoPlayerProgress(handle: Handle<VideoPlayer.ProgressProps>) {
	return () => {
		let { label, mix, ...rest } = handle.props;
		let { current = 0, duration } = timeline(handle);
		return (
			<input
				{...rest}
				type="range"
				min="0"
				max={String(duration)}
				step="any"
				value={String(current)}
				aria-label={label}
				aria-valuetext={`${formatVideoTime(current)} / ${formatVideoTime(duration)}`}
				data-slot="video-player-progress"
				mix={mergeMix(
					[
						raw({
							order: "-1",
							flexBasis: "100%",
							inlineSize: "100%",
							blockSize: "1.25rem",
							margin: "0",
							accentColor: ON_VIDEO_ACCENT,
							cursor: "pointer",
						}),
						onVideoFocus(),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Plays and pauses; its accessible name says what a press does next.
 *
 * @param handle Runtime handle carrying the button's props.
 * @returns The render function producing the button.
 * @example <VideoPlayer.Play label="Reproducir" pauseLabel="Pausar" />
 */
VideoPlayer.Play = function VideoPlayerPlay(handle: Handle<VideoPlayer.PlayProps>) {
	return () => {
		let { label, mix, pauseLabel, ...rest } = handle.props;
		return (
			<button
				{...rest}
				type="button"
				aria-label={label}
				data-label-play={label}
				data-label-pause={pauseLabel}
				data-video-action="play"
				mix={mergeMix(
					[
						barButton(),
						when("& > [data-icon='pause']", raw({ display: "none" })),
						when("[data-playing] & > [data-icon='play']", raw({ display: "none" })),
						when("[data-playing] & > [data-icon='pause']", raw({ display: "block" })),
					],
					mix,
				)}
			>
				<VideoIcon name="play" />
				<VideoIcon name="pause" />
			</button>
		);
	};
};

/**
 * The time played and the video's length, `1:12 / 11:43`. It takes the free space after
 * it, so the controls that follow sit at the bar's inline end.
 *
 * @param handle Runtime handle carrying the `<span>`'s props.
 * @returns The render function producing the reading.
 */
VideoPlayer.Time = function VideoPlayerTime(handle: Handle<Omit<TagProps<"span">, "children">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let { current = 0, duration } = timeline(handle);
		return (
			<span
				{...rest}
				data-slot="video-player-time"
				mix={mergeMix(
					[
						raw({
							marginInline: "0.375rem auto",
							fontFamily: "var(--ui-font-mono, ui-monospace, monospace)",
							fontSize: "0.8125rem",
							fontVariantNumeric: "tabular-nums",
							whiteSpace: "nowrap",
						}),
					],
					mix,
				)}
			>
				<span data-slot="video-player-elapsed">{formatVideoTime(current)}</span>
				<span aria-hidden="true" mix={[raw({ color: ON_VIDEO_MUTED })]}>
					{" / "}
				</span>
				<span data-slot="video-player-length" mix={[raw({ color: ON_VIDEO_MUTED })]}>
					{formatVideoTime(duration)}
				</span>
			</span>
		);
	};
};

/**
 * Turns captions on and off: on shows the track last chosen in the captions menu, the
 * first one at the start. `aria-pressed` says whether captions show.
 *
 * @param handle Runtime handle carrying the button's props.
 * @returns The render function producing the button.
 */
VideoPlayer.CaptionsToggle = function VideoPlayerCaptionsToggle(
	handle: Handle<VideoPlayer.ButtonProps>,
) {
	return () => {
		let { label, mix, ...rest } = handle.props;
		return (
			<button
				{...rest}
				type="button"
				aria-label={label}
				aria-pressed="false"
				data-video-action="captions"
				mix={mergeMix(
					[
						barButton(),
						when(
							"&[aria-pressed='true']::after",
							raw({
								content: "''",
								position: "absolute",
								insetInline: "0.625rem",
								insetBlockEnd: "0.375rem",
								blockSize: "2px",
								borderRadius: "1px",
								backgroundColor: ON_VIDEO_ACCENT,
							}),
						),
					],
					mix,
				)}
			>
				<VideoIcon name="captions" />
			</button>
		);
	};
};

/**
 * The settings gear and its menu: a Popover API surface the gear opens through
 * `commandfor`, holding toggles and submenus in order. A submenu replaces the top level in
 * place with a back row; the arrow keys walk the rows, → opens a submenu and ← leaves it.
 *
 * @param handle Runtime handle carrying the gear's props.
 * @returns The render function producing the gear and its menu.
 * @example
 * <VideoPlayer.Settings label="Settings">
 * 	<VideoPlayer.SettingsToggle name="ambient" label="Ambient mode" />
 * 	<VideoPlayer.SpeedMenu label="Playback speed" normalLabel="Normal" backLabel="Back" />
 * </VideoPlayer.Settings>
 */
VideoPlayer.Settings = function VideoPlayerSettings(handle: Handle<VideoPlayer.SettingsProps>) {
	return () => {
		let { badge, children, id = `${handle.id}-menu`, label, mix, ...rest } = handle.props;
		let follows = badge === undefined;
		let mark = follows ? timeline(handle).sources[0]?.badge : badge || undefined;
		return (
			<>
				<button
					{...rest}
					type="button"
					aria-label={label}
					aria-haspopup="menu"
					commandfor={id}
					command="toggle-popover"
					mix={mergeMix([barButton()], mix)}
				>
					<VideoIcon name="settings" />
					<span
						data-slot="video-player-badge"
						data-follows-quality={follows ? "" : undefined}
						hidden={mark === undefined}
						aria-hidden="true"
						mix={[gearBadge()]}
					>
						{mark}
					</span>
				</button>
				<Popover
					id={id}
					placement="top-end"
					data-slot="video-player-settings"
					mix={[menuSurface()]}
				>
					<div role="menu" aria-label={label} data-slot="video-player-menu">
						{children}
					</div>
				</Popover>
			</>
		);
	};
};

/**
 * A page-defined switch row: a real checkbox the page reads by `name` and follows with an
 * ordinary `change` listener, such as ambient mode or a voice boost.
 *
 * @param handle Runtime handle carrying the `<input>`'s props.
 * @returns The render function producing the row.
 * @example <VideoPlayer.SettingsToggle name="voice-boost" label="Voice boost" checked />
 */
VideoPlayer.SettingsToggle = function VideoPlayerSettingsToggle(
	handle: Handle<VideoPlayer.SettingsToggleProps>,
) {
	return () => {
		let { label, mix, ...rest } = handle.props;
		return (
			<label data-slot="video-player-row" mix={[menuRow()]}>
				<span mix={[raw({ flex: "1" })]}>{label}</span>
				<input
					{...rest}
					type="checkbox"
					role="menuitemcheckbox"
					aria-checked={rest.checked ? "true" : "false"}
					data-video-item=""
					mix={mergeMix([switchControl()], mix)}
				/>
			</label>
		);
	};
};

/**
 * A page-defined submenu: a row naming the current choice that opens a panel of
 * {@link VideoPlayer.SettingsOption} radios under one `name`, such as a sleep timer. Picking
 * one fires `change` and returns to the top level.
 *
 * @param handle Runtime handle carrying the panel's props.
 * @returns The render function producing the row and its panel.
 * @example
 * <VideoPlayer.SettingsMenu name="sleep" label="Sleep timer" backLabel="Back">
 * 	<VideoPlayer.SettingsOption value="off" checked>Off</VideoPlayer.SettingsOption>
 * 	<VideoPlayer.SettingsOption value="30">30 minutes</VideoPlayer.SettingsOption>
 * </VideoPlayer.SettingsMenu>
 */
VideoPlayer.SettingsMenu = function VideoPlayerSettingsMenu(
	handle: Handle<VideoPlayer.SettingsMenuProps, VideoPlayer.SettingsMenuContext>,
) {
	return () => {
		let { backLabel, children, label, mix, name, ...rest } = handle.props;
		handle.context.set({ name });
		let panelId = `${handle.id}-panel`;
		let chosen = findAll(children, VideoPlayer.SettingsOption).find(
			(option) => option.props.checked === true,
		);
		return (
			<div role="none" data-slot="video-player-submenu">
				<button
					type="button"
					role="menuitem"
					aria-haspopup="menu"
					aria-expanded="false"
					aria-controls={panelId}
					data-video-item=""
					data-video-action="open"
					data-slot="video-player-row"
					mix={[menuRow()]}
				>
					<span mix={[raw({ flex: "1" })]}>{label}</span>
					<span data-slot="video-player-row-value" mix={[raw({ color: ON_VIDEO_MUTED })]}>
						{chosen?.props.children as RemixNode}
					</span>
					<VideoIcon name="next" />
				</button>
				<div
					{...rest}
					id={panelId}
					role="menu"
					hidden
					data-slot="video-player-submenu-panel"
					mix={mergeMix([when("&:not([hidden])", raw({ display: "grid" }))], mix)}
				>
					<button
						type="button"
						role="menuitem"
						data-video-item=""
						data-video-action="back"
						mix={[
							menuRow(),
							raw({
								fontWeight: "600",
								borderBlockEnd: "1px solid rgb(255 255 255 / 0.16)",
								marginBlockEnd: "0.25rem",
							}),
						]}
					>
						<VideoIcon name="back" />
						<span mix={[visuallyHidden()]}>{`${backLabel}: `}</span>
						<span>{label}</span>
					</button>
					{children}
				</div>
			</div>
		);
	};
};

/**
 * One choice of a {@link VideoPlayer.SettingsMenu}: a real radio under the menu's name,
 * marked with a check when chosen.
 *
 * @param handle Runtime handle carrying the `<input>`'s props.
 * @returns The render function producing the option row.
 * @example <VideoPlayer.SettingsOption value="30">30 minutes</VideoPlayer.SettingsOption>
 */
VideoPlayer.SettingsOption = function VideoPlayerSettingsOption(
	handle: Handle<VideoPlayer.SettingsOptionProps>,
) {
	return () => {
		let { badge, children, mix, ...rest } = handle.props;
		let menu = handle.context.get(VideoPlayer.SettingsMenu) as
			| VideoPlayer.SettingsMenuContext
			| undefined;
		return (
			<label data-slot="video-player-option" mix={[menuRow()]}>
				<input
					{...rest}
					type="radio"
					role="menuitemradio"
					aria-checked={rest.checked ? "true" : "false"}
					name={menu?.name}
					data-video-item=""
					mix={mergeMix([checkMark()], mix)}
				/>
				<span data-slot="video-player-option-label">{children}</span>
				{badge ? <span mix={[optionBadge()]}>{badge}</span> : null}
			</label>
		);
	};
};

/**
 * The captions submenu: Off, then every captions and subtitles track the video holds. It
 * stays in step with {@link VideoPlayer.CaptionsToggle}.
 *
 * @param handle Runtime handle carrying the panel's props.
 * @returns The render function producing the submenu.
 */
VideoPlayer.CaptionsMenu = function VideoPlayerCaptionsMenu(
	handle: Handle<VideoPlayer.CaptionsMenuProps>,
) {
	return () => {
		let { label, offLabel, ...rest } = handle.props;
		let { captions } = timeline(handle);
		return (
			<VideoPlayer.SettingsMenu
				{...rest}
				name={`${handle.id}-captions`}
				label={label}
				data-video-setting="captions"
			>
				<VideoPlayer.SettingsOption value="-1" checked>
					{offLabel}
				</VideoPlayer.SettingsOption>
				{captions.map((track, index) => (
					<VideoPlayer.SettingsOption key={`${track.label}-${index}`} value={String(index)}>
						{track.label}
					</VideoPlayer.SettingsOption>
				))}
			</VideoPlayer.SettingsMenu>
		);
	};
};

/**
 * The playback speed submenu; a choice sets the video's `playbackRate` and survives a
 * quality change.
 *
 * @param handle Runtime handle carrying the panel's props.
 * @returns The render function producing the submenu.
 * @example <VideoPlayer.SpeedMenu label="Playback speed" normalLabel="Normal" backLabel="Back" rates={[1, 1.5, 2]} />
 */
VideoPlayer.SpeedMenu = function VideoPlayerSpeedMenu(handle: Handle<VideoPlayer.SpeedMenuProps>) {
	return () => {
		let { label, normalLabel, rates = DEFAULT_RATES, ...rest } = handle.props;
		return (
			<VideoPlayer.SettingsMenu
				{...rest}
				name={`${handle.id}-rate`}
				label={label}
				data-video-setting="rate"
			>
				{rates.map((rate) => (
					<VideoPlayer.SettingsOption key={rate} value={String(rate)} checked={rate === 1}>
						{rate === 1 ? normalLabel : String(rate)}
					</VideoPlayer.SettingsOption>
				))}
			</VideoPlayer.SettingsMenu>
		);
	};
};

/**
 * The quality submenu: one row per {@link VideoPlayer.Source}, by its `label` and `badge`.
 * A choice swaps the file and resumes from the same moment, and the gear's badge follows.
 *
 * @param handle Runtime handle carrying the panel's props.
 * @returns The render function producing the submenu.
 */
VideoPlayer.QualityMenu = function VideoPlayerQualityMenu(
	handle: Handle<VideoPlayer.BuiltInMenuProps>,
) {
	return () => {
		let { label, ...rest } = handle.props;
		let { sources } = timeline(handle);
		return (
			<VideoPlayer.SettingsMenu
				{...rest}
				name={`${handle.id}-quality`}
				label={label}
				data-video-setting="quality"
			>
				{sources.map((source, index) => (
					<VideoPlayer.SettingsOption
						key={source.src}
						value={String(index)}
						checked={index === 0}
						badge={source.badge}
					>
						{source.label ?? source.src.split("/").pop() ?? source.src}
					</VideoPlayer.SettingsOption>
				))}
			</VideoPlayer.SettingsMenu>
		);
	};
};

/**
 * Theater mode: sets `data-theater` on the player, which drops the side column under the
 * screen so the video takes the full width. It shows from the `lg` container width, where
 * the side column sits beside the screen; `aria-pressed` says whether it is on.
 *
 * @param handle Runtime handle carrying the button's props.
 * @returns The render function producing the button.
 */
VideoPlayer.Theater = function VideoPlayerTheater(handle: Handle<VideoPlayer.ButtonProps>) {
	return () => {
		let { label, mix, ...rest } = handle.props;
		return (
			<button
				{...rest}
				type="button"
				aria-label={label}
				aria-pressed="false"
				data-video-action="theater"
				mix={mergeMix(
					[
						barButtonShape(),
						raw({ display: "none" }),
						at("lg", CONTAINER, raw({ display: "inline-grid" })),
					],
					mix,
				)}
			>
				<VideoIcon name="theater" />
			</button>
		);
	};
};

/**
 * Full screen for the screen with its bar, so the controls stay. It hides itself where
 * the browser offers no full screen.
 *
 * @param handle Runtime handle carrying the button's props.
 * @returns The render function producing the button.
 */
VideoPlayer.Fullscreen = function VideoPlayerFullscreen(handle: Handle<VideoPlayer.ButtonProps>) {
	return () => {
		let { label, mix, ...rest } = handle.props;
		return (
			<button
				{...rest}
				type="button"
				aria-label={label}
				aria-pressed="false"
				data-video-action="fullscreen"
				mix={mergeMix(
					[
						barButton(),
						when("& > [data-icon='exit-fullscreen']", raw({ display: "none" })),
						when("&[aria-pressed='true'] > [data-icon='fullscreen']", raw({ display: "none" })),
						when(
							"&[aria-pressed='true'] > [data-icon='exit-fullscreen']",
							raw({ display: "block" }),
						),
					],
					mix,
				)}
			>
				<VideoIcon name="fullscreen" />
				<VideoIcon name="exit-fullscreen" />
			</button>
		);
	};
};

/** The glyphs the bar and the menu draw. */
type IconName =
	| "play"
	| "pause"
	| "captions"
	| "settings"
	| "theater"
	| "fullscreen"
	| "exit-fullscreen"
	| "next"
	| "back";

/** A 24px glyph in the current colour, decorative because its button carries the name. */
function VideoIcon(handle: Handle<{ name: IconName }>) {
	return () => {
		let { name } = handle.props;
		let stroke = {
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2",
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
		} as const;
		return (
			<svg
				viewBox="0 0 24 24"
				aria-hidden="true"
				data-icon={name}
				mix={[raw({ inlineSize: "1.5rem", blockSize: "1.5rem", flexShrink: "0" })]}
			>
				{name === "play" ? <path d="M8 5.5v13l11-6.5z" fill="currentColor" /> : null}
				{name === "pause" ? (
					<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
				) : null}
				{name === "captions" ? (
					<>
						<rect x="3" y="5" width="18" height="14" rx="2.5" {...stroke} />
						<path d="M10.5 10a2 2 0 1 0 0 4M16.5 10a2 2 0 1 0 0 4" {...stroke} />
					</>
				) : null}
				{name === "settings" ? (
					<>
						<circle
							cx="12"
							cy="12"
							r="8"
							{...stroke}
							stroke-width="3"
							stroke-dasharray="3 3.283"
							stroke-linecap="butt"
						/>
						<circle cx="12" cy="12" r="5.5" {...stroke} stroke-width="3" />
					</>
				) : null}
				{name === "theater" ? (
					<rect x="2.5" y="6.5" width="19" height="11" rx="1.5" {...stroke} />
				) : null}
				{name === "fullscreen" ? (
					<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" {...stroke} />
				) : null}
				{name === "exit-fullscreen" ? (
					<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" {...stroke} />
				) : null}
				{name === "next" ? <path d="M9 6l6 6-6 6" {...stroke} /> : null}
				{name === "back" ? <path d="M15 6l-6 6 6 6" {...stroke} /> : null}
			</svg>
		);
	};
}

/** One scrubber segment, as wide as its chapter is long, filled up to the played share. */
function segment(length: number) {
	return raw({
		flexGrow: String(Math.max(0, length)),
		flexBasis: "0",
		borderRadius: "9999px",
		backgroundImage:
			"linear-gradient(to right, var(--ui-video-player-accent) var(--ui-video-player-played, 0%), var(--ui-video-player-line) var(--ui-video-player-played, 0%))",
	});
}

/** Mono, tabular, muted small print for times and meta. */
function monoSmall() {
	return raw({
		fontFamily: "var(--ui-font-mono, ui-monospace, monospace)",
		fontSize: "0.75rem",
		lineHeight: "1.25rem",
		fontVariantNumeric: "tabular-nums",
		color: "var(--ui-video-player-muted)",
		whiteSpace: "nowrap",
	});
}

/** The small uppercase label over the side column's lists. */
function sideLabel() {
	return raw({
		margin: "0",
		fontSize: "0.6875rem",
		lineHeight: "1rem",
		fontWeight: "600",
		letterSpacing: "0.08em",
		textTransform: "uppercase",
		color: "var(--ui-video-player-muted)",
	});
}

/** An unstyled, stacked list. */
function plainList() {
	return raw({ listStyle: "none", margin: "0", padding: "0", display: "grid" });
}

/** The ring every link in the player shows under keyboard focus. */
function focusRing() {
	return focusVisible(
		raw({ outline: "2px solid var(--ui-video-player-accent)", outlineOffset: "2px" }),
	);
}

/** The ring a control on the picture shows under keyboard focus, light on any frame. */
function onVideoFocus() {
	return focusVisible(raw({ outline: `2px solid ${ON_VIDEO}`, outlineOffset: "-2px" }));
}

/**
 * A chapter link: optional still, title and start time on one 44px row, the playing
 * chapter washed and its still ringed in the accent. Hover changes colour only.
 */
function chapterLink() {
	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr) auto",
			alignItems: "center",
			columnGap: "0.75rem",
			minBlockSize: "2.75rem",
			boxSizing: "border-box",
			padding: "0.375rem 0.5rem",
			borderRadius: "0.5rem",
			fontSize: "var(--ui-text-sm, 0.875rem)",
			lineHeight: "1.25rem",
			color: "inherit",
			textDecoration: "none",
		}),
		when(
			"&:has([data-slot='video-player-thumbnail'])",
			raw({ gridTemplateColumns: "auto minmax(0, 1fr) auto", paddingInlineStart: "0.375rem" }),
		),
		when(
			"& > [data-slot='video-player-thumbnail']",
			raw({
				display: "block",
				inlineSize: "3.5rem",
				aspectRatio: "16 / 9",
				overflow: "clip",
				borderRadius: "0.25rem",
				boxShadow: "0 0 0 1px var(--ui-video-player-line)",
			}),
		),
		when(
			"& > [data-slot='video-player-thumbnail'] > *",
			raw({ display: "block", inlineSize: "100%", blockSize: "100%" }),
		),
		hover(raw({ color: "var(--ui-video-player-emphasis)" })),
		when(
			"&[aria-current]",
			raw({
				backgroundColor: "var(--ui-video-player-wash)",
				color: "var(--ui-video-player-emphasis)",
			}),
		),
		when(
			"&[aria-current] > [data-slot='video-player-thumbnail']",
			raw({ boxShadow: "0 0 0 2px var(--ui-video-player-accent)" }),
		),
		focusRing(),
	]);
}

/** A transcript line: its time link in a fixed track, the words beside it, the current lit. */
function cueRow() {
	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: "2.75rem minmax(0, 1fr)",
			columnGap: "0.5rem",
			fontSize: "var(--ui-text-sm, 0.875rem)",
			lineHeight: "1.375rem",
			textWrap: "pretty",
		}),
		when("&[aria-current]", raw({ color: "var(--ui-video-player-emphasis)" })),
		when("&[aria-current] > a", raw({ color: "var(--ui-video-player-accent)" })),
	]);
}

/** A transcript time: muted tabular figures that brighten on hover. */
function timeLink() {
	return combine([
		monoSmall(),
		raw({ textDecoration: "none", borderRadius: "0.25rem", lineHeight: "1.375rem" }),
		hover(raw({ color: "var(--ui-video-player-emphasis)" })),
		focusRing(),
	]);
}

/** A 40px square icon button on the picture; a `hidden` one stays hidden. */
function barButton() {
	return combine([barButtonShape(), when("&:not([hidden])", raw({ display: "inline-grid" }))]);
}

/** The look of a bar button, leaving when it shows to the caller. */
function barButtonShape() {
	return combine([
		raw({
			position: "relative",
			placeItems: "center",
			inlineSize: "2.5rem",
			blockSize: "2.5rem",
			padding: "0",
			border: "0",
			borderRadius: "0.5rem",
			backgroundColor: "transparent",
			color: "inherit",
			cursor: "pointer",
		}),
		when("& > svg", raw({ gridArea: "1 / 1" })),
		hover(raw({ backgroundColor: ON_VIDEO_WASH })),
		onVideoFocus(),
	]);
}

/** The quality mark pinned to the gear's corner. */
function gearBadge() {
	return combine([
		raw({
			position: "absolute",
			insetBlockStart: "0.25rem",
			insetInlineEnd: "0",
			padding: "0 0.1875rem",
			borderRadius: "0.1875rem",
			backgroundColor: ON_VIDEO_ACCENT,
			color: "white",
			fontSize: "0.5625rem",
			lineHeight: "0.875rem",
			fontWeight: "700",
			letterSpacing: "0.02em",
		}),
		when("&[hidden]", hidden()),
	]);
}

/**
 * The menu's dark surface over the picture, scrolling when the screen is short. Where it
 * fits beside the gear on neither side, it centres on the gear across the viewport.
 */
function menuSurface() {
	return raw({
		positionTryFallbacks: "flip-block, top span-all, bottom span-all",
		colorScheme: "dark",
		color: ON_VIDEO,
		backgroundColor: MENU_BG,
		border: "0",
		borderRadius: "0.75rem",
		padding: "0.5rem 0",
		boxSizing: "border-box",
		inlineSize: "min(17rem, calc(100vw - 1rem))",
		maxBlockSize: "min(22rem, calc(100dvh - 5rem))",
		overflowY: "auto",
		fontSize: "var(--ui-text-sm, 0.875rem)",
		lineHeight: "1.25rem",
	});
}

/** A 44px menu row; rows of the top level step aside while a submenu shows. */
function menuRow() {
	return combine([
		raw({
			display: "flex",
			alignItems: "center",
			gap: "0.75rem",
			boxSizing: "border-box",
			inlineSize: "100%",
			minBlockSize: "2.75rem",
			margin: "0",
			padding: "0 1rem",
			border: "0",
			backgroundColor: "transparent",
			color: "inherit",
			font: "inherit",
			textAlign: "start",
			cursor: "pointer",
		}),
		hover(raw({ backgroundColor: ON_VIDEO_WASH })),
		when("&:has(:focus-visible), &:focus-visible", raw({ backgroundColor: ON_VIDEO_WASH })),
		focusVisible(raw({ outline: "none" })),
		when("[data-submenu] &[data-slot='video-player-row']", raw({ display: "none" })),
	]);
}

/** A checkbox drawn as a switch, its knob sliding to the end when on. */
function switchControl() {
	return combine([
		raw({
			appearance: "none",
			position: "relative",
			flexShrink: "0",
			inlineSize: "2.25rem",
			blockSize: "1.25rem",
			margin: "0",
			borderRadius: "9999px",
			backgroundColor: "rgb(255 255 255 / 0.3)",
			cursor: "pointer",
		}),
		motionSafe(raw({ transition: "background-color 150ms" })),
		when(
			"&::before",
			raw({
				content: "''",
				position: "absolute",
				insetBlockStart: "0.125rem",
				insetInlineStart: "0.125rem",
				inlineSize: "1rem",
				blockSize: "1rem",
				borderRadius: "9999px",
				backgroundColor: "white",
			}),
		),
		when("&::before", motionSafe(raw({ transition: "translate 150ms" }))),
		when("&:checked", raw({ backgroundColor: ON_VIDEO_ACCENT })),
		when("&:checked::before", raw({ translate: "1rem 0" })),
		when("&:checked:dir(rtl)::before", raw({ translate: "-1rem 0" })),
		focusVisible(raw({ outline: "none" })),
	]);
}

/** A radio drawn as the check mark beside the chosen option, and as blank space otherwise. */
function checkMark() {
	return combine([
		raw({
			appearance: "none",
			display: "grid",
			placeContent: "center",
			flexShrink: "0",
			inlineSize: "1.25rem",
			blockSize: "1.25rem",
			margin: "0",
			cursor: "pointer",
		}),
		when(
			"&:checked::before",
			raw({
				content: "''",
				inlineSize: "0.375rem",
				blockSize: "0.75rem",
				marginBlockStart: "-0.125rem",
				border: "solid currentColor",
				borderWidth: "0 2px 2px 0",
				rotate: "45deg",
			}),
		),
		focusVisible(raw({ outline: "none" })),
	]);
}

/** The small mark after an option's label, such as `4K`. */
function optionBadge() {
	return raw({
		marginInlineStart: "-0.375rem",
		fontSize: "0.625rem",
		lineHeight: "1rem",
		fontWeight: "700",
		color: ON_VIDEO_ACCENT,
		verticalAlign: "super",
	});
}

/**
 * The island inside every {@link VideoPlayer}: a hidden marker that seeks from time links,
 * marks what plays, and swaps the native controls for a {@link VideoPlayer.Controls} bar.
 * It loads from `@sdxc/ui/video/video-player`, which the browser entry maps to an import.
 */
export const VideoPlayerSync: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/video/video-player#VideoPlayerSync",
	function VideoPlayerSync() {
		return () => <span mix={[hidden(), videoPlayerSync()]} />;
	},
);
