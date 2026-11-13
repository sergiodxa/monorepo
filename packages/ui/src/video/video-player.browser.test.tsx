/**
 * Plays {@link VideoPlayer} in a real browser: tracks, time links and marks; the control bar
 * that replaces the native controls, each of its buttons, and the settings menu with its
 * built-in and page-defined rows, by pointer and by keyboard, wide and at phone width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { formatVideoTime, webVttUrl } from "./utils/timeline.js";
import { VideoPlayer } from "./video-player.js";

import "../reset.css";
import "../theme.css";

/** The address the mounted player plays first. */
const SRC = "/lessons/07-centering-1080.mp4";

/** The second quality the player offers. */
const SRC_4K = "/lessons/07-centering-2160.mp4";

/** Three chapters over a 703-second video. */
const CHAPTERS: VideoPlayer.Chapter[] = [
	{ start: 0, title: "Why 3 kg is different" },
	{ start: 72, title: "Coning up" },
	{ start: 418, title: "Checking with a still finger" },
];

/** Three spoken lines. */
const TRANSCRIPT: VideoPlayer.Cue[] = [
	{ start: 0, text: "Today it's three kilos." },
	{ start: 80, text: "Squeeze from the base." },
	{ start: 420, text: "Rest one finger on the side." },
];

/** Options for {@link mount}. */
interface MountOptions {
	props?: Partial<VideoPlayer.Props>;
	/** Whether the screen carries the custom control bar. */
	controls?: boolean;
}

/** Mounts a player `width` pixels wide and returns its `<figure>`. */
function mount(width: number, { controls = false, props = {} }: MountOptions = {}): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<VideoPlayer duration={703} chapters={CHAPTERS} transcript={TRANSCRIPT} {...props}>
			<VideoPlayer.Screen label="Centering 3 kg" captionsLabel="English" chaptersLabel="Chapters">
				<VideoPlayer.Source src={SRC} type="video/mp4" label="1080p" badge="HD" />
				<VideoPlayer.Source src={SRC_4K} type="video/mp4" label="2160p" badge="4K" />
				{controls ? (
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
								<VideoPlayer.SettingsOption value="30">30 minutes</VideoPlayer.SettingsOption>
							</VideoPlayer.SettingsMenu>
							<VideoPlayer.SpeedMenu
								label="Playback speed"
								normalLabel="Normal"
								backLabel="Back"
								rates={[0.5, 1, 1.5, 2]}
							/>
							<VideoPlayer.QualityMenu label="Quality" backLabel="Back" />
						</VideoPlayer.Settings>
						<VideoPlayer.Theater label="Theater mode" />
						<VideoPlayer.Fullscreen label="Full screen" />
					</VideoPlayer.Controls>
				) : null}
			</VideoPlayer.Screen>
			<VideoPlayer.Scrubber />
			<VideoPlayer.Caption meta="Lesson 7 · 11:43">Centering 3 kg</VideoPlayer.Caption>
			<VideoPlayer.Side>
				<VideoPlayer.Chapters label="Chapters" />
				<VideoPlayer.Transcript label="Transcript" />
			</VideoPlayer.Side>
		</VideoPlayer>,
		{ container: host },
	);
	return host.querySelector<HTMLElement>('[data-slot="video-player"]')!;
}

/** The chapter links in playing order. */
function chapterLinks(root: HTMLElement): HTMLAnchorElement[] {
	return [...root.querySelectorAll<HTMLAnchorElement>('[data-slot="video-player-chapters"] a')];
}

/** The first element under `root` matching `selector`, failing the test when there is none. */
function get<T extends Element = HTMLElement>(root: Element, selector: string): T {
	let found = root.querySelector<T>(selector);
	expect(found, selector).not.toBeNull();
	return found!;
}

/** The video's captions tracks, in order. */
function captionTracks(video: HTMLVideoElement): TextTrack[] {
	return [...video.textTracks].filter((track) => track.kind === "captions");
}

/** Opens the settings menu with the gear and returns its surface. */
async function openSettings(root: HTMLElement): Promise<HTMLElement> {
	await userEvent.click(get(root, 'button[aria-haspopup="menu"]'));
	let menu = get(root, '[data-slot="video-player-settings"]');
	await vi.waitFor(() => expect(menu.matches(":popover-open")).toBe(true));
	return menu;
}

/** The top-level row that opens the submenu labelled `label`. */
function submenuRow(root: HTMLElement, label: string): HTMLButtonElement {
	let row = [...root.querySelectorAll<HTMLButtonElement>('[data-video-action="open"]')].find(
		(button) => button.textContent?.startsWith(label),
	);
	expect(row, label).toBeDefined();
	return row!;
}

/** Reads a `data:text/vtt` URL back as text. */
function vttText(url: string): string {
	return decodeURIComponent(url.slice(url.indexOf(",") + 1));
}

/** Paints a CSS colour onto a 1px canvas and reads back its sRGB channels, whatever its syntax. */
function channels(color: string): number[] {
	let canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	let context = canvas.getContext("2d")!;
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("VideoPlayer", () => {
	test("writes times as m:ss under an hour and h:mm:ss from one", () => {
		expect(formatVideoTime(0)).toBe("0:00");
		expect(formatVideoTime(418.9)).toBe("6:58");
		expect(formatVideoTime(3725)).toBe("1:02:05");
	});

	test("writes each line until the next starts, and the last until the end", () => {
		let text = vttText(
			webVttUrl(
				CHAPTERS.map((c) => ({ start: c.start, text: c.title })),
				703,
			),
		);
		expect(
			text.startsWith("WEBVTT\n\n1\n00:00:00.000 --> 00:01:12.000\nWhy 3 kg is different"),
		).toBe(true);
		expect(text).toContain("3\n00:06:58.000 --> 00:11:43.000\nChecking with a still finger");
	});

	test("hands chapters and captions to the native player as tracks", () => {
		let root = mount(1024);
		let video = get<HTMLVideoElement>(root, "video");
		expect(video.controls).toBe(true);
		expect(video.getAttribute("aria-label")).toBe("Centering 3 kg");
		let tracks = [...video.querySelectorAll("track")];
		expect(tracks.map((track) => track.kind)).toEqual(["chapters", "captions"]);
		expect(vttText(tracks[1]!.src)).toContain("Rest one finger on the side.");
	});

	test("links every chapter and line to its moment in the first file", () => {
		let root = mount(1024);
		expect(chapterLinks(root).map((link) => link.getAttribute("href"))).toEqual([
			`${SRC}#t=0`,
			`${SRC}#t=72`,
			`${SRC}#t=418`,
		]);
		expect(
			root.querySelectorAll(`[data-slot="video-player-cue"] a[href="${SRC}#t=80"]`),
		).toHaveLength(1);
	});

	test("marks the chapter and line playing at the rendered moment", () => {
		let root = mount(1024, { props: { current: 430 } });
		expect(chapterLinks(root)[2]!.getAttribute("aria-current")).toBe("true");
		let lines = root.querySelectorAll('[data-slot="video-player-cue"][aria-current]');
		expect(lines).toHaveLength(1);
		expect(lines[0]?.textContent).toContain("Rest one finger");
	});

	test("a chapter link seeks the video and becomes the current chapter", () => {
		let root = mount(1024);
		let second = chapterLinks(root)[1]!;
		second.click();
		expect(get<HTMLVideoElement>(root, "video").currentTime).toBe(72);
		expect(second.getAttribute("aria-current")).toBe("true");
		expect(chapterLinks(root).filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
	});

	test("a modified click on a time link still opens the file", () => {
		let root = mount(1024);
		let link = chapterLinks(root)[1]!;
		let click = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true });
		link.dispatchEvent(click);
		expect(click.defaultPrevented).toBe(false);
		expect(link.hasAttribute("aria-current")).toBe(false);
	});

	test("as the video plays, the scrubber fills and the started line is current", () => {
		let root = mount(1024);
		let video = get<HTMLVideoElement>(root, "video");
		video.currentTime = 245;
		video.dispatchEvent(new Event("timeupdate"));
		let segments = [
			...root.querySelectorAll<HTMLElement>('[data-slot="video-player-segment"]'),
		].map((bar) => bar.style.getPropertyValue("--ui-video-player-played"));
		expect(segments).toEqual(["100%", "50%", "0%"]);
		let lines = root.querySelectorAll('[data-slot="video-player-cue"][aria-current]');
		expect(lines[0]?.textContent).toContain("Squeeze from the base.");
	});

	test("sets the side column beside the screen when wide and under it when narrow", () => {
		let wide = mount(1024);
		let screen = get(wide, '[data-slot="video-player-screen"]').getBoundingClientRect();
		let side = get(wide, '[data-slot="video-player-side"]').getBoundingClientRect();
		expect(side.left).toBeGreaterThan(screen.right);
		let narrow = mount(343);
		let narrowScreen = get(narrow, '[data-slot="video-player-screen"]').getBoundingClientRect();
		let narrowSide = get(narrow, '[data-slot="video-player-side"]').getBoundingClientRect();
		expect(narrowSide.top).toBeGreaterThan(narrowScreen.bottom);
		expect(narrow.scrollWidth).toBeLessThanOrEqual(343);
	});

	test("keeps the theater dark with light ink in a light page", () => {
		let root = mount(1024, { props: { tone: "theater" } });
		let style = getComputedStyle(root);
		expect(style.colorScheme).toBe("dark");
		let title = get(root, '[data-slot="video-player-title"]');
		expect(channels(getComputedStyle(title).color).every((channel) => channel > 200)).toBe(true);
		expect(channels(style.backgroundColor).every((channel) => channel < 60)).toBe(true);
	});
});

describe("VideoPlayer.Controls", () => {
	test("the island swaps the native controls for the bar", () => {
		let root = mount(1024, { controls: true });
		let video = get<HTMLVideoElement>(root, "video");
		let bar = get(root, '[data-slot="video-player-controls"]');
		expect(video.controls).toBe(false);
		expect(bar.hidden).toBe(false);
		expect(getComputedStyle(bar).display).toBe("flex");
		let screen = get(root, '[data-slot="video-player-screen"]').getBoundingClientRect();
		expect(bar.getBoundingClientRect().bottom).toBeCloseTo(screen.bottom, 0);
	});

	test("Play plays a paused video, then names itself Pause while it plays", async () => {
		let root = mount(1024, { controls: true });
		let video = get<HTMLVideoElement>(root, "video");
		let paused = true;
		vi.spyOn(video, "paused", "get").mockImplementation(() => paused);
		let play = vi.spyOn(video, "play").mockImplementation(async () => {
			paused = false;
			video.dispatchEvent(new Event("play"));
		});
		let pause = vi.spyOn(video, "pause").mockImplementation(() => {
			paused = true;
			video.dispatchEvent(new Event("pause"));
		});
		let button = get(root, '[data-video-action="play"]');
		expect(button.getAttribute("aria-label")).toBe("Play");
		await userEvent.click(button);
		expect(play).toHaveBeenCalledOnce();
		expect(button.getAttribute("aria-label")).toBe("Pause");
		expect(root.hasAttribute("data-playing")).toBe(true);
		expect(getComputedStyle(get(button, '[data-icon="pause"]')).display).toBe("block");
		expect(getComputedStyle(get(button, '[data-icon="play"]')).display).toBe("none");
		await userEvent.click(button);
		expect(pause).toHaveBeenCalledOnce();
		expect(button.getAttribute("aria-label")).toBe("Play");
	});

	test("Time and Progress follow the video, and the slider seeks", () => {
		let root = mount(1024, { controls: true });
		let video = get<HTMLVideoElement>(root, "video");
		video.currentTime = 72;
		video.dispatchEvent(new Event("timeupdate"));
		expect(get(root, '[data-slot="video-player-time"]').textContent).toBe("1:12 / 11:43");
		let progress = get<HTMLInputElement>(root, '[data-slot="video-player-progress"]');
		expect(Number(progress.value)).toBe(72);
		expect(progress.getAttribute("aria-valuetext")).toBe("1:12 / 11:43");
		progress.value = "418";
		progress.dispatchEvent(new Event("input", { bubbles: true }));
		expect(video.currentTime).toBe(418);
		expect(chapterLinks(root)[2]!.getAttribute("aria-current")).toBe("true");
	});

	test("the captions toggle shows the transcript track and the menu follows", async () => {
		let root = mount(1024, { controls: true });
		let video = get<HTMLVideoElement>(root, "video");
		let toggle = get(root, '[data-video-action="captions"]');
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
		await userEvent.click(toggle);
		expect(captionTracks(video)[0]!.mode).toBe("showing");
		expect(toggle.getAttribute("aria-pressed")).toBe("true");
		expect(submenuRow(root, "Subtitles/CC").textContent).toContain("English");
		await userEvent.click(toggle);
		expect(captionTracks(video)[0]!.mode).toBe("disabled");
		expect(submenuRow(root, "Subtitles/CC").textContent).toContain("Off");
	});

	test("Theater sets data-theater and drops the side column under the screen", async () => {
		let root = mount(1024, { controls: true });
		let button = get(root, '[data-video-action="theater"]');
		await userEvent.click(button);
		expect(root.hasAttribute("data-theater")).toBe(true);
		expect(button.getAttribute("aria-pressed")).toBe("true");
		let screen = get(root, '[data-slot="video-player-screen"]').getBoundingClientRect();
		let side = get(root, '[data-slot="video-player-side"]').getBoundingClientRect();
		expect(side.top).toBeGreaterThan(screen.bottom);
		await userEvent.click(button);
		expect(root.hasAttribute("data-theater")).toBe(false);
	});

	test("Fullscreen asks for the screen with its bar, not the bare video", async () => {
		let root = mount(1024, { controls: true });
		let screen = get(root, '[data-slot="video-player-screen"]');
		let request = vi.spyOn(screen, "requestFullscreen").mockResolvedValue(undefined);
		await userEvent.click(get(root, '[data-video-action="fullscreen"]'));
		expect(request).toHaveBeenCalledOnce();
	});

	test("lays the bar out inside a 375px screen", () => {
		let root = mount(375, { controls: true });
		let bar = get(root, '[data-slot="video-player-controls"]');
		let screen = get(root, '[data-slot="video-player-screen"]').getBoundingClientRect();
		let shown = [...bar.querySelectorAll<HTMLElement>(":scope > button")].filter((button) =>
			button.checkVisibility(),
		);
		expect(shown.map((button) => button.dataset.videoAction ?? "settings")).toEqual([
			"play",
			"captions",
			"settings",
			"fullscreen",
		]);
		for (let button of shown) {
			let box = button.getBoundingClientRect();
			expect(box.right).toBeLessThanOrEqual(screen.right + 0.5);
			expect(box.width).toBeGreaterThanOrEqual(40);
			expect(box.top).toBe(shown[0]!.getBoundingClientRect().top);
		}
		expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
	});
});

describe("VideoPlayer.Settings", () => {
	test("the gear wears the playing source's badge and opens the menu on its first row", async () => {
		let root = mount(1024, { controls: true });
		expect(get(root, '[data-slot="video-player-badge"]').textContent).toBe("HD");
		let menu = await openSettings(root);
		expect(get(menu, '[role="menu"]').getAttribute("aria-label")).toBe("Settings");
		expect(document.activeElement).toBe(get(menu, 'input[name="ambient"]'));
	});

	test("arrow keys walk the rows, → opens a submenu on its choice, ← returns", async () => {
		let root = mount(1024, { controls: true });
		let menu = await openSettings(root);
		await userEvent.keyboard("{ArrowDown}{ArrowDown}");
		let sleep = submenuRow(root, "Sleep timer");
		expect(document.activeElement).toBe(sleep);
		await userEvent.keyboard("{ArrowRight}");
		let panel = get(menu, `#${sleep.getAttribute("aria-controls")}`);
		expect(panel.hidden).toBe(false);
		expect(sleep.getAttribute("aria-expanded")).toBe("true");
		expect(getComputedStyle(sleep).display).toBe("none");
		expect(document.activeElement).toBe(get(panel, 'input[value="off"]'));
		await userEvent.keyboard("{ArrowLeft}");
		expect(panel.hidden).toBe(true);
		expect(document.activeElement).toBe(sleep);
	});

	test("a page toggle is a real checkbox the page reads with a change listener", async () => {
		let root = mount(1024, { controls: true });
		let seen: boolean[] = [];
		root.addEventListener("change", (event) => {
			let input = event.target as HTMLInputElement;
			if (input.name === "ambient") seen.push(input.checked);
		});
		await openSettings(root);
		let ambient = get<HTMLInputElement>(root, 'input[name="ambient"]');
		expect(ambient.getAttribute("role")).toBe("menuitemcheckbox");
		await userEvent.keyboard("{Enter}");
		await userEvent.click(ambient.closest("label")!);
		expect(seen).toEqual([false, true]);
		expect(ambient.getAttribute("aria-checked")).toBe("true");
	});

	test("a page submenu is a radio group named on its row once chosen", async () => {
		let root = mount(1024, { controls: true });
		let picked: string[] = [];
		root.addEventListener("change", (event) => {
			let input = event.target as HTMLInputElement;
			if (input.name === "sleep") picked.push(input.value);
		});
		await openSettings(root);
		let sleep = submenuRow(root, "Sleep timer");
		expect(sleep.textContent).toContain("Off");
		await userEvent.click(sleep);
		await userEvent.click(get(root, 'input[name="sleep"][value="30"]').closest("label")!);
		expect(picked).toEqual(["30"]);
		expect(get<HTMLInputElement>(root, 'input[name="sleep"]:checked').value).toBe("30");
		expect(sleep.textContent).toContain("30 minutes");
		expect(get(root, 'input[name="sleep"][value="30"]').getAttribute("aria-checked")).toBe("true");
		expect(get(root, 'input[name="sleep"][value="off"]').getAttribute("aria-checked")).toBe(
			"false",
		);
		expect(document.activeElement).toBe(sleep);
	});

	test("the speed menu sets the playback rate", async () => {
		let root = mount(1024, { controls: true });
		let video = get<HTMLVideoElement>(root, "video");
		await openSettings(root);
		let speed = submenuRow(root, "Playback speed");
		expect(speed.textContent).toContain("Normal");
		await userEvent.click(speed);
		await userEvent.keyboard("{ArrowDown}{Enter}");
		expect(video.playbackRate).toBe(1.5);
		expect(speed.textContent).toContain("1.5");
	});

	test("the quality menu swaps the file from the same moment and moves the badge", async () => {
		let root = mount(1024, { controls: true });
		let video = get<HTMLVideoElement>(root, "video");
		video.currentTime = 72;
		await openSettings(root);
		await userEvent.click(submenuRow(root, "Quality"));
		let option = get(root, '[data-video-setting="quality"] input[value="1"]').closest("label")!;
		expect(option.textContent).toBe("2160p4K");
		await userEvent.click(option);
		expect(new URL(video.src).pathname).toBe(SRC_4K);
		expect(get(root, '[data-slot="video-player-badge"]').textContent).toBe("4K");
		expect(submenuRow(root, "Quality").textContent).toContain("2160p");
		expect(chapterLinks(root)[0]!.getAttribute("href")).toBe(`${SRC}#t=0`);
	});

	test("leaves an unlabelled format fallback off the quality menu", () => {
		let host = document.createElement("div");
		document.body.appendChild(host);
		render(
			<VideoPlayer duration={60}>
				<VideoPlayer.Screen label="Clip" captionsLabel="English" chaptersLabel="Chapters">
					<VideoPlayer.Source src="/clip.webm" type="video/webm" label="1080p" badge="HD" />
					<VideoPlayer.Source src="/clip.mp4" type="video/mp4" />
					<VideoPlayer.Controls label="Video controls">
						<VideoPlayer.Settings label="Settings">
							<VideoPlayer.QualityMenu label="Quality" backLabel="Back" />
						</VideoPlayer.Settings>
					</VideoPlayer.Controls>
				</VideoPlayer.Screen>
			</VideoPlayer>,
			{ container: host },
		);
		expect(
			[...host.querySelectorAll("video source")].map((source) => source.getAttribute("src")),
		).toEqual(["/clip.webm", "/clip.mp4"]);
		let options = host.querySelectorAll<HTMLInputElement>('[data-video-setting="quality"] input');
		expect([...options].map((option) => option.value)).toEqual(["0"]);
	});

	test("the captions menu picks a track and lights the toggle", async () => {
		let root = mount(1024, { controls: true });
		let video = get<HTMLVideoElement>(root, "video");
		await openSettings(root);
		await userEvent.click(submenuRow(root, "Subtitles/CC"));
		await userEvent.click(
			get(root, '[data-video-setting="captions"] input[value="0"]').closest("label")!,
		);
		expect(captionTracks(video)[0]!.mode).toBe("showing");
		expect(get(root, '[data-video-action="captions"]').getAttribute("aria-pressed")).toBe("true");
	});

	test("the menu stays dark with light ink and fits a 375px viewport", async () => {
		let root = mount(375, { controls: true });
		let menu = await openSettings(root);
		let style = getComputedStyle(menu);
		expect(style.colorScheme).toBe("dark");
		expect(channels(style.color).every((channel) => channel > 200)).toBe(true);
		expect(channels(style.backgroundColor).every((channel) => channel < 60)).toBe(true);
		let box = menu.getBoundingClientRect();
		expect(box.left).toBeGreaterThanOrEqual(0);
		expect(box.right).toBeLessThanOrEqual(window.innerWidth);
	});
});
