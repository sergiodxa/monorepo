/**
 * The backlog as a headless model: the recent lines in reading order with the values and voice
 * they were shown with, kept to a bounded size, replaced when the same line shows again after a
 * rollback, and trimmed when a rollback leaves the line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dispatchChange } from "@sdxc/ui/utils";
import { TypedEventTarget } from "remix/component";

import type { LineFrame, Speaker } from "../../frames.js";

import { resolveSource } from "../source.js";

/** Lines the backlog keeps by default. */
const BACKLOG_SIZE = 200;

/** A line as the backlog keeps it, with the values it was shown with. */
export interface BacklogEntry {
	/** The frame id the line was shown on. */
	id: string;
	scene: string;
	key: string;
	values: Record<string, unknown> | undefined;
	speakers: Speaker[];
	/** The voice file, resolved for the reader's locale, or `null` for an unvoiced line. */
	voice: string | null;
}

export namespace BacklogModel {
	/** Events {@link BacklogModel} dispatches. */
	export interface EventMap {
		/** Dispatched after the entries change. */
		change: Event;
	}
}

/**
 * Keeps the lines a play has shown, oldest first.
 *
 * @example let backlog = new BacklogModel(); backlog.record(frame, "en");
 */
export class BacklogModel extends TypedEventTarget<BacklogModel.EventMap> {
	#entries: BacklogEntry[] = [];
	#size: number;

	/** @param size - How many lines to keep; the oldest go first. */
	constructor(size = BACKLOG_SIZE) {
		super();
		this.#size = size;
	}

	get entries(): readonly BacklogEntry[] {
		return this.#entries;
	}

	/** Adds a shown line, replacing the last entry when it is the same line shown again. */
	record(frame: LineFrame, locale: string): void {
		let entry: BacklogEntry = {
			id: frame.id,
			scene: frame.scene,
			key: frame.key,
			values: frame.values,
			speakers: frame.speakers,
			voice: frame.voice === null ? null : resolveSource(frame.voice, locale),
		};
		let kept = this.#isLast(frame) ? this.#entries.slice(0, -1) : this.#entries;
		this.#entries = [...kept, entry].slice(-this.#size);
		dispatchChange(this);
	}

	/** Drops the last entry when it is `frame`'s line, as a rollback away from it does. */
	leave(frame: LineFrame): void {
		if (!this.#isLast(frame)) return;
		this.#entries = this.#entries.slice(0, -1);
		dispatchChange(this);
	}

	/** Starts over from `entries`, as a new play or a resumed one does. */
	replace(entries: readonly BacklogEntry[]): void {
		this.#entries = [...entries];
		dispatchChange(this);
	}

	/** True when the newest entry is `frame`'s line. */
	#isLast(frame: LineFrame): boolean {
		let last = this.#entries.at(-1);
		return last?.scene === frame.scene && last.key === frame.key;
	}
}
