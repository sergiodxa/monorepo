/**
 * Reads {@link VideoPlayer}'s server HTML as a visitor without script gets it: the native
 * controls, the custom bar and its menu hidden, and every time a link into the file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { VideoPlayer } from "./video-player.js";

/** Renders a player with the full control bar and settings menu. */
async function serverHtml(): Promise<string> {
	return await renderToString(
		<VideoPlayer
			duration={703}
			current={80}
			chapters={[
				{ start: 0, title: "Why 3 kg is different" },
				{ start: 72, title: "Coning up" },
			]}
			transcript={[{ start: 0, text: "Today it's three kilos." }]}
		>
			<VideoPlayer.Screen label="Centering 3 kg" captionsLabel="English" chaptersLabel="Chapters">
				<VideoPlayer.Source src="/07-1080.mp4" type="video/mp4" label="1080p" badge="HD" />
				<VideoPlayer.Source src="/07-2160.mp4" type="video/mp4" label="2160p" badge="4K" />
				<VideoPlayer.Controls label="Video controls">
					<VideoPlayer.Progress label="Seek" />
					<VideoPlayer.Play label="Play" pauseLabel="Pause" />
					<VideoPlayer.Time />
					<VideoPlayer.Settings label="Settings">
						<VideoPlayer.SettingsToggle name="ambient" label="Ambient mode" />
						<VideoPlayer.SpeedMenu label="Playback speed" normalLabel="Normal" backLabel="Back" />
						<VideoPlayer.QualityMenu label="Quality" backLabel="Back" />
					</VideoPlayer.Settings>
					<VideoPlayer.Fullscreen label="Full screen" />
				</VideoPlayer.Controls>
			</VideoPlayer.Screen>
			<VideoPlayer.Side>
				<VideoPlayer.Chapters label="Chapters" />
			</VideoPlayer.Side>
		</VideoPlayer>,
	);
}

describe("VideoPlayer without script", () => {
	test("keeps the native controls and hides the custom bar", async () => {
		let html = await serverHtml();
		expect(html).toMatch(/<video[^>]*\scontrols/);
		expect(html).toMatch(/<div[^>]*\shidden[^>]*data-slot="video-player-controls"/);
		expect(html).toMatch(/<div[^>]*popover="auto"[^>]*data-slot="video-player-settings"/);
	});

	test("renders the bar at the page's moment, with the gear wearing the first badge", async () => {
		let html = await serverHtml();
		expect(html).toMatch(/<input[^>]*type="range"[^>]*value="80"/);
		expect(html).toContain('<span data-slot="video-player-elapsed">1:20</span>');
		expect(html).toMatch(/data-slot="video-player-badge"[^>]*>HD</);
	});

	test("checks Normal speed and the first quality, and names them on their rows", async () => {
		let html = await serverHtml();
		expect(html).toMatch(/<input[^>]*value="1"[^>]*checked/);
		expect(html).toMatch(/data-slot="video-player-row-value"[^>]*>Normal</);
		expect(html).toMatch(/data-slot="video-player-row-value"[^>]*>1080p</);
	});

	test("links each chapter into the first source", async () => {
		let html = await serverHtml();
		expect(html).toContain('href="/07-1080.mp4#t=72"');
		expect(html).toContain('<track kind="chapters"');
	});
});
