/**
 * Why JS: seeking in place, marking what plays, and a custom control bar all need the media
 * element's API. No-JS baseline: every time is a `#t=` link into the file, and the video
 * keeps the browser's own controls; this mixin swaps them for the bar when it runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { installMediaSync, markPlaying } from "../../mixins/media-sync.js";
import { installMenuKeys } from "../../mixins/menu-keys.js";
import { formatVideoTime, playedShare } from "../utils/timeline.js";

/** Items the top level of a settings menu walks: its rows, and none inside a submenu. */
const MENU_ITEMS = '[data-video-item]:not([data-slot="video-player-submenu-panel"] *)';

/** The playing-order lists a video player marks: its chapter links and transcript lines. */
const MARKS = ['[data-slot="video-player-chapters"] a', '[data-slot="video-player-cue"]'];

/**
 * Fills each scrubber segment to its played share at `time`, and scrolls a newly current
 * transcript line into view inside the transcript alone.
 */
function paintTimeline(root: HTMLElement, time: number, changed: readonly HTMLElement[]): void {
	for (let bar of root.querySelectorAll<HTMLElement>('[data-slot="video-player-segment"]')) {
		let share = playedShare(Number(bar.dataset.start), Number(bar.dataset.end), time);
		bar.style.setProperty("--ui-video-player-played", `${share * 100}%`);
	}
	let line = changed.find((item) => item.dataset.slot === "video-player-cue");
	let region = root.querySelector<HTMLElement>('[data-slot="video-player-transcript"]');
	if (line && region) region.scrollTop = line.offsetTop - region.clientHeight / 3;
}

/**
 * Brings a player's marks to `time`: the chapter link and transcript line playing then
 * carry `aria-current`, each scrubber segment fills to its played share, and a newly
 * current line scrolls into view inside the transcript alone.
 *
 * @param root The player's `<figure>`.
 * @param time The video's current time in seconds.
 */
export function syncVideo(root: HTMLElement, time: number): void {
	let changed = MARKS.map((selector) =>
		markPlaying(root.querySelectorAll<HTMLElement>(selector), time),
	).filter((item) => item !== undefined);
	paintTimeline(root, time, changed);
}

/**
 * The text tracks the captions controls choose between, in document order; a captions
 * track written from an empty transcript is left out.
 */
function captionTracks(video: HTMLVideoElement): TextTrack[] {
	return [...video.querySelectorAll("track")]
		.filter((track) => track.kind === "captions" || track.kind === "subtitles")
		.filter((track) => !track.hasAttribute("data-empty"))
		.map((track) => track.track);
}

/**
 * Mirrors a menu input's checked state into `aria-checked`, which its menu item role
 * requires; a radio updates every radio of its name.
 */
function syncChecked(input: HTMLInputElement): void {
	let group =
		input.type === "radio"
			? input.closest('[role="menu"]')?.querySelectorAll<HTMLInputElement>("input[type=radio]")
			: undefined;
	for (let item of group ?? [input]) item.setAttribute("aria-checked", String(item.checked));
}

/** Length of the video: the file's once known, else the timeline's the page declared. */
function lengthOf(video: HTMLVideoElement, progress: HTMLInputElement | null): number {
	if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
	return Number(progress?.max ?? 0);
}

/**
 * Wires one player's custom bar, with every handler ending when `signal` aborts: the bar
 * replaces the native controls, buttons drive the video, built-in menu rows set speed,
 * quality and captions, and the settings menu walks its panels by keyboard.
 */
class VideoControls {
	root: HTMLElement;
	video: HTMLVideoElement;
	signal: AbortSignal;
	/** The captions track the toggle turns back on, which the last choice decides. */
	lastCaptions = 0;

	constructor(root: HTMLElement, video: HTMLVideoElement, signal: AbortSignal) {
		this.root = root;
		this.video = video;
		this.signal = signal;
	}

	/** Every control of `name` in the player. */
	all<T extends HTMLElement = HTMLElement>(selector: string): T[] {
		return [...this.root.querySelectorAll<T>(selector)];
	}

	/** Hides the native controls, reveals the bar, and restores both when the signal aborts. */
	install(bar: HTMLElement): void {
		let { root, signal, video } = this;
		video.controls = false;
		bar.hidden = false;
		signal.addEventListener("abort", () => {
			video.controls = true;
			bar.hidden = true;
		});
		if (!document.fullscreenEnabled) {
			for (let button of this.all('[data-video-action="fullscreen"]')) button.hidden = true;
		}

		root.addEventListener("click", (event) => this.onClick(event), { signal });
		root.addEventListener("change", (event) => this.onChange(event), { signal });
		root.addEventListener("input", (event) => this.onInput(event), { signal });
		root.addEventListener("keydown", (event) => this.onKeydown(event), { signal });
		for (let type of ["play", "pause", "ended", "timeupdate", "durationchange", "ratechange"]) {
			video.addEventListener(type, () => this.render(), { signal });
		}
		document.addEventListener("fullscreenchange", () => this.render(), { signal });
		for (let menu of this.all('[data-slot="video-player-settings"]')) this.installMenu(menu);
		this.showCaptions(this.checkedCaptions());
		this.render();
	}

	/** Runs the menu keyboard on each panel, and opens the menu on its top level. */
	installMenu(menu: HTMLElement): void {
		let { signal } = this;
		let main = menu.querySelector<HTMLElement>('[data-slot="video-player-menu"]');
		if (main) installMenuKeys(main, signal, { itemSelector: MENU_ITEMS });
		for (let panel of menu.querySelectorAll<HTMLElement>(
			'[data-slot="video-player-submenu-panel"]',
		)) {
			installMenuKeys(panel, signal, { itemSelector: "[data-video-item]" });
		}
		menu.addEventListener(
			"toggle",
			(event) => {
				if ((event as ToggleEvent).newState !== "open") return;
				this.closePanels(menu);
				main?.querySelector<HTMLElement>(MENU_ITEMS)?.focus();
			},
			{ signal },
		);
	}

	/** Brings every control's state to the video's: playing, time, progress, captions, screen. */
	render(): void {
		let { root, video } = this;
		let playing = !video.paused && !video.ended;
		root.toggleAttribute("data-playing", playing);
		for (let button of this.all('[data-video-action="play"]')) {
			let label = playing ? button.dataset.labelPause : button.dataset.labelPlay;
			if (label) button.setAttribute("aria-label", label);
		}
		let progress = root.querySelector<HTMLInputElement>('[data-slot="video-player-progress"]');
		let length = lengthOf(video, progress);
		for (let elapsed of this.all('[data-slot="video-player-elapsed"]')) {
			elapsed.textContent = formatVideoTime(video.currentTime);
		}
		for (let total of this.all('[data-slot="video-player-length"]')) {
			total.textContent = formatVideoTime(length);
		}
		for (let input of this.all<HTMLInputElement>('[data-slot="video-player-progress"]')) {
			input.max = String(length);
			input.value = String(video.currentTime);
			input.setAttribute(
				"aria-valuetext",
				`${formatVideoTime(video.currentTime)} / ${formatVideoTime(length)}`,
			);
			input.style.setProperty(
				"--ui-video-player-progress",
				`${length > 0 ? (video.currentTime / length) * 100 : 0}%`,
			);
		}
		let screen = root.querySelector('[data-slot="video-player-screen"]');
		let fullscreen = screen !== null && document.fullscreenElement === screen;
		for (let button of this.all('[data-video-action="fullscreen"]')) {
			button.setAttribute("aria-pressed", String(fullscreen));
		}
	}

	/** Runs a bar button, seeks from a time link, or plays and pauses from the picture. */
	onClick(event: MouseEvent): void {
		let target = event.target as Element | null;
		let button = target?.closest<HTMLElement>("[data-video-action]");
		if (button) {
			this.act(button);
			return;
		}
		if (target instanceof HTMLVideoElement && target === this.video) this.togglePlay();
	}

	/** What one bar button does. */
	act(button: HTMLElement): void {
		let { root } = this;
		switch (button.dataset.videoAction) {
			case "play":
				this.togglePlay();
				return;
			case "captions": {
				let showing = captionTracks(this.video).some((track) => track.mode === "showing");
				this.showCaptions(showing ? -1 : this.lastCaptions);
				return;
			}
			case "theater": {
				let on = !root.hasAttribute("data-theater");
				root.toggleAttribute("data-theater", on);
				button.setAttribute("aria-pressed", String(on));
				return;
			}
			case "fullscreen":
				void this.toggleFullscreen();
				return;
			case "open":
				this.openPanel(button);
				return;
			case "back":
				this.closePanel(button.closest<HTMLElement>('[data-slot="video-player-submenu-panel"]'));
		}
	}

	/** Plays a paused video and pauses a playing one. */
	togglePlay(): void {
		let { video } = this;
		if (video.paused || video.ended) void video.play().catch(() => undefined);
		else video.pause();
	}

	/** Puts the player's screen, bar included, in full screen, or takes it out. */
	async toggleFullscreen(): Promise<void> {
		let screen = this.root.querySelector<HTMLElement>('[data-slot="video-player-screen"]');
		if (!screen) return;
		if (document.fullscreenElement === screen) await document.exitFullscreen();
		else await screen.requestFullscreen().catch(() => undefined);
	}

	/** Seeks as the progress slider moves. */
	onInput(event: Event): void {
		let input = event.target as HTMLElement | null;
		if (!(input instanceof HTMLInputElement)) return;
		if (input.dataset.slot !== "video-player-progress") return;
		this.video.currentTime = Number(input.value);
		syncVideo(this.root, this.video.currentTime);
		this.render();
	}

	/** Applies a built-in setting, names the choice on its row and returns to the top level. */
	onChange(event: Event): void {
		let input = event.target;
		if (!(input instanceof HTMLInputElement) || !input.hasAttribute("data-video-item")) return;
		syncChecked(input);
		if (input.type !== "radio") return;
		let panel = input.closest<HTMLElement>('[data-slot="video-player-submenu-panel"]');
		if (!panel) return;
		switch (panel.dataset.videoSetting) {
			case "rate":
				this.video.playbackRate = Number(input.value);
				this.video.defaultPlaybackRate = Number(input.value);
				break;
			case "quality":
				this.swapSource(Number(input.value));
				break;
			case "captions":
				this.showCaptions(Number(input.value));
				break;
		}
		this.nameChoice(panel, input);
		this.closePanel(panel);
	}

	/** Copies the checked option's label onto the row that opens its submenu. */
	nameChoice(panel: HTMLElement, input: HTMLInputElement): void {
		let label = input
			.closest("label")
			?.querySelector('[data-slot="video-player-option-label"]')?.textContent;
		let value = this.root
			.querySelector(`[aria-controls="${panel.id}"]`)
			?.querySelector('[data-slot="video-player-row-value"]');
		if (value && label !== undefined && label !== null) value.textContent = label;
	}

	/**
	 * The menu keys the shared pattern leaves to the surface: → opens a submenu, ← returns from
	 * one, and Enter flips a checkbox or picks a radio the way Space does.
	 */
	onKeydown(event: KeyboardEvent): void {
		let target = event.target as HTMLElement | null;
		if (!target?.closest('[data-slot="video-player-settings"]')) return;
		let panel = target.closest<HTMLElement>('[data-slot="video-player-submenu-panel"]');
		if (event.key === "ArrowRight" && target.dataset.videoAction === "open") {
			event.preventDefault();
			this.openPanel(target);
		} else if (event.key === "ArrowLeft" && panel) {
			event.preventDefault();
			this.closePanel(panel);
		} else if (event.key === "ArrowRight" && panel) {
			event.preventDefault();
		} else if (event.key === "Enter" && target instanceof HTMLInputElement) {
			event.preventDefault();
			target.click();
		}
	}

	/** Shows the submenu a row opens in place of the top level, focusing its checked option. */
	openPanel(trigger: HTMLElement): void {
		let id = trigger.getAttribute("aria-controls");
		let panel = id ? document.getElementById(id) : null;
		let main = trigger.closest<HTMLElement>('[data-slot="video-player-menu"]');
		if (!panel || !main) return;
		main.setAttribute("data-submenu", "");
		panel.hidden = false;
		trigger.setAttribute("aria-expanded", "true");
		let checked = panel.querySelector<HTMLElement>("[data-video-item]:checked");
		(checked ?? panel.querySelector<HTMLElement>("[data-video-item]"))?.focus();
	}

	/** Returns from a submenu to the top level, focusing the row that opened it. */
	closePanel(panel: HTMLElement | null): void {
		if (!panel || panel.hidden) return;
		panel.hidden = true;
		let trigger = this.root.querySelector<HTMLElement>(`[aria-controls="${panel.id}"]`);
		trigger?.setAttribute("aria-expanded", "false");
		trigger?.closest('[data-slot="video-player-menu"]')?.removeAttribute("data-submenu");
		trigger?.focus();
	}

	/** Puts a menu back on its top level, as it opens. */
	closePanels(menu: HTMLElement): void {
		for (let panel of menu.querySelectorAll<HTMLElement>(
			'[data-slot="video-player-submenu-panel"]',
		)) {
			panel.hidden = true;
		}
		for (let trigger of menu.querySelectorAll('[data-video-action="open"]')) {
			trigger.setAttribute("aria-expanded", "false");
		}
		menu.querySelector('[data-slot="video-player-menu"]')?.removeAttribute("data-submenu");
	}

	/** The captions option the server rendered checked, `-1` for off. */
	checkedCaptions(): number {
		let checked = this.root.querySelector<HTMLInputElement>(
			'[data-video-setting="captions"] input:checked',
		);
		return checked ? Number(checked.value) : -1;
	}

	/**
	 * Shows the captions track at `index` and hides the rest, `-1` hiding them all; the toggle,
	 * the captions menu and its row follow.
	 */
	showCaptions(index: number): void {
		let tracks = captionTracks(this.video);
		for (let [position, track] of tracks.entries()) {
			track.mode = position === index ? "showing" : "disabled";
		}
		if (index >= 0) this.lastCaptions = index;
		let on = index >= 0 && index < tracks.length;
		for (let button of this.all('[data-video-action="captions"]')) {
			button.setAttribute("aria-pressed", String(on));
		}
		for (let panel of this.all('[data-video-setting="captions"]')) {
			let input = panel.querySelector<HTMLInputElement>(`input[value="${on ? index : -1}"]`);
			if (!input) continue;
			input.checked = true;
			syncChecked(input);
			this.nameChoice(panel, input);
		}
	}

	/**
	 * Plays the source at `index` from the moment the current one reached, keeping its speed and
	 * whether it was playing; the settings badges follow the new source's badge.
	 */
	swapSource(index: number): void {
		let { signal, video } = this;
		let source = video.querySelectorAll("source")[index];
		if (!source) return;
		let time = video.currentTime;
		let playing = !video.paused;
		video.addEventListener(
			"loadedmetadata",
			() => {
				video.currentTime = time;
				if (playing) void video.play().catch(() => undefined);
			},
			{ once: true, signal },
		);
		video.src = source.src;
		for (let badge of this.all('[data-slot="video-player-badge"][data-follows-quality]')) {
			badge.textContent = source.dataset.badge ?? "";
			badge.hidden = !source.dataset.badge;
		}
	}
}

/**
 * Wires one player until `signal` aborts: time links seek in place, the marks follow the
 * video, and a control bar, when the player has one, replaces the native controls.
 */
function wirePlayer(root: HTMLElement, video: HTMLVideoElement, signal: AbortSignal): void {
	installMediaSync(root, video, signal, {
		marks: MARKS,
		onTime: (time, changed) => paintTimeline(root, time, changed),
	});
	let bar = root.querySelector<HTMLElement>('[data-slot="video-player-controls"]');
	if (bar) new VideoControls(root, video, signal).install(bar);
}

/**
 * Keeps a video player's links, marks, bar and video in step from a node inside its
 * `[data-slot="video-player"]` root. A plain click on a time link seeks and plays; a
 * modified click still opens the file itself.
 *
 * @returns A mixin descriptor for any element inside the player.
 * @example <span hidden mix={[videoPlayerSync()]} />
 */
export const videoPlayerSync: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let root = event.node.closest<HTMLElement>('[data-slot="video-player"]');
		let video = root?.querySelector("video");
		if (!root || !video) return;
		controller = new AbortController();
		wirePlayer(root, video, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});
