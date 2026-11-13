/**
 * Why JS: seeking a media element in place and marking what plays need its API.
 * No-JS baseline: every time is a link carrying `#t=` into the file, which opens it
 * playing from that moment, and the server marks the moment it renders as now.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** How far, in seconds, a moment may run ahead of a start and still count as reaching it. */
const SEEK_SLACK = 0.25;

/** Types associated with {@link mediaSync} and {@link installMediaSync}. */
export namespace MediaSync {
	/** What one player's sync marks and reports. */
	export interface Options {
		/**
		 * Selectors, each matching one playing-order list under the player whose items carry
		 * their start in `data-start` or `data-cue`; the item playing carries `aria-current="true"`.
		 */
		marks: readonly string[];
		/** Runs after every seek and time update, with the items that newly became current. */
		onTime?: (time: number, changed: HTMLElement[]) => void;
	}

	/** Configuration accepted by {@link mediaSync}. */
	export interface MixinOptions extends Options {
		/** Selector of the player's root, the closest ancestor of the host that matches. */
		root: string;
	}
}

/**
 * Sets `aria-current="true"` on the last item of a playing-order list whose start is at or
 * before `time`, and removes it from the rest, writing only what changes.
 *
 * @param items The list's items in playing order, each with `data-start` or `data-cue`.
 * @param time The media's current time in seconds.
 * @returns The item that newly became current, or `undefined` when no item became current.
 */
export function markPlaying(items: Iterable<HTMLElement>, time: number): HTMLElement | undefined {
	let list = [...items];
	let current: HTMLElement | undefined;
	for (let item of list) {
		if (Number(item.dataset.start ?? item.dataset.cue) <= time + SEEK_SLACK) current = item;
	}
	let changed: HTMLElement | undefined;
	for (let item of list) {
		let isCurrent = item === current;
		if (isCurrent === (item.getAttribute("aria-current") === "true")) continue;
		if (isCurrent) {
			item.setAttribute("aria-current", "true");
			changed = item;
		} else item.removeAttribute("aria-current");
	}
	return changed;
}

/**
 * Keeps a player's time links and marks in step with its media until `signal` aborts: a
 * plain click on an `a[data-start]` seeks and plays, a modified click still opens the file,
 * and every seek and time update marks the item playing in each list.
 *
 * @param root The player's root, which holds the links and the lists.
 * @param media The `<audio>` or `<video>` the links seek.
 * @param signal Ends the listeners when it aborts.
 * @param options The lists to mark, and what to run after each update.
 * @example installMediaSync(root, audio, signal, { marks: ['[data-slot="chapters"] a'] });
 */
export function installMediaSync(
	root: HTMLElement,
	media: HTMLMediaElement,
	signal: AbortSignal,
	options: MediaSync.Options,
): void {
	let sync = () => {
		let changed = options.marks
			.map((selector) =>
				markPlaying(root.querySelectorAll<HTMLElement>(selector), media.currentTime),
			)
			.filter((item) => item !== undefined);
		options.onTime?.(media.currentTime, changed);
	};
	root.addEventListener(
		"click",
		(click) => {
			if (click.defaultPrevented || click.button !== 0) return;
			if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
			let link = (click.target as Element | null)?.closest<HTMLElement>("a[data-start]");
			if (!link) return;
			click.preventDefault();
			media.currentTime = Number(link.dataset.start);
			void media.play().catch(() => undefined);
			sync();
		},
		{ signal },
	);
	media.addEventListener("timeupdate", sync, { signal });
}

/**
 * Makes a player's `a[data-start]` time links seek and play its first `<audio>` or `<video>`,
 * and marks the playing item of each `marks` list, as {@link installMediaSync} does. The player
 * is the host's closest `root` match; the host is usually a hidden marker in the player's island.
 *
 * @param options The player's root selector and the lists to mark.
 * @returns A mixin descriptor for an element inside the player.
 * @example <span hidden mix={[mediaSync({ root: '[data-slot="episode"]', marks: ["[data-cue]"] })]} />
 */
export const mediaSync: MixinFactory<HTMLElement, [options: MediaSync.MixinOptions], ElementProps> =
	createMixin<HTMLElement, [options: MediaSync.MixinOptions], ElementProps>((handle) => {
		let controller: AbortController | undefined;
		let options: MediaSync.MixinOptions | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			let root = options ? event.node.closest<HTMLElement>(options.root) : null;
			let media = root?.querySelector<HTMLMediaElement>("audio, video");
			if (!options || !root || !media) return;
			controller = new AbortController();
			installMediaSync(root, media, controller.signal, options);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});

		return (next) => {
			options = next;
		};
	});
