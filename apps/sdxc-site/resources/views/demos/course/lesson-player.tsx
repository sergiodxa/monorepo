/**
 * The lesson player as students see it, set as the hero: a dark screening stage holding a
 * native `<video>` with chapters and captions tracks, the chapter stills, the transcript up
 * to the moment playing, and the card for the lesson that follows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { combine, raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import { WheelFrame } from "~/resources/views/demos/course/clay";
import { LESSON_CLIP, LESSON_CLIP_TYPE } from "~/resources/views/demos/course/clip";
import {
	CHAPTERS,
	formatLength,
	MODULES,
	NEXT,
	NOW,
	PREVIEW,
	TRANSCRIPT,
} from "~/resources/views/demos/course/data";

/**
 * A one-pixel transparent GIF as the poster, so Chrome paints nothing over the drawn frame
 * before playback instead of its grey placeholder.
 */
const CLEAR_POSTER =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Container the stage's two columns query. */
const STAGE = "course-player";

/**
 * The stage's own night and light ink, fixed in both schemes, so the player reads as a
 * screening room set into the bright page.
 */
const INK = {
	"--player-bg": "oklch(0.17 0.012 262)",
	"--player-emphasis": "oklch(0.97 0.004 262)",
	"--player-body": "oklch(0.82 0.01 262)",
	"--player-muted": "oklch(0.7 0.012 262)",
	"--player-accent": "oklch(0.78 0.11 262)",
	"--player-line": "oklch(1 0 0 / 0.12)",
	"--player-wash": "oklch(1 0 0 / 0.07)",
} as const;

/**
 * Formats seconds as a WebVTT timestamp.
 *
 * @param seconds Seconds from the start.
 * @returns Such as `00:06:58.000`.
 */
function vttTime(seconds: number): string {
	let h = String(Math.floor(seconds / 3600)).padStart(2, "0");
	let m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
	let s = String(Math.floor(seconds % 60)).padStart(2, "0");
	return `${h}:${m}:${s}.000`;
}

/**
 * Writes timed lines as a WebVTT file in a `data:` URL, each line lasting until the next,
 * the last until the lesson ends, so the tracks need no file of their own.
 *
 * @param lines Start times and texts, in order.
 * @returns A `data:text/vtt` URL.
 */
export function lessonTrack(lines: readonly { start: number; text: string }[]): string {
	let cues = lines.map((line, index) => {
		let end = lines[index + 1]?.start ?? PREVIEW.seconds;
		return `${index + 1}\n${vttTime(line.start)} --> ${vttTime(end)}\n${line.text}`;
	});
	return `data:text/vtt;charset=utf-8,${encodeURIComponent(`${["WEBVTT", ...cues].join("\n\n")}\n`)}`;
}

/**
 * Index of the last entry started at {@link NOW}.
 *
 * @param starts Start times in order.
 * @returns The index of the entry playing at the rendered moment.
 */
function playing(starts: readonly number[]): number {
	let found = -1;
	for (let [index, start] of starts.entries()) if (start <= NOW) found = index;
	return found;
}

/**
 * Renders the stage: screen, chapter bar and title in the wide column; chapters, transcript
 * and the next lesson beside them from the `lg` container, under them below it.
 *
 * @returns The render function producing the player.
 */
export function LessonPlayer() {
	return () => {
		let chapter = playing(CHAPTERS.map((entry) => entry.start));
		let line = playing(TRANSCRIPT.map((entry) => entry.start));
		let module = MODULES[PREVIEW.module - 1]!;

		return (
			<figure
				data-slot="course-player"
				mix={[
					container(STAGE),
					raw({
						...INK,
						margin: "0",
						padding: "clamp(0.625rem, 2.5cqi, 1.5rem)",
						boxSizing: "border-box",
						inlineSize: "100%",
						colorScheme: "dark",
						color: "var(--player-body)",
						backgroundColor: "var(--player-bg)",
						borderRadius: "var(--ui-landing-radius-frame)",
						boxShadow:
							"0 0 0 1px oklch(0.6 0.03 262 / 0.3), 0 40px 80px -30px oklch(0.25 0.08 262 / 0.55)",
						textAlign: "start",
					}),
				]}
			>
				<div
					mix={[
						combine([
							raw({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "1.25rem" }),
							at("lg", STAGE, raw({ gridTemplateColumns: "minmax(0, 1.85fr) minmax(17rem, 1fr)" })),
						]),
					]}
				>
					<div
						mix={[
							raw({ display: "grid", gap: "0.875rem", alignContent: "start", minInlineSize: "0" }),
						]}
					>
						<div
							data-slot="course-screen"
							mix={[
								raw({
									position: "relative",
									aspectRatio: "16 / 9",
									overflow: "clip",
									borderRadius: "calc(var(--ui-landing-radius-frame) - 0.375rem)",
									backgroundColor: "black",
								}),
								when(
									"& > *",
									raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" }),
								),
							]}
						>
							<WheelFrame clay="still" id="course-screen" />
							<video
								controls
								preload="none"
								poster={CLEAR_POSTER}
								playsInline
								aria-label={`Lesson ${PREVIEW.number}: ${PREVIEW.title}, free preview`}
								mix={[raw({ objectFit: "cover", backgroundColor: "transparent" })]}
							>
								<source src={LESSON_CLIP} type={LESSON_CLIP_TYPE} />
								<track
									kind="chapters"
									srcLang="en"
									label="Chapters"
									src={lessonTrack(
										CHAPTERS.map((entry) => ({ start: entry.start, text: entry.title })),
									)}
								/>
								<track
									kind="captions"
									srcLang="en"
									label="English"
									default
									src={lessonTrack(TRANSCRIPT)}
								/>
							</video>
						</div>
						<div
							data-slot="course-chapter-bar"
							aria-hidden="true"
							mix={[raw({ display: "flex", gap: "3px", blockSize: "0.375rem" })]}
						>
							{CHAPTERS.map((entry, index) => {
								let end = CHAPTERS[index + 1]?.start ?? PREVIEW.seconds;
								let share =
									Math.min(1, Math.max(0, (NOW - entry.start) / (end - entry.start))) * 100;
								return (
									<span
										key={entry.start}
										mix={[
											raw({
												flexGrow: String(end - entry.start),
												flexBasis: "0",
												borderRadius: "9999px",
												backgroundImage: `linear-gradient(to right, var(--player-accent) ${share}%, var(--player-line) ${share}%)`,
											}),
										]}
									/>
								);
							})}
						</div>
						<figcaption
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "baseline",
									justifyContent: "space-between",
									gap: "0.25rem 1rem",
								}),
							]}
						>
							<span
								mix={[
									raw({
										color: "var(--player-emphasis)",
										fontSize: "1.125rem",
										lineHeight: "1.5rem",
										fontWeight: "650",
										textWrap: "balance",
									}),
								]}
							>
								{String(PREVIEW.number).padStart(2, "0")} · {PREVIEW.title}
							</span>
							<span mix={[mono()]}>
								Module {PREVIEW.module} · {module.title} · {formatLength(PREVIEW.seconds)}
							</span>
						</figcaption>
						<NextLesson />
					</div>
					<div
						mix={[
							raw({ display: "grid", gap: "1.25rem", alignContent: "start", minInlineSize: "0" }),
						]}
					>
						<section aria-label="Chapters" mix={[raw({ display: "grid", gap: "0.5rem" })]}>
							<p aria-hidden="true" mix={[label()]}>
								Chapters
							</p>
							<ol data-slot="course-chapters" mix={[list(), raw({ gap: "0.125rem" })]}>
								{CHAPTERS.map((entry, index) => (
									<li
										key={entry.start}
										aria-current={index === chapter ? "time" : undefined}
										mix={[chapterRow()]}
									>
										<span data-slot="course-still">
											<WheelFrame clay={entry.clay} id={`course-still-${index}`} />
										</span>
										<span mix={[raw({ minInlineSize: "0", textWrap: "pretty" })]}>
											{entry.title}
										</span>
										<time mix={[mono()]}>{formatLength(entry.start)}</time>
									</li>
								))}
							</ol>
						</section>
						<section aria-label="Transcript" mix={[raw({ display: "grid", gap: "0.5rem" })]}>
							<p aria-hidden="true" mix={[label()]}>
								Transcript
							</p>
							<ol data-slot="course-transcript" mix={[list(), raw({ gap: "0.5rem" })]}>
								{TRANSCRIPT.slice(Math.max(0, line - 1), line + 2).map((entry) => (
									<li
										key={entry.start}
										aria-current={entry.start === TRANSCRIPT[line]?.start ? "time" : undefined}
										mix={[cueRow()]}
									>
										<time mix={[mono()]}>{formatLength(entry.start)}</time>
										<span>{entry.text}</span>
									</li>
								))}
							</ol>
						</section>
					</div>
				</div>
			</figure>
		);
	};
}

/**
 * The card the player shows once a lesson ends: the next lesson's still, number, title and
 * length, under the line that says it plays next.
 *
 * @returns The render function producing the card.
 */
function NextLesson() {
	return () => (
		<div
			data-slot="course-next"
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "5.5rem minmax(0, 1fr)",
					alignItems: "center",
					gap: "0.875rem",
					padding: "0.625rem",
					borderRadius: "0.75rem",
					backgroundColor: "var(--player-wash)",
					boxShadow: "inset 0 0 0 1px var(--player-line)",
				}),
			]}
		>
			<span
				mix={[
					raw({
						display: "block",
						aspectRatio: "16 / 9",
						overflow: "clip",
						borderRadius: "0.375rem",
					}),
				]}
			>
				<WheelFrame clay="wobble" id="course-next" />
			</span>
			<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
				<span mix={[label()]}>Up next · {formatLength(NEXT.seconds)}</span>
				<span
					mix={[
						raw({
							color: "var(--player-emphasis)",
							fontWeight: "600",
							lineHeight: "1.375rem",
							textWrap: "balance",
						}),
					]}
				>
					{String(NEXT.number).padStart(2, "0")} · {NEXT.title}
				</span>
			</span>
		</div>
	);
}

/** Mono, tabular, muted small print for times. */
function mono() {
	return raw({
		fontFamily: "var(--ui-font-mono)",
		fontSize: "0.75rem",
		lineHeight: "1.25rem",
		fontVariantNumeric: "tabular-nums",
		color: "var(--player-muted)",
		whiteSpace: "nowrap",
	});
}

/** The small uppercase label over each list in the side column. */
function label() {
	return raw({
		margin: "0",
		fontSize: "0.6875rem",
		lineHeight: "1rem",
		fontWeight: "650",
		letterSpacing: "0.08em",
		textTransform: "uppercase",
		color: "var(--player-muted)",
	});
}

/** An unstyled, stacked list. */
function list() {
	return raw({ listStyle: "none", margin: "0", padding: "0", display: "grid" });
}

/** A chapter row: its still, title and start, the chapter playing washed and its still ringed. */
function chapterRow() {
	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: "3.5rem minmax(0, 1fr) auto",
			alignItems: "center",
			columnGap: "0.75rem",
			padding: "0.3125rem",
			borderRadius: "0.5rem",
			fontSize: "0.875rem",
			lineHeight: "1.25rem",
		}),
		when(
			"& > [data-slot='course-still']",
			raw({
				display: "block",
				aspectRatio: "16 / 9",
				overflow: "clip",
				borderRadius: "0.25rem",
				boxShadow: "0 0 0 1px var(--player-line)",
			}),
		),
		when(
			"&[aria-current]",
			raw({ backgroundColor: "var(--player-wash)", color: "var(--player-emphasis)" }),
		),
		when(
			"&[aria-current] > [data-slot='course-still']",
			raw({ boxShadow: "0 0 0 2px var(--player-accent)" }),
		),
	]);
}

/** A transcript line: its time in a fixed track, the words beside it, the current line lit. */
function cueRow() {
	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: "2.75rem minmax(0, 1fr)",
			columnGap: "0.5rem",
			fontSize: "0.875rem",
			lineHeight: "1.375rem",
			textWrap: "pretty",
			opacity: "0.72",
		}),
		when("&[aria-current]", raw({ color: "var(--player-emphasis)", opacity: "1" })),
		when("&[aria-current] > time", raw({ color: "var(--player-accent)" })),
	]);
}
