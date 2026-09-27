/**
 * Field schemas every resource shape in the API document repeats: the prefixed ids it
 * serializes and the epoch-millisecond timestamps, so each reads the same in every
 * response and a change to either lands once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

import type { Prefix } from "~/app/services/typed-id";

import { typeIdPattern } from "~/app/services/typed-id";

/**
 * A serialized id, as `encodeId(prefix, …)` writes it; the pattern is the one a request
 * carrying the id back is held to.
 *
 * @param prefix The resource's prefix.
 * @example resourceId("mon")
 */
export function resourceId(prefix: Prefix) {
	return s.string().pipe(checks.pattern(new RegExp(typeIdPattern(prefix))));
}

/** An instant, in milliseconds since the Unix epoch. */
export function epochMs() {
	return s.integer().meta({ description: "Epoch milliseconds" });
}
