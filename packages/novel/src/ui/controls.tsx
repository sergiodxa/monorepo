/**
 * The player's input as mixins: keys, touch gestures and the wheel, and gamepads. Each one finds
 * the nearest `NovelPlayer` through context and drives it only through its public API, so a game
 * picks the inputs it wants by applying them, and an input left out does nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { moveFocus, swipeDirection } from "@sdxc/ui/utils";
import { createMixin, css, on } from "remix/component";

import type { PlayerAction } from "./settings.js";

import { QUICK_SLOT } from "./behaviors/save-slots.js";
import { gamepadActions } from "./input.js";
import { NovelPlayer } from "./player.js";
import { KEYMAP } from "./settings.js";
import { listenerSignal } from "./signal.js";

/** Milliseconds between two wheel actions, so one flick of a trackpad rolls back one stop. */
const WHEEL_INTERVAL_MS = 300;

/** Milliseconds after a swipe during which the click it produced is swallowed. */
const SWIPE_CLICK_MS = 500;

/** Elements whose clicks belong to themselves rather than advancing the story. */
export const INTERACTIVE =
	"button, a, input, select, textarea, label, dialog, [data-novel-ui], [data-novel-interaction]";

export namespace keyboardControls {
	/** Options {@link keyboardControls} accepts. */
	export interface Options {
		/**
		 * The action of each key, by `KeyboardEvent.key`; a lowercase entry also matches the key
		 * with Shift. Control always skips while held.
		 *
		 * @default KEYMAP
		 */
		keymap?: Readonly<Record<string, PlayerAction>>;
	}
}

/**
 * Runs one player action as an input asks for it: any input brings a hidden interface back
 * first, and a replay refuses to save.
 *
 * @param player - The player to drive.
 * @param action - What the key, gesture or button asked for.
 */
export function perform(player: NovelPlayer.Context, action: PlayerAction): void {
	if (player.hidden && action !== "hide" && action !== "fullscreen") {
		player.hide(false);
		return;
	}
	if (player.replaying && (action === "save" || action === "quickSave")) return;
	if (action === "advance") player.advance();
	else if (action === "auto") player.toggleAuto();
	else if (action === "skip") player.toggleSkip();
	else if (action === "rollback") void player.rollback();
	else if (action === "hide") player.hide();
	else if (action === "fullscreen") player.toggleFullscreen();
	else if (action === "quickSave") player.save(QUICK_SLOT);
	else if (action === "quickLoad") void player.load(QUICK_SLOT);
	else if (action === "endReplay") void player.endReplay();
	else player.open(action);
}

/** The player a mixin sits under, or `undefined` outside one. */
function playerOf(handle: { context: { get(component: unknown): unknown } }) {
	return handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
}

/**
 * Maps keys to player actions while the page's focus is on the page or inside the host. Keys
 * stand down while a dialog is open, a field or button takes them, or a modifier is held; held
 * Control skips until it is released or the window loses focus.
 *
 * @example <NovelPlayer novel={novel} mix={keyboardControls({ keymap: { ...KEYMAP, x: "auto" } })} />
 */
export const keyboardControls = createMixin<HTMLElement, [options?: keyboardControls.Options]>(
	(handle) => {
		let player = playerOf(handle);
		let host: HTMLElement | undefined;
		let keymap = KEYMAP;

		/** Maps a key to its action while the host has the page's attention. */
		function keydown(event: KeyboardEvent): void {
			if (player === undefined || host === undefined || !host.isConnected) return;
			let active = document.activeElement;
			if (active !== null && active !== document.body && !host.contains(active)) return;
			void player.mixer.resume();
			if (event.key === "Control") {
				player.holdSkip(true);
				return;
			}
			if (player.dialog !== null || event.ctrlKey || event.metaKey || event.altKey) return;
			let target = event.target as Element | null;
			if (target !== null && target.closest("input, select, textarea, [contenteditable]") !== null)
				return;
			let onButton = target !== null && target.closest("button") !== null;
			if (onButton && (event.key === " " || event.key === "Enter")) return;
			let action = keymap[event.key] ?? keymap[event.key.toLowerCase()];
			if (action === undefined) return;
			event.preventDefault();
			perform(player, action);
		}

		handle.addEventListener("insert", (event) => {
			host = event.node;
			document.addEventListener("keydown", keydown, { signal: listenerSignal(handle) });
			document.addEventListener(
				"keyup",
				(key) => {
					if (key.key === "Control") player?.holdSkip(false);
				},
				{ signal: listenerSignal(handle) },
			);
			window.addEventListener("blur", () => player?.holdSkip(false), {
				signal: listenerSignal(handle),
			});
		});

		return (options) => {
			keymap = options?.keymap ?? KEYMAP;
			return handle.element;
		};
	},
	{ ssr: false },
);

/**
 * Gestures on the host: a downward swipe opens the backlog and an upward one rolls back, without
 * the swipe's click advancing as well, and the wheel rolls back (up) and advances (down), once
 * per 300ms. The host takes every touch gesture instead of scrolling the page.
 *
 * @example <NovelPlayer novel={novel} mix={touchControls()} />
 */
export const touchControls = createMixin<HTMLElement>((handle) => {
	let player = playerOf(handle);
	let touch: { x: number; y: number } | undefined;
	let swiped = 0;
	let lastWheel = 0;

	return () => (
		<handle.element
			mix={[
				css({ touchAction: "none" }),
				on("pointerdown", (event) => {
					let touching = event.pointerType === "touch" && player?.dialog === null;
					touch = touching ? { x: event.clientX, y: event.clientY } : undefined;
				}),
				on("pointerup", (event) => {
					let start = touch;
					touch = undefined;
					if (start === undefined || player === undefined) return;
					let direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
					if (direction === null) return;
					swiped = event.timeStamp;
					if (direction === "down") perform(player, "backlog");
					else if (direction === "up") perform(player, "rollback");
				}),
				on(
					"click",
					(event) => {
						if (swiped === 0 || event.timeStamp - swiped >= SWIPE_CLICK_MS) return;
						event.stopImmediatePropagation();
						event.stopPropagation();
					},
					true,
				),
				on("wheel", (event) => {
					if (player === undefined || player.dialog !== null || event.deltaY === 0) return;
					if (event.timeStamp - lastWheel < WHEEL_INTERVAL_MS) return;
					lastWheel = event.timeStamp;
					perform(player, event.deltaY < 0 ? "rollback" : "advance");
				}),
			]}
		/>
	);
});

/**
 * Polls standard-mapping gamepads once per animation frame while one is connected: the D-pad
 * moves focus through the host (or the open dialog), A presses the focused control or advances,
 * B closes the dialog or hides the interface, LB rolls back, RB skips and Start opens settings.
 *
 * @example <NovelPlayer novel={novel} mix={gamepadControls()} />
 */
export const gamepadControls = createMixin<HTMLElement>(
	(handle) => {
		let player = playerOf(handle);
		let host: HTMLElement | undefined;
		let pads = new Map<number, boolean[]>();
		let polling = false;

		/** Runs one gamepad action against the player. */
		function press(action: ReturnType<typeof gamepadActions>[number]): void {
			if (host === undefined || player === undefined) return;
			void player.mixer.resume();
			let dialog = player.dialog;
			if (action === "focus-next" || action === "focus-previous") {
				moveFocus(dialog ?? host, action === "focus-next" ? 1 : -1);
				return;
			}
			if (action === "activate") {
				let focused = document.activeElement;
				if (
					focused instanceof HTMLElement &&
					host.contains(focused) &&
					focused.matches(INTERACTIVE)
				)
					focused.click();
				else perform(player, "advance");
				return;
			}
			if (action === "back") {
				if (dialog === null) player.hide();
				else dialog.close();
				return;
			}
			if (dialog !== null) return;
			if (action === "rollback") perform(player, "rollback");
			else if (action === "skip") perform(player, "skip");
			else perform(player, "settings");
		}

		/** Polls connected gamepads once per frame until none is left. */
		function startPolling(): void {
			if (polling) return;
			polling = true;
			let poll = () => {
				if (handle.signal.aborted) return;
				let connected = (navigator.getGamepads?.() ?? []).filter((pad) => pad !== null);
				for (let pad of connected) {
					let buttons = pad.buttons.map((button) => button.pressed);
					for (let action of gamepadActions(pads.get(pad.index) ?? [], buttons)) press(action);
					pads.set(pad.index, buttons);
				}
				if (connected.length === 0) {
					polling = false;
					return;
				}
				requestAnimationFrame(poll);
			};
			requestAnimationFrame(poll);
		}

		handle.addEventListener("insert", (event) => {
			host = event.node;
			window.addEventListener("gamepadconnected", startPolling, { signal: listenerSignal(handle) });
			if (navigator.getGamepads?.().some((pad) => pad !== null)) startPolling();
		});

		return () => handle.element;
	},
	{ ssr: false },
);
