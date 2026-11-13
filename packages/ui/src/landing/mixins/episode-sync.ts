/**
 * Why JS: a media-fragment link opens the audio file on its own page, so seeking the player
 * already on the page and marking what is playing needs script. No-JS baseline: every time
 * link plays the file from that moment, and the chapter list stays a plain list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/**
 * Keeps the `[data-slot="episode-player"]` around its host in step with that player's
 * `<audio>`: a plain click on an `a[data-start]` seeks and plays, and the chapter link and
 * `[data-cue]` passage now playing carry `aria-current="true"`. A modified click opens the file.
 *
 * @example <span hidden mix={[episodeSync()]} />
 */
export const episodeSync: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		let root = event.node.closest<HTMLElement>('[data-slot="episode-player"]');
		let audio = root?.querySelector("audio");
		if (!root || !audio) return;
		let player = audio;
		controller = new AbortController();
		let { signal } = controller;

		root.addEventListener(
			"click",
			(click) => {
				if (click.defaultPrevented || click.button !== 0) return;
				if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
				let link = (click.target as Element | null)?.closest<HTMLElement>("a[data-start]");
				if (!link) return;
				click.preventDefault();
				player.currentTime = Number(link.dataset.start);
				void player.play().catch(() => undefined);
				markCurrent(root, player.currentTime);
			},
			{ signal },
		);
		player.addEventListener("timeupdate", () => markCurrent(root, player.currentTime), {
			signal,
		});
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/**
 * Marks the chapter link and the transcript passage playing at `time`: the last of each
 * whose start is at or before it. The attribute is written only when it changes.
 */
function markCurrent(root: HTMLElement, time: number) {
	mark(root.querySelectorAll<HTMLElement>('[data-slot="episode-player-chapters"] a'), time);
	mark(root.querySelectorAll<HTMLElement>('[data-slot="episode-player-cue"]'), time);
}

/** Sets `aria-current` on the last element of a playing-order list that has started. */
function mark(items: NodeListOf<HTMLElement>, time: number) {
	let current: HTMLElement | undefined;
	for (let item of items) {
		if (Number(item.dataset.start ?? item.dataset.cue) <= time + 0.25) current = item;
	}
	for (let item of items) {
		let isCurrent = item === current;
		if (isCurrent === (item.getAttribute("aria-current") === "true")) continue;
		if (isCurrent) item.setAttribute("aria-current", "true");
		else item.removeAttribute("aria-current");
	}
}
