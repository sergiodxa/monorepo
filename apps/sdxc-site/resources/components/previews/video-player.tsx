/**
 * Live preview for `VideoPlayer`: one lesson with chapters, a transcript and the full control
 * bar, its settings menu holding a page toggle and a sleep timer beside captions, speed and
 * two qualities. The file is a transparent clip of the lesson's length over a drawn frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { VideoPlayer } from "@sdxc/ui/video";

/** The source the page shows, matching the markup below apart from the drawn frame. */
const CODE = `<VideoPlayer duration={703} chapters={chapters} transcript={transcript}>
	<VideoPlayer.Screen label="Centering 3 kg" captionsLabel="English" chaptersLabel="Chapters">
		<VideoPlayer.Source src="/lesson-2160.webm" type="video/webm" label="2160p" badge="4K" />
		<VideoPlayer.Source src="/lesson-1080.webm" type="video/webm" label="1080p" badge="HD" />
		<VideoPlayer.Controls label="Video controls">
			<VideoPlayer.Progress label="Seek" />
			<VideoPlayer.Play label="Play" pauseLabel="Pause" />
			<VideoPlayer.Time />
			<VideoPlayer.CaptionsToggle label="Subtitles/closed captions" />
			<VideoPlayer.Settings label="Settings">
				<VideoPlayer.SettingsToggle name="ambient" label="Ambient mode" checked />
				<VideoPlayer.CaptionsMenu label="Subtitles/CC" offLabel="Off" backLabel="Back" />
				<VideoPlayer.SettingsMenu name="sleep" label="Sleep timer" backLabel="Back">
					<VideoPlayer.SettingsOption value="off" checked>Off</VideoPlayer.SettingsOption>
					<VideoPlayer.SettingsOption value="15">15 minutes</VideoPlayer.SettingsOption>
					<VideoPlayer.SettingsOption value="end">End of video</VideoPlayer.SettingsOption>
				</VideoPlayer.SettingsMenu>
				<VideoPlayer.SpeedMenu label="Playback speed" normalLabel="Normal" backLabel="Back" />
				<VideoPlayer.QualityMenu label="Quality" backLabel="Back" />
			</VideoPlayer.Settings>
			<VideoPlayer.Theater label="Theater mode" />
			<VideoPlayer.Fullscreen label="Full screen" />
		</VideoPlayer.Controls>
	</VideoPlayer.Screen>
	<VideoPlayer.Scrubber />
	<VideoPlayer.Caption meta="Lesson 7 · 11:43">Centering 3 kg</VideoPlayer.Caption>
	<VideoPlayer.Side>
		<VideoPlayer.Chapters label="Chapters" />
		<VideoPlayer.Transcript label="Transcript" />
	</VideoPlayer.Side>
</VideoPlayer>`;

/** A transparent clip as long as the lesson, so every control works over the drawn frame. */
const CLIP = "/demos/video/lesson.webm";

/** The lesson's chapters. */
const CHAPTERS: VideoPlayer.Chapter[] = [
	{ start: 0, title: "Why 3 kg is different" },
	{ start: 72, title: "Coning up and down" },
	{ start: 245, title: "Bracing against the wheel" },
	{ start: 418, title: "Checking with a still finger" },
];

/** What the instructor says, line by line. */
const TRANSCRIPT: VideoPlayer.Cue[] = [
	{ start: 0, text: "Today it's three kilos, which changes how you sit." },
	{ start: 72, text: "Squeeze from the base and let the clay rise into a cone." },
	{ start: 160, text: "Now press it back down with the heel of your hand." },
	{ start: 245, text: "Lock your elbow against your thigh; the wheel does the work." },
	{ start: 418, text: "Rest one finger on the side. If it doesn't move, you're centred." },
];

/** A wheel and a lump of clay drawn under the clip, standing in for the picture. */
function LessonFrame() {
	return () => (
		<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
			<defs>
				<radialGradient id="video-player-preview-light" cx="0.5" cy="0.35" r="0.8">
					<stop offset="0" stop-color="oklch(0.42 0.05 55)" />
					<stop offset="1" stop-color="oklch(0.18 0.02 55)" />
				</radialGradient>
			</defs>
			<rect width="160" height="90" fill="url(#video-player-preview-light)" />
			<ellipse cx="80" cy="70" rx="46" ry="9" fill="oklch(0.3 0.02 55)" />
			<path d="M58 66c2-18 10-28 22-28s20 10 22 28z" fill="oklch(0.62 0.07 50)" />
		</svg>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<VideoPlayer duration={703} chapters={CHAPTERS} transcript={TRANSCRIPT} tone="theater">
				<VideoPlayer.Screen label="Centering 3 kg" captionsLabel="English" chaptersLabel="Chapters">
					<VideoPlayer.Frame>
						<LessonFrame />
					</VideoPlayer.Frame>
					<VideoPlayer.Source src={`${CLIP}?q=2160`} type="video/webm" label="2160p" badge="4K" />
					<VideoPlayer.Source src={`${CLIP}?q=1080`} type="video/webm" label="1080p" badge="HD" />
					<VideoPlayer.Controls label="Video controls">
						<VideoPlayer.Progress label="Seek" />
						<VideoPlayer.Play label="Play" pauseLabel="Pause" />
						<VideoPlayer.Time />
						<VideoPlayer.CaptionsToggle label="Subtitles/closed captions" />
						<VideoPlayer.Settings label="Settings">
							<VideoPlayer.SettingsToggle name="ambient" label="Ambient mode" checked />
							<VideoPlayer.CaptionsMenu label="Subtitles/CC" offLabel="Off" backLabel="Back" />
							<VideoPlayer.SettingsMenu name="sleep" label="Sleep timer" backLabel="Back">
								<VideoPlayer.SettingsOption value="off" checked>
									Off
								</VideoPlayer.SettingsOption>
								<VideoPlayer.SettingsOption value="15">15 minutes</VideoPlayer.SettingsOption>
								<VideoPlayer.SettingsOption value="end">End of video</VideoPlayer.SettingsOption>
							</VideoPlayer.SettingsMenu>
							<VideoPlayer.SpeedMenu label="Playback speed" normalLabel="Normal" backLabel="Back" />
							<VideoPlayer.QualityMenu label="Quality" backLabel="Back" />
						</VideoPlayer.Settings>
						<VideoPlayer.Theater label="Theater mode" />
						<VideoPlayer.Fullscreen label="Full screen" />
					</VideoPlayer.Controls>
				</VideoPlayer.Screen>
				<VideoPlayer.Scrubber />
				<VideoPlayer.Caption meta="Lesson 7 · 11:43">Centering 3 kg</VideoPlayer.Caption>
				<VideoPlayer.Side>
					<VideoPlayer.Chapters label="Chapters" />
					<VideoPlayer.Transcript label="Transcript" />
				</VideoPlayer.Side>
			</VideoPlayer>
		</div>
	),
};
