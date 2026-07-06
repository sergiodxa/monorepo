/**
 * A small validation helper exposing `isUUID`, which checks whether an unknown value is a
 * valid UUID string. It uses Zod's UUID schema and `safeParse` so callers get a plain
 * boolean without exceptions. It exists to guard route params and inputs that must be
 * UUIDs before they are used to look up records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod";

export function isUUID(value: unknown) {
	return z.string().uuid().safeParse(value).success;
}
