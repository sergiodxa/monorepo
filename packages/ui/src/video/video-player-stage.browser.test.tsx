/**
 * Plays `VideoPlayer` on a stage in a real browser: the screen fills the box it is given with
 * the overlay and bar over it, Skip and the arrow keys step ten seconds, Mute turns the sound
 * off and says so, and a resting pointer on a playing stage fades the bar and overlay.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { VideoPlayer } from "./video-player.js";

import "../reset.css";
import "../theme.css";

/** Mounts a stage 900 by 500 pixels and returns its `<figure>`. */
function mount(): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "900px";
	host.style.height = "500px";
	document.body.appendChild(host);
	render(
		<VideoPlayer duration={3000} layout="stage" tone="theater">
			<VideoPlayer.Screen label="Lee Shore" captionsLabel="English" chaptersLabel="Chapters">
				<VideoPlayer.Source src="/episodes/203.mp4" type="video/mp4" />
				<VideoPlayer.Overlay>
					<a href="/title/tidewater">Back to Tidewater</a>
				</VideoPlayer.Overlay>
				<VideoPlayer.Controls label="Player controls">
					<VideoPlayer.Progress label="Seek" />
					<VideoPlayer.Play label="Play" pauseLabel="Pause" />
					<VideoPlayer.Skip seconds={-10} label="Back 10 seconds" />
					<VideoPlayer.Skip seconds={10} label="Forward 10 seconds" />
					<VideoPlayer.Mute label="Mute" unmuteLabel="Unmute" />
					<VideoPlayer.Heading>Tidewater · E3 Lee Shore</VideoPlayer.Heading>
					<VideoPlayer.Time />
					<VideoPlayer.Fullscreen label="Full screen" />
				</VideoPlayer.Controls>
			</VideoPlayer.Screen>
		</VideoPlayer>,
		{ container: host },
	);
	return host.querySelector<HTMLElement>("[data-slot=video-player]")!;
}

/** The element `selector` names inside `root`. */
function get<T extends Element = HTMLElement>(root: Element, selector: string): T {
	let element = root.querySelector<T>(selector);
	if (element === null) throw new Error(`Nothing matches ${selector}`);
	return element;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("VideoPlayer on a stage", () => {
	test("fills its box with the screen, the overlay at the top and the bar at the foot", async () => {
		let root = mount();
		let bar = get(root, "[data-slot=video-player-controls]");
		await vi.waitFor(() => expect(bar.hidden).toBe(false));
		let screen = get(root, "[data-slot=video-player-screen]").getBoundingClientRect();
		expect(screen.width).toBeCloseTo(900, 0);
		expect(screen.height).toBeCloseTo(500, 0);
		expect(get(root, "[data-slot=video-player-overlay]").getBoundingClientRect().top).toBeCloseTo(
			screen.top,
			0,
		);
		expect(bar.getBoundingClientRect().bottom).toBeCloseTo(screen.bottom, 0);
		let heading = get(root, "[data-slot=video-player-heading]").getBoundingClientRect();
		expect(heading.left + heading.width / 2).toBeGreaterThan(screen.left + screen.width * 0.35);
	});

	test("skips ten seconds each way by button and by arrow key", async () => {
		let root = mount();
		let video = get<HTMLVideoElement>(root, "video");
		await vi.waitFor(() => expect(video.controls).toBe(false));
		video.currentTime = 100;
		get(root, "[aria-label='Forward 10 seconds']").click();
		expect(video.currentTime).toBe(110);
		get(root, "[aria-label='Back 10 seconds']").click();
		expect(video.currentTime).toBe(100);
		document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
		expect(video.currentTime).toBe(90);
	});

	test("mutes and unmutes, naming what a press does next", async () => {
		let root = mount();
		let video = get<HTMLVideoElement>(root, "video");
		let mute = get(root, "[data-video-action=mute]");
		await vi.waitFor(() => expect(video.controls).toBe(false));
		mute.click();
		await vi.waitFor(() => expect(mute.getAttribute("aria-pressed")).toBe("true"));
		expect(video.muted).toBe(true);
		expect(mute.getAttribute("aria-label")).toBe("Unmute");
		document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "m", bubbles: true }));
		await vi.waitFor(() => expect(mute.getAttribute("aria-pressed")).toBe("false"));
	});

	test("fades the bar and overlay while playing and idle, and keeps them while paused", async () => {
		let root = mount();
		let bar = get(root, "[data-slot=video-player-controls]");
		let overlay = get(root, "[data-slot=video-player-overlay]");
		await vi.waitFor(() => expect(bar.hidden).toBe(false));
		root.setAttribute("data-idle", "");
		expect(getComputedStyle(bar).pointerEvents).not.toBe("none");
		root.setAttribute("data-playing", "");
		await vi.waitFor(() => expect(getComputedStyle(bar).opacity).toBe("0"));
		expect(getComputedStyle(overlay).pointerEvents).toBe("none");
	});

	test("keeps a centred group centred between the groups at either end", async () => {
		let host = document.createElement("div");
		host.style.width = "900px";
		host.style.height = "500px";
		document.body.appendChild(host);
		render(
			<VideoPlayer duration={600} layout="stage">
				<VideoPlayer.Screen label="Clip" captionsLabel="English" chaptersLabel="Chapters">
					<VideoPlayer.Source src="/clip.mp4" type="video/mp4" />
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
							<VideoPlayer.Mute label="Mute" unmuteLabel="Unmute" />
							<VideoPlayer.Fullscreen label="Full screen" />
						</VideoPlayer.Group>
					</VideoPlayer.Controls>
				</VideoPlayer.Screen>
			</VideoPlayer>,
			{ container: host },
		);
		let bar = get(host, "[data-slot=video-player-controls]");
		await vi.waitFor(() => expect(bar.hidden).toBe(false));
		let play = get(host, "[data-video-action=play]").getBoundingClientRect();
		let box = bar.getBoundingClientRect();
		expect(play.left + play.width / 2).toBeCloseTo(box.left + box.width / 2, -1);
		expect(play.width).toBeGreaterThan(
			get(host, "[data-video-action=skip]").getBoundingClientRect().width,
		);
	});

	test("gives a centred group its own row on a phone-width stage, so nothing overlaps", async () => {
		let host = document.createElement("div");
		host.style.width = "360px";
		host.style.height = "640px";
		document.body.appendChild(host);
		render(
			<VideoPlayer duration={3000} layout="stage">
				<VideoPlayer.Screen label="Clip" captionsLabel="English" chaptersLabel="Chapters">
					<VideoPlayer.Source src="/clip.mp4" type="video/mp4" />
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
							<VideoPlayer.CaptionsToggle label="Subtitles" />
							<VideoPlayer.Fullscreen label="Full screen" />
						</VideoPlayer.Group>
					</VideoPlayer.Controls>
				</VideoPlayer.Screen>
			</VideoPlayer>,
			{ container: host },
		);
		let bar = get(host, "[data-slot=video-player-controls]");
		await vi.waitFor(() => expect(bar.hidden).toBe(false));
		let time = get(host, "[data-slot=video-player-time]").getBoundingClientRect();
		let skip = get(host, "[data-video-action=skip]").getBoundingClientRect();
		expect(skip.top).toBeGreaterThanOrEqual(time.bottom);
	});

	test("wires itself again when a frame redraw puts back the native controls and new sources", async () => {
		let root = mount();
		let video = get<HTMLVideoElement>(root, "video");
		let bar = get(root, "[data-slot=video-player-controls]");
		await vi.waitFor(() => expect(bar.hidden).toBe(false));
		let load = vi.spyOn(video, "load");
		video.controls = true;
		bar.hidden = true;
		get(root, "source").setAttribute("src", "/episodes/204.mp4");
		await vi.waitFor(() => expect(bar.hidden).toBe(false));
		expect(video.controls).toBe(false);
		expect(load).toHaveBeenCalledTimes(1);
	});

	test("leaves the page's keys alone while a field has focus", async () => {
		let root = mount();
		let video = get<HTMLVideoElement>(root, "video");
		await vi.waitFor(() => expect(video.controls).toBe(false));
		let field = document.createElement("input");
		document.body.appendChild(field);
		video.currentTime = 50;
		field.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
		expect(video.currentTime).toBe(50);
	});
});
