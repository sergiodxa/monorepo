/**
 * The primitive a field is sometimes just a flag for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "../random.js";

/** Options for a generated boolean. */
export interface BooleanOptions {
	/** How often `true` comes back, half the time by default. */
	probability?: number;
}

/** Boolean values. */
export interface DatatypeModule {
	boolean(options?: BooleanOptions): boolean;
}

/** Create the `datatype` module over one stream. */
export function createDatatypeModule(random: Random): DatatypeModule {
	return {
		boolean(options = {}) {
			return random.bool(options.probability ?? 0.5);
		},
	};
}
