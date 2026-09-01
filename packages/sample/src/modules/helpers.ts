/**
 * The shapes that turn one generated value into many: picking from a caller's
 * own list, repeating a generator, and leaving a field empty part of the time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "../random";

/** Options for picking several distinct elements. */
export interface PickManyOptions {
	count: number;
}

/** Options for repeating a generator. */
export interface MultipleOptions {
	count: number;
}

/** Options for a value that is sometimes absent. */
export interface MaybeOptions {
	/** How often the value is present, half the time by default. */
	chance?: number;
}

/** Drawing from a caller's list, and repeating a generator. */
export interface HelpersModule {
	/**
	 * One element.
	 *
	 * @throws RangeError when the list is empty.
	 */
	pick<T>(items: readonly T[]): T;
	/**
	 * `count` distinct elements, in a shuffled order.
	 *
	 * @throws RangeError when the list holds fewer than `count` elements.
	 */
	pickMany<T>(items: readonly T[], options: PickManyOptions): T[];
	/** A shuffled copy; the argument keeps its order. */
	shuffle<T>(items: readonly T[]): T[];
	/** `count` values, each built by calling `build` with its index. */
	multiple<T>(build: (index: number) => T, options: MultipleOptions): T[];
	/** The built value, or `null` the rest of the time. */
	maybe<T>(build: () => T, options?: MaybeOptions): T | null;
}

/** Create the `helpers` module over one stream. */
export function createHelpersModule(random: Random): HelpersModule {
	return {
		pick(items) {
			return random.pick(items);
		},
		pickMany(items, options) {
			if (!Number.isSafeInteger(options.count) || options.count < 0) {
				throw new RangeError(
					`pickMany() needs a count of zero or more, received ${options.count}.`,
				);
			}
			if (options.count > items.length) {
				throw new RangeError(
					`pickMany() needs ${options.count} items to pick from, the list holds ${items.length}.`,
				);
			}
			return random.shuffle(items).slice(0, options.count);
		},
		shuffle(items) {
			return random.shuffle(items);
		},
		multiple(build, options) {
			if (!Number.isSafeInteger(options.count) || options.count < 0) {
				throw new RangeError(
					`multiple() needs a count of zero or more, received ${options.count}.`,
				);
			}
			return Array.from({ length: options.count }, (_, index) => build(index));
		},
		maybe(build, options = {}) {
			return random.bool(options.chance ?? 0.5) ? build() : null;
		},
	};
}
