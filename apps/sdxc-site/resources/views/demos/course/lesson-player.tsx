/**
 * The lesson player as students see it, set as the hero: `@sdxc/ui/video`'s player in its
 * dark theater tone, with the course's own controls and settings, a camera choice, chapter
 * stills, the transcript and the card for the lesson that follows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { combine, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { VideoPlayer } from "@sdxc/ui/video";

import { OverheadFrame, WheelFrame } from "~/resources/views/demos/course/clay";
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
 * A transparent WebM exactly as long as the lesson, served by the site, so the native
 * player, the custom bar, the chapters and the captions all run over the drawn frame.
 */
export const LESSON_CLIP = "/demos/video/lesson.webm";

/**
 * The same length in H.264 for browsers without WebM. An MP4 carries no alpha, so it sits on
 * a solid ground the colour of the wheel frame's backdrop.
 */
export const LESSON_CLIP_MP4 = "/demos/video/lesson.mp4";

/**
 * A one-pixel transparent GIF as the poster, so Chrome paints nothing over the drawn frame
 * before playback instead of its grey placeholder.
 */
const CLEAR_POSTER =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** The settings radio group that picks the camera, which the frames read through `:has()`. */
const CAMERA = "course-camera";

/** The previewed lesson's chapters, each with its own still. */
const CHAPTER_STILLS: VideoPlayer.Chapter[] = CHAPTERS.map((chapter, index) => ({
	start: chapter.start,
	title: chapter.title,
	thumbnail: <WheelFrame clay={chapter.clay} id={`course-still-${index}`} />,
}));

/**
 * Renders the player: screen with its bar and settings, chapter bar and title in the wide
 * column; chapters, transcript and the next lesson beside them. Choosing the overhead
 * camera in the settings swaps the side frame for the overhead one through CSS alone.
 *
 * @returns The render function producing the player.
 */
export function LessonPlayer() {
	return () => {
		let module = MODULES[PREVIEW.module - 1]!;
		return (
			<VideoPlayer
				data-course="player"
				duration={PREVIEW.seconds}
				chapters={CHAPTER_STILLS}
				transcript={TRANSCRIPT}
				current={NOW}
				tone="theater"
				mix={[
					combine([
						raw({
							"--ui-video-player-transcript-height": "8.5rem",
							boxShadow:
								"0 0 0 1px oklch(0.6 0.03 262 / 0.3), 0 40px 80px -30px oklch(0.25 0.08 262 / 0.55)",
						}),
						when(
							`&:has(input[name="${CAMERA}"][value="overhead"]:checked) [data-camera="side"]`,
							raw({ visibility: "hidden" }),
						),
						when(
							`&:not(:has(input[name="${CAMERA}"][value="overhead"]:checked)) [data-camera="overhead"]`,
							raw({ visibility: "hidden" }),
						),
						when(
							"& [data-camera]",
							raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" }),
						),
					]),
				]}
			>
				<VideoPlayer.Screen
					label={`Lesson ${PREVIEW.number}: ${PREVIEW.title}, free preview`}
					poster={CLEAR_POSTER}
					captionsLabel="English"
					chaptersLabel="Chapters"
				>
					<VideoPlayer.Frame>
						<div data-camera="side">
							<WheelFrame clay="still" id="course-screen" />
						</div>
						<div data-camera="overhead">
							<OverheadFrame id="course-overhead" />
						</div>
					</VideoPlayer.Frame>
					<VideoPlayer.Source src={LESSON_CLIP} type="video/webm" label="1080p" badge="HD" />
					<VideoPlayer.Source src={LESSON_CLIP_MP4} type="video/mp4" />
					<VideoPlayer.Controls label="Lesson controls">
						<VideoPlayer.Progress label="Seek" />
						<VideoPlayer.Play label="Play" pauseLabel="Pause" />
						<VideoPlayer.Time />
						<VideoPlayer.CaptionsToggle label="Captions" />
						<VideoPlayer.Settings label="Settings">
							<VideoPlayer.SettingsMenu name={CAMERA} label="Camera" backLabel="Back">
								<VideoPlayer.SettingsOption value="side" checked>
									Side
								</VideoPlayer.SettingsOption>
								<VideoPlayer.SettingsOption value="overhead">Overhead</VideoPlayer.SettingsOption>
							</VideoPlayer.SettingsMenu>
							<VideoPlayer.CaptionsMenu label="Captions" offLabel="Off" backLabel="Back" />
							<VideoPlayer.SpeedMenu
								label="Playback speed"
								normalLabel="Normal"
								backLabel="Back"
								rates={[0.5, 0.75, 1, 1.25, 1.5]}
							/>
						</VideoPlayer.Settings>
						<VideoPlayer.Fullscreen label="Full screen" />
					</VideoPlayer.Controls>
				</VideoPlayer.Screen>
				<VideoPlayer.Scrubber />
				<VideoPlayer.Caption
					meta={`Module ${PREVIEW.module} · ${module.title} · ${formatLength(PREVIEW.seconds)}`}
				>
					{String(PREVIEW.number).padStart(2, "0")} · {PREVIEW.title}
				</VideoPlayer.Caption>
				<NextLesson />
				<VideoPlayer.Side>
					<VideoPlayer.Chapters label="Chapters" />
					<VideoPlayer.Transcript label="Transcript" />
				</VideoPlayer.Side>
			</VideoPlayer>
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
					backgroundColor: "oklch(1 0 0 / 0.07)",
					boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.12)",
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
				<span
					mix={[
						raw({
							fontSize: "0.6875rem",
							lineHeight: "1rem",
							fontWeight: "650",
							letterSpacing: "0.08em",
							textTransform: "uppercase",
							color: "oklch(0.7 0.012 262)",
						}),
					]}
				>
					Up next · {formatLength(NEXT.seconds)}
				</span>
				<span
					mix={[
						raw({
							color: "oklch(0.97 0.004 262)",
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
