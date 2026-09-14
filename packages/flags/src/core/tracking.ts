/**
 * What an application attaches to an action it wants measured against the flags
 * a subject saw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

/**
 * The payload of a tracking event. `value` is the well-defined scalar an
 * analytics backend maps to its own numeric field — a cart total, a duration —
 * and every other field is arbitrary data about the occurrence, nested
 * structures included.
 */
export interface TrackingEventDetails {
	value?: number;
	[field: string]: JSONValue | undefined;
}
