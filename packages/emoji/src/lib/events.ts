/**
 * DOM event a picker or suggest cell dispatches when the user picks an emoji.
 * Cancelable so insert mixins can skip their default close/single-insert path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** DOM event type for {@link EmojiPickEvent}. */
export const EMOJI_PICK_EVENT = "ui:emoji-pick" as const;

declare global {
	interface HTMLElementEventMap {
		[EMOJI_PICK_EVENT]: EmojiPickEvent;
	}
}

/** Payload carried by {@link EmojiPickEvent}. */
export type EmojiPickDetail =
	| { kind: "unicode"; emoji: string; name: string }
	| { kind: "custom"; name: string; src: string; label?: string };

/**
 * Dispatched on the picker/suggest host when a cell is chosen. Bubbles and is
 * cancelable: `preventDefault()` opts out of the field mixin's default insert
 * and close behavior for keep-open / multi-pick UIs.
 */
export class EmojiPickEvent extends Event {
	/** What was picked. */
	readonly detail: EmojiPickDetail;

	/**
	 * @param detail - Unicode or custom pick payload
	 */
	constructor(detail: EmojiPickDetail) {
		super(EMOJI_PICK_EVENT, { bubbles: true, cancelable: true });
		this.detail = detail;
	}
}
