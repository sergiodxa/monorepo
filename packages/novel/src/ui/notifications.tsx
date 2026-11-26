/**
 * The notifications part: the player's toasts (unlocks, endings, a scene's `notify` and a game's
 * own) in a manual popover, so they sit in the top layer over the stage, open dialogs and full
 * screen alike. Each toast leaves after a while; reduced motion drops its entrance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { css, on, ref } from "remix/component";

import type { NovelNotification } from "./behaviors/notifications.js";

import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { listenerSignal } from "./signal.js";
import { themeVar } from "./theme.js";

/** Milliseconds a toast stays by default. */
const NOTIFICATION_DURATION_MS = 4000;

export namespace Notifications {
	/** Props {@link Notifications} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children" | "popover"> {
		/**
		 * Milliseconds each toast stays before it is dismissed.
		 *
		 * @default 4000
		 */
		duration?: number;
	}
}

/**
 * Shows the player's `notifications` queue as toasts in a `popover="manual"` element, opened with
 * `showPopover()` while a toast is queued and hidden once the last one is dismissed. It is a
 * polite live region, and `--novel-notification-inset` places it within the player's box
 * (the window's, where CSS anchor positioning is missing).
 *
 * @example <NovelPlayer.Notifications duration={6000} mix={css({ "--novel-notification-inset": "auto auto 1rem 1rem" })} />
 */
export function Notifications(handle: Handle<Notifications.Props>) {
	let player = handle.context.get(NovelPlayer);
	let notifications = player.notifications;
	let element: HTMLElement | undefined;
	let timers = new Map<string, ReturnType<typeof setTimeout>>();

	notifications.addEventListener("change", () => void handle.update(), {
		signal: listenerSignal(handle),
	});
	handle.signal.addEventListener("abort", () => {
		for (let timer of timers.values()) clearTimeout(timer);
		timers.clear();
	});

	/**
	 * Opens the popover while a toast is queued and closes it when none is, and gives each new
	 * toast its timer while dropping the timers of toasts dismissed some other way.
	 */
	function sync(): void {
		let entries = notifications.entries;
		let queued = new Set(entries.map((entry) => entry.id));
		for (let [id, timer] of timers) {
			if (queued.has(id)) continue;
			clearTimeout(timer);
			timers.delete(id);
		}
		let duration = handle.props.duration ?? NOTIFICATION_DURATION_MS;
		for (let entry of entries) {
			if (timers.has(entry.id)) continue;
			timers.set(
				entry.id,
				setTimeout(() => {
					timers.delete(entry.id);
					notifications.dismiss(entry.id);
				}, duration),
			);
		}
		if (element === undefined || !element.isConnected) return;
		let open = element.matches(":popover-open");
		if (entries.length > 0 && !open) element.showPopover();
		else if (entries.length === 0 && open) element.hidePopover();
	}

	return () => {
		let { duration: _duration, mix, ...rest } = handle.props;
		handle.queueTask(sync);
		return (
			<div
				{...rest}
				popover="manual"
				role="status"
				aria-live="polite"
				aria-label={player.labels.notifications}
				data-novel-notifications=""
				mix={[
					ref((node) => {
						element = node;
						sync();
					}),
					css({
						position: "fixed",
						inset: themeVar("--novel-notification-inset"),
						positionAnchor: player.anchor,
						positionArea: "center",
						margin: 0,
						padding: 0,
						border: "none",
						background: "transparent",
						color: "inherit",
						overflow: "visible",
						"& ol": {
							margin: 0,
							padding: 0,
							listStyle: "none",
							display: "grid",
							gap: themeVar("--novel-notification-gap"),
							justifyItems: "end",
						},
						"& li": {
							padding: themeVar("--novel-notification-padding"),
							border: themeVar("--novel-notification-border"),
							borderRadius: themeVar("--novel-notification-radius"),
							background: themeVar("--novel-notification-background"),
							color: themeVar("--novel-notification-color"),
							fontFamily: themeVar("--novel-notification-font"),
							fontSize: themeVar("--novel-notification-font-size"),
							boxShadow: themeVar("--novel-notification-shadow"),
							animation: themeVar("--novel-notification-animation"),
						},
						"@keyframes novel-notification-in": {
							from: { opacity: 0, translate: "0 -0.5rem" },
							to: { opacity: 1, translate: "0 0" },
						},
						"@media (prefers-reduced-motion: reduce)": { "& li": { animation: "none" } },
					}),
					mix,
				]}
			>
				<ol>
					{notifications.entries.map((entry) => (
						<li key={entry.id} data-novel-notification={entry.id} data-kind={entry.kind}>
							<ToastBody entry={entry} />
						</li>
					))}
				</ol>
			</div>
		);
	};
}

/** Props of {@link ToastBody}. */
interface ToastBodyProps {
	entry: NovelNotification;
}

/**
 * A toast's words; a toast that `opens` an entry or a character is a button that opens it in the
 * encyclopedia and dismisses the toast.
 */
function ToastBody(handle: Handle<ToastBodyProps>) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let { entry } = handle.props;
		let words =
			"text" in entry ? (
				entry.text
			) : (
				<Message i18nKey={entry.key} values={entry.values} markup={player.markup} />
			);
		let target = entry.opens;
		if (target === undefined) return <>{words}</>;
		return (
			<button
				type="button"
				data-novel-notification-opens=""
				mix={[
					css({
						padding: 0,
						border: 0,
						background: "none",
						color: "inherit",
						font: "inherit",
						textAlign: "inherit",
						cursor: "pointer",
					}),
					on("click", () => {
						player.notifications.dismiss(entry.id);
						if ("entry" in target) player.showEntry(target.entry);
						else player.showCharacter(target.character);
					}),
				]}
			>
				{words}
			</button>
		);
	};
}
