/**
 * TypeID encoding for the `/api/v1/*` wire format. Rows store canonical UUIDs, so
 * this is the seam that turns one into the prefixed identifier the API documents
 * (`mon_01h455vb4pex5vsknk084sn02q`) on the way out, and turns it back into a UUID
 * the `app/data/*` layer can query with on the way in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypeID } from "@sdxc/typeid";
import { assertUUID, isUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";

/**
 * Every prefix the API serializes, and the only values {@link encodeId} and
 * {@link typedId} accept. Keeping them in one union is what stops a serializer and
 * its route param from drifting onto different spellings of the same resource, and
 * each one is the prefix already published in `resources/docs/api/`.
 */
export type Prefix =
	| "alt"
	| "chk"
	| "cron"
	| "dns"
	| "dnsrec"
	| "dom"
	| "evt"
	| "flow"
	| "flowres"
	| "inv"
	| "key"
	| "mem"
	| "mnt"
	| "mon"
	| "ping"
	| "res"
	| "sp"
	| "tcpm"
	| "tcpr"
	| "team"
	| "usr";

/**
 * Encodes a stored UUID as the TypeID string the API returns.
 *
 * @param prefix Prefix naming the resource the id belongs to.
 * @param id Canonical UUID read from the database.
 * @returns TypeID string such as `mon_01h455vb4pex5vsknk084sn02q`.
 * @throws {InvalidUUIDFormatError} If the id is not a canonical UUID.
 * @example
 * encodeId("mon", monitor.id);
 * // "mon_01h455vb4pex5vsknk084sn02q"
 */
export function encodeId(prefix: Prefix, id: string): string {
	assertUUID(id);
	return TypeID.fromUUID(prefix, id).toString();
}

/**
 * Schema for an identifier arriving in a route param or a request body, decoding it
 * to the UUID the data layer queries with.
 *
 * `refine` rejects anything that is not a TypeID carrying `prefix` — a raw UUID and
 * an id borrowed from another resource both fail here — so `transform` only ever
 * runs on a value it can decode.
 *
 * @param prefix Prefix the incoming identifier must carry.
 * @returns Schema parsing a TypeID string into its UUID.
 * @example
 * const MonitorIdParams = s.object({ monitorId: typedId("mon") });
 * let { monitorId } = s.parse(MonitorIdParams, ctx.params);
 */
export function typedId<const prefix extends Prefix>(prefix: prefix) {
	return s
		.string()
		.refine((value) => TypeID.isValid(value, prefix), `Expected a ${prefix} identifier`)
		.transform((value) => TypeID.fromString(value, prefix).toUUID());
}

/**
 * Decodes an identifier written either as a TypeID or as the raw UUID behind it.
 *
 * This is for an endpoint whose URL a caller saved somewhere the API cannot reach —
 * a crontab, a deploy script — where the address they already have has to keep
 * working alongside the TypeID the API now hands out.
 *
 * @param prefix Prefix a TypeID form must carry.
 * @param value Incoming identifier in either form.
 * @returns The UUID, or null when the value is neither.
 * @example
 * decodeIdOrUUID("cron", ctx.params.cronJobId);
 */
export function decodeIdOrUUID(prefix: Prefix, value: string): string | null {
	if (TypeID.isValid(value, prefix)) return TypeID.fromString(value, prefix).toUUID();
	return isUUID(value) ? value : null;
}

/**
 * The prefix a monitor id carries, chosen by the `monitor_type` stored beside it. An
 * SSL event reports through the HTTP monitor whose certificate it watched, so it
 * shares that monitor's prefix.
 */
const MONITOR_TYPE_PREFIXES = {
	cron: "cron",
	dns: "dns",
	flow: "flow",
	http: "mon",
	ssl: "mon",
	tcp: "tcpm",
} as const satisfies Record<string, Prefix>;

/**
 * The prefix `type` names. The `monitor_type` columns are stored as text, so a value
 * outside the known set reads as HTTP — the same reading `storedMonitorScope` gives a
 * row written before the type column existed, when an id could only name an HTTP
 * monitor.
 */
function monitorPrefix(type: string | null): Prefix {
	if (type === null) return "mon";
	let prefixes: Record<string, Prefix | undefined> = MONITOR_TYPE_PREFIXES;
	return prefixes[type] ?? "mon";
}

/**
 * Encodes the monitor id half of a `(monitor_type, monitor_id)` pair, so a DNS monitor
 * comes back as `dns_…` rather than wearing the HTTP prefix.
 *
 * @param type Monitor type stored alongside the id.
 * @param id Canonical UUID read from the database.
 * @returns TypeID string carrying the prefix that matches `type`.
 * @example
 * encodeMonitorId("dns", alert.monitor_id);
 * // "dns_01h455vb4pex5vsknk084sn02q"
 */
export function encodeMonitorId(type: string | null, id: string): string {
	return encodeId(monitorPrefix(type), id);
}

/**
 * Decodes the monitor id half of a `(monitor_type, monitor_id)` pair.
 *
 * Returns null rather than throwing so a caller naming a monitor of one type with
 * another type's id gets the endpoint's own "monitor not found" answer, which is what
 * an id pointing into the wrong table amounts to.
 *
 * @param type Monitor type the id is expected to name.
 * @param value Incoming TypeID string.
 * @returns The UUID, or null when the value does not carry `type`'s prefix.
 * @example
 * decodeMonitorId("dns", "dns_01h455vb4pex5vsknk084sn02q");
 */
export function decodeMonitorId(type: string | null, value: string): string | null {
	let prefix = monitorPrefix(type);
	if (!TypeID.isValid(value, prefix)) return null;
	return TypeID.fromString(value, prefix).toUUID();
}
