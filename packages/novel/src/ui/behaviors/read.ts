/**
 * Read-line tracking as a headless model: whether the current line, and each line in the
 * backlog, had been read before it showed. It keeps the `seen` flag each line frame carries from
 * persistent data, the same one skip's read-only mode follows, so the two always agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dispatchChange } from "@sdxc/ui/utils";
import { TypedEventTarget } from "remix/component";

import type { StopFrame } from "../../frames.js";

/** Lines the model remembers by default, comfortably more than a backlog keeps. */
const READ_SIZE = 1000;

/**
 * What the player, the textbox and the backlog need from read-line tracking, which
 * `NovelPlayer`'s `behaviors.read` replaces: the current line's status, a shown line's status by
 * its frame id, and each stop recorded as it takes the stage.
 */
export interface ReadBehavior extends TypedEventTarget<ReadBehavior.EventMap> {
	/** True when the current stop is a line the reader had already read. */
	readonly current: boolean;
	/** True when the line shown on frame `id`, a backlog entry's `id`, had already been read. */
	isRead(id: string): boolean;
	/** Called with every stop as it takes the stage. */
	record(frame: StopFrame): void;
}

export namespace ReadBehavior {
	/** Events a {@link ReadBehavior} dispatches. */
	export interface EventMap {
		/** Dispatched after the current stop's status changes. */
		change: Event;
	}
}

export namespace ReadModel {
	/** Events {@link ReadModel} dispatches. */
	export interface EventMap extends ReadBehavior.EventMap {}
}

/**
 * Remembers, by frame id, whether each shown line had been read before, as its frame's `seen`
 * says; a line shown again after a rollback counts as read, as skip treats it.
 *
 * @example if (player.read.isRead(entry.id)) dim(entry);
 */
export class ReadModel extends TypedEventTarget<ReadModel.EventMap> implements ReadBehavior {
	#read = new Map<string, boolean>();
	#current = false;
	#size: number;

	/** @param size - How many lines to remember; the oldest go first. */
	constructor(size = READ_SIZE) {
		super();
		this.#size = Math.max(1, size);
	}

	get current(): boolean {
		return this.#current;
	}

	isRead(id: string): boolean {
		return this.#read.get(id) ?? false;
	}

	/** Keeps a line's `seen` under its frame id; any other stop leaves the current line unread. */
	record(frame: StopFrame): void {
		let read = frame.type === "line" && frame.seen;
		if (frame.type === "line") {
			this.#read.delete(frame.id);
			this.#read.set(frame.id, read);
			if (this.#read.size > this.#size) {
				let oldest = this.#read.keys().next().value;
				if (oldest !== undefined) this.#read.delete(oldest);
			}
		}
		if (read === this.#current) return;
		this.#current = read;
		dispatchChange(this);
	}
}
