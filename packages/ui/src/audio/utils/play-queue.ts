/**
 * The play order of a music player as plain data: which track plays, what comes next with
 * shuffle and repeat, and what Previous does. Every function returns a new queue, so a player
 * keeps one value in state and a test checks each rule without media.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Types associated with the play queue functions. */
export namespace PlayQueue {
	/** `all` starts the list again after its last track; `one` plays the same track again. */
	export type Repeat = "off" | "all" | "one";

	/** A queue over a list of tracks, which the player keeps beside it. */
	export interface State {
		/** How many tracks the list holds. */
		length: number;
		/** The list's indexes in the order they play: the list's own, or a shuffle of it. */
		order: number[];
		/** Where in {@link order} the player is. */
		position: number;
		shuffle: boolean;
		repeat: Repeat;
	}
}

/** The repeat mode after each one, in the order a player's single button cycles them. */
const NEXT_REPEAT: Record<PlayQueue.Repeat, PlayQueue.Repeat> = {
	off: "all",
	all: "one",
	one: "off",
};

/** How far into a track, in seconds, Previous restarts it rather than going back one. */
export const RESTART_THRESHOLD = 3;

/**
 * Shuffles indexes with the Fisher–Yates walk, so every order is equally likely.
 *
 * @param indexes The indexes to shuffle; left unchanged.
 * @param random A source of numbers in [0, 1).
 */
function shuffled(indexes: number[], random: () => number): number[] {
	let copy = [...indexes];
	for (let i = copy.length - 1; i > 0; i--) {
		let j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j] as number, copy[i] as number];
	}
	return copy;
}

/**
 * Starts a queue at one track of a list. With shuffle on, that track plays first and the rest
 * follow in a random order.
 *
 * @param length How many tracks the list holds.
 * @param start The index of the track to play first.
 * @param options Shuffle, repeat and the random source a test pins.
 * @example createPlayQueue(12, 3, { shuffle: true })
 */
export function createPlayQueue(
	length: number,
	start: number,
	options: { shuffle?: boolean; repeat?: PlayQueue.Repeat; random?: () => number } = {},
): PlayQueue.State {
	let first = Math.min(Math.max(0, start), Math.max(0, length - 1));
	let indexes = Array.from({ length }, (_, index) => index);
	let shuffle = options.shuffle ?? false;
	let order = shuffle
		? [
				first,
				...shuffled(
					indexes.filter((index) => index !== first),
					options.random ?? Math.random,
				),
			]
		: indexes;
	return {
		length,
		order,
		position: shuffle ? 0 : first,
		shuffle,
		repeat: options.repeat ?? "off",
	};
}

/**
 * The list index of the track the queue is on, or `undefined` for an empty queue.
 *
 * @param queue The queue.
 */
export function currentIndex(queue: PlayQueue.State): number | undefined {
	return queue.order[queue.position];
}

/**
 * Moves to the next track. When a track ends by itself (`ended`), repeat-one plays it again;
 * pressing Next always moves on. Past the last track, repeat-all starts over and otherwise
 * the queue ends.
 *
 * @param queue The queue.
 * @param ended Whether the track finished playing, rather than the listener pressing Next.
 * @returns The new queue, or `null` once nothing is left to play.
 */
export function nextInQueue(queue: PlayQueue.State, ended = false): PlayQueue.State | null {
	if (queue.length === 0) return null;
	if (ended && queue.repeat === "one") return queue;
	if (queue.position + 1 < queue.order.length) return { ...queue, position: queue.position + 1 };
	return queue.repeat === "off" ? null : { ...queue, position: 0 };
}

/**
 * What Previous does: restarts the track once it has played a few seconds, and otherwise goes
 * back one, wrapping to the end under repeat-all and staying on the first track without it.
 *
 * @param queue The queue.
 * @param time How far into the current track the player is, in seconds.
 * @returns The new queue and whether the player should seek to the start of its track.
 */
export function previousInQueue(
	queue: PlayQueue.State,
	time: number,
): { queue: PlayQueue.State; restart: boolean } {
	if (time > RESTART_THRESHOLD || queue.length === 0) return { queue, restart: true };
	if (queue.position > 0)
		return { queue: { ...queue, position: queue.position - 1 }, restart: false };
	if (queue.repeat === "all") {
		return { queue: { ...queue, position: queue.order.length - 1 }, restart: false };
	}
	return { queue, restart: true };
}

/**
 * Turns shuffle on or off without interrupting the track playing: on, it stays first and the
 * rest are shuffled after it; off, the list's own order resumes from it.
 *
 * @param queue The queue.
 * @param random A source of numbers in [0, 1).
 */
export function toggleShuffle(
	queue: PlayQueue.State,
	random: () => number = Math.random,
): PlayQueue.State {
	let current = currentIndex(queue) ?? 0;
	let next = createPlayQueue(queue.length, current, {
		shuffle: !queue.shuffle,
		repeat: queue.repeat,
		random,
	});
	return next;
}

/**
 * Steps repeat from off to all to one and back to off, the order a player's one button cycles.
 *
 * @param queue The queue.
 */
export function cycleRepeat(queue: PlayQueue.State): PlayQueue.State {
	return { ...queue, repeat: NEXT_REPEAT[queue.repeat] };
}

/**
 * Jumps to a track that is already queued, such as a row picked in the queue panel.
 *
 * @param queue The queue.
 * @param index The list index of the track.
 * @returns The queue on that track; unchanged when the list has no such index.
 */
export function jumpTo(queue: PlayQueue.State, index: number): PlayQueue.State {
	let position = queue.order.indexOf(index);
	return position === -1 ? queue : { ...queue, position };
}

/**
 * The list indexes still to play after the current track, in order: under repeat-all the
 * list's start follows its end, so "Next up" never reads empty while the music goes on.
 *
 * @param queue The queue.
 * @param limit The most indexes to return.
 */
export function upcoming(queue: PlayQueue.State, limit = Number.POSITIVE_INFINITY): number[] {
	let after = queue.order.slice(queue.position + 1);
	if (queue.repeat === "all") after = [...after, ...queue.order.slice(0, queue.position)];
	return after.slice(0, limit);
}
