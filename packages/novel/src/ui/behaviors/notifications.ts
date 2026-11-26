/**
 * Notifications as a headless model: a short queue of toasts such as "CG unlocked", "Ending 3/5"
 * or an achievement. The player feeds it from the novel's `unlock`, `ending` and `notify` events,
 * and a game pushes its own; `NovelPlayer.Notifications` draws it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dispatchChange } from "@sdxc/ui/utils";
import { TypedEventTarget } from "remix/component";

/** Toasts the queue holds by default; the oldest leaves first. */
const NOTIFICATIONS_LIMIT = 5;

/** What clicking a toast opens: an encyclopedia entry by `<topic>.<entry>`, or a character's page. */
export type NotificationTarget = { entry: string } | { character: string };

/** A toast's words already in the reader's language, such as a label. */
export interface NotificationText {
	text: string;
	/** Makes the toast a button that opens this entry or character in the encyclopedia. */
	opens?: NotificationTarget;
	/**
	 * What it reports, set as `data-kind` on the toast for a theme to style: `"image"`, `"music"`,
	 * `"entry"`, `"ending"` and `"notify"` from the player, anything a game pushes.
	 *
	 * @default "custom"
	 */
	kind?: string;
}

/** A toast's words as a catalog message, translated where it is drawn, like a line. */
export interface NotificationMessage {
	/** The message key. */
	key: string;
	/** The values the message is formatted with. */
	values?: Record<string, unknown> | undefined;
	/** Makes the toast a button that opens this entry or character in the encyclopedia. */
	opens?: NotificationTarget;
	/** @default "custom" */
	kind?: string;
}

/** A toast as `push()` takes it: plain text or a message to translate. */
export type NotificationInput = NotificationText | NotificationMessage;

/** One toast in the queue, with its `id` and `kind` settled. */
export type NovelNotification = NotificationInput & {
	/** Unique within its queue, so a part keys and dismisses it. */
	id: string;
	kind: string;
};

/**
 * What the player and `NovelPlayer.Notifications` need from notifications, which
 * `NovelPlayer`'s `behaviors.notifications` replaces: the queue, a toast added, and one dismissed.
 */
export interface NotificationsBehavior extends TypedEventTarget<NotificationsBehavior.EventMap> {
	/** The toasts to show, oldest first. */
	readonly entries: readonly NovelNotification[];
	/**
	 * Adds a toast, which a game calls for its own news.
	 *
	 * @returns The toast as the queue holds it, with its `id`.
	 */
	push(notification: NotificationInput): NovelNotification;
	/** Removes the toast with `id`, as its timer or the reader does. */
	dismiss(id: string): void;
}

export namespace NotificationsBehavior {
	/** Events a {@link NotificationsBehavior} dispatches. */
	export interface EventMap {
		/** Dispatched after a toast is added or dismissed. */
		change: Event;
	}
}

export namespace NotificationsModel {
	/** Events {@link NotificationsModel} dispatches. */
	export interface EventMap extends NotificationsBehavior.EventMap {}

	/** Options {@link NotificationsModel} takes. */
	export interface Options {
		/**
		 * The most toasts the queue holds; pushing past it drops the oldest.
		 *
		 * @default 5
		 */
		limit?: number;
	}
}

/**
 * Keeps the toasts waiting to be seen, bounded so a burst of unlocks never floods the screen.
 *
 * @example player.notifications.push({ key: "achievements.firstCatch", kind: "achievement" })
 */
export class NotificationsModel
	extends TypedEventTarget<NotificationsModel.EventMap>
	implements NotificationsBehavior
{
	#entries: NovelNotification[] = [];
	#limit: number;
	#count = 0;

	/** @param options - How many toasts to keep at once. */
	constructor(options: NotificationsModel.Options = {}) {
		super();
		this.#limit = Math.max(1, options.limit ?? NOTIFICATIONS_LIMIT);
	}

	get entries(): readonly NovelNotification[] {
		return this.#entries;
	}

	/** Adds a toast at the end of the queue, dropping the oldest past the limit. */
	push(notification: NotificationInput): NovelNotification {
		this.#count += 1;
		let entry: NovelNotification = {
			...notification,
			id: String(this.#count),
			kind: notification.kind ?? "custom",
		};
		this.#entries = [...this.#entries, entry].slice(-this.#limit);
		dispatchChange(this);
		return entry;
	}

	/** Removes the toast with `id`; an id no longer queued changes nothing. */
	dismiss(id: string): void {
		if (!this.#entries.some((entry) => entry.id === id)) return;
		this.#entries = this.#entries.filter((entry) => entry.id !== id);
		dispatchChange(this);
	}
}
