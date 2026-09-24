/**
 * WebFinger (RFC 7033): the JRD document, reading the `resource` and `rel` query
 * parameters, and selecting only the links asked for, so a server answers the way
 * §4 requires and a client reads what any server returns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { WellKnownFormat } from "./format.js";
import type { JsonObject } from "./lib/json.js";

import { isObject, pointer, readJsonObject } from "./lib/json.js";
import { WellKnownParseError } from "./parse-error.js";

export const NAME = "webfinger";
export const MEDIA_TYPE = "application/jrd+json";

/** The JSON Resource Descriptor (RFC 7033 §4.4). */
export interface Jrd {
	subject: string | null;
	aliases: string[];
	/** Property URIs to values; RFC 7033 §4.4.3 allows `null`. */
	properties: Record<string, string | null>;
	links: JrdLink[];
}

/** One link of a JRD (RFC 7033 §4.4.4). */
export interface JrdLink {
	rel: string;
	type: string | null;
	href: string | null;
	/** Language tag, or `und`, to title. */
	titles: Record<string, string>;
	properties: Record<string, string | null>;
}

/** What a WebFinger request asks for. */
export interface WebFingerQuery {
	resource: string;
	/** Every `rel` parameter, in order; empty selects all links. */
	rels: string[];
}

/** A WebFinger request without a `resource`, which §4.2 answers with a 400. */
export class MissingResourceError extends Error {
	override name = "MissingResourceError";

	constructor() {
		super('The WebFinger request has no "resource" parameter.');
	}
}

/**
 * Reads `resource` and every `rel` from a request URL, per RFC 7033 §4.1. A missing or
 * empty `resource` fails, so the caller answers 400 as §4.2 requires.
 *
 * @param url - The request URL.
 * @example
 * let query = readQuery(ctx.url);
 * if (isFailure(query)) return new Response(query.error.message, { status: 400 });
 */
export function readQuery(url: URL): Result<WebFingerQuery, MissingResourceError> {
	let resource = url.searchParams.get("resource");
	if (resource === null || resource === "") return failure(new MissingResourceError());
	return success({ resource, rels: url.searchParams.getAll("rel") });
}

/**
 * The document with only the links whose `rel` was asked for, per §4.3; an empty list
 * keeps every link, and every other member is kept either way.
 *
 * @param document - The full document.
 * @param rels - The requested relation types.
 */
export function select(document: Jrd, rels: string[]): Jrd {
	if (rels.length === 0) return document;
	return { ...document, links: document.links.filter((link) => rels.includes(link.rel)) };
}

/**
 * Reads a property map, whose values §4.4.3 allows to be strings or `null`.
 *
 * @param value - The decoded member.
 * @param at - The member's pointer.
 * @param issues - Where problems are collected.
 */
function readProperties(
	value: unknown,
	at: string,
	issues: WellKnownParseError.Issue[],
): Record<string, string | null> {
	if (value === undefined) return {};
	if (!isObject(value)) {
		issues.push({ at, message: "Properties are not an object." });
		return {};
	}
	let result: Record<string, string | null> = {};
	for (let [key, entry] of Object.entries(value)) {
		if (typeof entry === "string" || entry === null) result[key] = entry;
		else
			issues.push({
				at: `${at}${pointer(key)}`,
				message: "A property value is not a string or null.",
			});
	}
	return result;
}

/**
 * Reads a member that must be a string when present.
 *
 * @param body - The object holding it.
 * @param member - The member name.
 * @param at - The object's pointer.
 * @param issues - Where problems are collected.
 */
function readOptionalString(
	body: JsonObject,
	member: string,
	at: string,
	issues: WellKnownParseError.Issue[],
): string | null {
	let value = body[member];
	if (value === undefined || value === null) return null;
	if (typeof value === "string") return value;
	issues.push({ at: `${at}${pointer(member)}`, message: `"${member}" is not a string.` });
	return null;
}

/**
 * Reads one link, which must name its `rel`.
 *
 * @param value - The decoded array element.
 * @param at - The element's pointer.
 * @param issues - Where problems are collected.
 */
function readLink(value: unknown, at: string, issues: WellKnownParseError.Issue[]): JrdLink | null {
	if (!isObject(value)) {
		issues.push({ at, message: "A link is not an object." });
		return null;
	}
	if (typeof value.rel !== "string") {
		issues.push({ at: `${at}/rel`, message: 'A link has no string "rel".' });
		return null;
	}

	let titles: Record<string, string> = {};
	if (value.titles !== undefined) {
		if (isObject(value.titles)) {
			for (let [tag, title] of Object.entries(value.titles)) {
				if (typeof title === "string") titles[tag] = title;
				else
					issues.push({ at: `${at}/titles${pointer(tag)}`, message: "A title is not a string." });
			}
		} else issues.push({ at: `${at}/titles`, message: "Titles are not an object." });
	}

	return {
		rel: value.rel,
		type: readOptionalString(value, "type", at, issues),
		href: readOptionalString(value, "href", at, issues),
		titles,
		properties: readProperties(value.properties, `${at}/properties`, issues),
	};
}

/**
 * Reads a JRD. Absent members read as empty; a member of the wrong type or a link
 * without `rel` fails, with every issue reported.
 *
 * @param text - The served JSON.
 */
export function parse(text: string): Result<Jrd, WellKnownParseError> {
	let decoded = readJsonObject(text, NAME);
	if (decoded.status === "failure") return decoded;
	let body = decoded.data;
	let issues: WellKnownParseError.Issue[] = [];

	let aliases: string[] = [];
	if (body.aliases !== undefined) {
		if (Array.isArray(body.aliases)) {
			for (let [index, alias] of body.aliases.entries()) {
				if (typeof alias === "string") aliases.push(alias);
				else issues.push({ at: pointer("aliases", index), message: "An alias is not a string." });
			}
		} else issues.push({ at: "/aliases", message: '"aliases" is not an array.' });
	}

	let links: JrdLink[] = [];
	if (body.links !== undefined) {
		if (Array.isArray(body.links)) {
			for (let [index, entry] of body.links.entries()) {
				let link = readLink(entry, pointer("links", index), issues);
				if (link) links.push(link);
			}
		} else issues.push({ at: "/links", message: '"links" is not an array.' });
	}

	let document: Jrd = {
		subject: readOptionalString(body, "subject", "", issues),
		aliases,
		properties: readProperties(body.properties, "/properties", issues),
		links,
	};

	if (issues.length > 0) return failure(new WellKnownParseError(NAME, issues));
	return success(document);
}

/**
 * Writes a JRD, leaving out a `null` subject, empty lists and empty maps, and a link's
 * `null` members.
 *
 * @param document - The descriptor to publish.
 */
export function stringify(document: Jrd): string {
	let output: JsonObject = {};
	if (document.subject !== null) output.subject = document.subject;
	if (document.aliases.length > 0) output.aliases = document.aliases;
	if (Object.keys(document.properties).length > 0) output.properties = document.properties;
	if (document.links.length > 0) {
		output.links = document.links.map((link) => {
			let written: JsonObject = { rel: link.rel };
			if (link.type !== null) written.type = link.type;
			if (link.href !== null) written.href = link.href;
			if (Object.keys(link.titles).length > 0) written.titles = link.titles;
			if (Object.keys(link.properties).length > 0) written.properties = link.properties;
			return written;
		});
	}
	return JSON.stringify(output);
}

/** WebFinger as a servable format; every answer carries CORS `*`, as §5 requires. */
export const webFinger: WellKnownFormat<Jrd> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "insert",
	cors: true,
	stringify,
	parse,
};
