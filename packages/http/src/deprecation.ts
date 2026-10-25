/**
 * Deprecation signalling on the Fetch API: the RFC 9745 `Deprecation` field, the RFC 8594
 * `Sunset` field and their `deprecation` and `sunset` link relations, written by a server
 * announcing a resource's retirement and read back by a client watching for one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { parse as parseLinks, serializeLink, stringify as stringifyLinks } from "@sdxc/link-header";
import { failure, isFailure, success } from "@sdxc/result";
import { getField, setField } from "@sdxc/structured-fields";

/**
 * What a response announces about its resource's retirement. Every member is optional:
 * a resource may publish its deprecation policy link long before it names a date.
 */
export interface DeprecationNotice {
	/** When the resource was deprecated, or will be when the date is in the future. */
	deprecation?: Date;
	/** When the resource is expected to stop answering; never earlier than `deprecation`. */
	sunset?: Date;
	/** Documentation of the deprecation and how to migrate, linked with `rel="deprecation"`. */
	deprecationLink?: string;
	/** Documentation of the retirement policy, linked with `rel="sunset"`. */
	sunsetLink?: string;
}

/**
 * A notice the fields cannot carry: an invalid `Date`, or a sunset earlier than the
 * deprecation, which RFC 9745 forbids a server to send.
 */
export class DeprecationNoticeError extends Error {
	override name = "DeprecationNoticeError" as const;
}

/** The relation types this module owns inside a `Link` field. */
const RELATIONS = ["deprecation", "sunset"] as const;

/**
 * Writes a notice onto response headers, replacing any `Deprecation`, `Sunset` and
 * `deprecation`/`sunset` links already there and keeping every other link. Dates are
 * truncated to whole seconds, the precision both fields carry.
 *
 * @param headers - The response headers to write.
 * @param notice - What to announce.
 * @returns Success once written, or why the notice is invalid, leaving `headers` untouched.
 * @example setDeprecation(response.headers, { deprecation: new Date("2026-12-01T00:00:00Z"), sunset: new Date("2027-06-01T00:00:00Z"), deprecationLink: "https://example.com/changelog" });
 * @example setDeprecation(response.headers, { deprecationLink: "https://example.com/deprecation-policy" });
 */
export function setDeprecation(
	headers: Headers,
	notice: DeprecationNotice,
): Result<void, DeprecationNoticeError> {
	let deprecation = notice.deprecation === undefined ? undefined : wholeSeconds(notice.deprecation);
	let sunset = notice.sunset === undefined ? undefined : wholeSeconds(notice.sunset);

	if (deprecation !== undefined && Number.isNaN(deprecation.getTime())) {
		return failure(new DeprecationNoticeError("The deprecation date is invalid"));
	}
	if (sunset !== undefined && Number.isNaN(sunset.getTime())) {
		return failure(new DeprecationNoticeError("The sunset date is invalid"));
	}
	if (deprecation !== undefined && sunset !== undefined && sunset < deprecation) {
		return failure(new DeprecationNoticeError("The sunset date is earlier than the deprecation"));
	}

	headers.delete("Deprecation");
	if (deprecation !== undefined) {
		let written = setField(headers, "Deprecation", deprecation, "item");
		if (isFailure(written)) return failure(new DeprecationNoticeError(written.error.message));
	}

	if (sunset === undefined) headers.delete("Sunset");
	else headers.set("Sunset", sunset.toUTCString());

	let links: string[] = [];
	for (let link of parseLinks(headers.get("Link"))) {
		if (!link.rels.some((rel) => (RELATIONS as readonly string[]).includes(rel))) {
			links.push(link.raw);
		}
	}
	if (notice.deprecationLink !== undefined) {
		links.push(serializeLink(notice.deprecationLink, "deprecation"));
	}
	if (notice.sunsetLink !== undefined) links.push(serializeLink(notice.sunsetLink, "sunset"));

	let link = stringifyLinks(links);
	if (link === null) headers.delete("Link");
	else headers.set("Link", link);

	return success(undefined);
}

/**
 * Reads the notice a response carries. Both fields are hints a client must work without,
 * so an unreadable one is left out of the notice: a `Sunset` reads in any spelling
 * `Date.parse` accepts, including the `UTC` zone RFC 9745's own example uses.
 *
 * @param headers - The response headers to read.
 * @returns The notice, or `null` when the response announces nothing.
 * @example
 * let notice = getDeprecation(response.headers);
 * if (notice?.deprecation) log.warn("Deprecated endpoint", { deprecation: notice.deprecation });
 */
export function getDeprecation(headers: Headers): DeprecationNotice | null {
	let notice: DeprecationNotice = {};

	let deprecation = getField(headers, "Deprecation", "item");
	if (!isFailure(deprecation) && deprecation.data?.value instanceof Date) {
		notice.deprecation = deprecation.data.value;
	}

	let sunset = headers.get("Sunset");
	let sunsetTime = sunset === null ? Number.NaN : Date.parse(sunset);
	if (!Number.isNaN(sunsetTime)) notice.sunset = new Date(sunsetTime);

	for (let link of parseLinks(headers.get("Link"))) {
		if (notice.deprecationLink === undefined && link.rels.includes("deprecation")) {
			notice.deprecationLink = link.target;
		}
		if (notice.sunsetLink === undefined && link.rels.includes("sunset")) {
			notice.sunsetLink = link.target;
		}
	}

	return Object.keys(notice).length === 0 ? null : notice;
}

/** Drops the milliseconds an HTTP-date and an sf-date cannot represent. */
function wholeSeconds(date: Date): Date {
	return new Date(Math.floor(date.getTime() / 1000) * 1000);
}
