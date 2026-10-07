/**
 * NodeInfo: the `/.well-known/nodeinfo` links document and the NodeInfo 2.0/2.1 document
 * it points at, so a server tells the fediverse which software it runs, which protocols
 * it speaks and how many people use it. Reads 2.0 and 2.1, writes 2.1.
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

export const NAME = "nodeinfo";
export const MEDIA_TYPE = "application/json";

/** The schema URI that names NodeInfo 2.0, as a link's `rel`. */
export const NODEINFO_2_0 = "http://nodeinfo.diaspora.software/ns/schema/2.0";

/** The schema URI that names NodeInfo 2.1, as a link's `rel`. */
export const NODEINFO_2_1 = "http://nodeinfo.diaspora.software/ns/schema/2.1";

/** The `Content-Type` of a NodeInfo 2.1 document, whose profile names the schema it follows. */
export const DOCUMENT_MEDIA_TYPE = `application/json; profile="${NODEINFO_2_1}#"`;

/** The schema's pattern for `software.name`: lowercase letters, digits and hyphens. */
const SOFTWARE_NAME = /^[a-z0-9-]+$/;

/**
 * A protocol the server speaks: one the NodeInfo schema registers, or any other name a
 * server publishes, such as `atproto`.
 */
export type NodeInfoProtocol =
	| "activitypub"
	| "buddycloud"
	| "dfrn"
	| "diaspora"
	| "libertree"
	| "ostatus"
	| "pumpio"
	| "tent"
	| "xmpp"
	| "zot"
	| (string & {});

/** A site the server can retrieve messages from, registered or not. */
export type InboundService =
	| "atom1.0"
	| "gnusocial"
	| "imap"
	| "pnut"
	| "pop3"
	| "pumpio"
	| "rss2.0"
	| "twitter"
	| (string & {});

/** A site the server can publish messages to, registered or not. */
export type OutboundService =
	| "atom1.0"
	| "blogger"
	| "buddycloud"
	| "diaspora"
	| "dreamwidth"
	| "drupal"
	| "facebook"
	| "friendica"
	| "gnusocial"
	| "google"
	| "insanejournal"
	| "libertree"
	| "linkedin"
	| "livejournal"
	| "mediagoblin"
	| "myspace"
	| "pinterest"
	| "pnut"
	| "posterous"
	| "pumpio"
	| "redmatrix"
	| "rss2.0"
	| "smtp"
	| "tent"
	| "tumblr"
	| "twitter"
	| "wordpress"
	| "xmpp"
	| (string & {});

/** The schema versions this module reads; every write is 2.1. */
export type NodeInfoVersion = "2.0" | "2.1";

/** The `/.well-known/nodeinfo` document: where each NodeInfo version a server offers lives. */
export interface NodeInfoLinks {
	links: NodeInfoLink[];
}

/** One NodeInfo version a server serves. */
export interface NodeInfoLink {
	/** The schema URI, such as `NODEINFO_2_1`. */
	rel: string;
	/** The absolute URL of the document. */
	href: string;
}

/** The NodeInfo document, in the 2.1 shape; a 2.0 document reads with 2.1's additions `null`. */
export interface NodeInfo {
	/** The schema version the document was read as; `stringify` always writes `"2.1"`. */
	version: NodeInfoVersion;
	software: NodeInfoSoftware;
	/** At least one protocol, as the schema requires. */
	protocols: NodeInfoProtocol[];
	services: NodeInfoServices;
	openRegistrations: boolean;
	usage: NodeInfoUsage;
	/** Free-form, server-specific data. */
	metadata: JsonObject;
}

/** The server software. */
export interface NodeInfoSoftware {
	/** Lowercase letters, digits and hyphens only, as the schema's pattern requires. */
	name: string;
	version: string;
	/** NodeInfo 2.1; `null` when absent and for every 2.0 document. */
	repository: string | null;
	/** NodeInfo 2.1; `null` when absent and for every 2.0 document. */
	homepage: string | null;
}

/** The third-party sites the server bridges. */
export interface NodeInfoServices {
	inbound: InboundService[];
	outbound: OutboundService[];
}

/** Usage statistics; a count the server withholds is `null`. */
export interface NodeInfoUsage {
	users: NodeInfoUsers;
	localPosts: number | null;
	localComments: number | null;
}

/** User counts; a count the server withholds is `null`. */
export interface NodeInfoUsers {
	total: number | null;
	activeMonth: number | null;
	activeHalfyear: number | null;
}

/**
 * Reads the links document. Every link needs a string `rel` and an absolute `href`;
 * any `rel` is kept, so a caller picks the version it supports.
 *
 * @param text - The served JSON.
 * @example
 * let links = parseLinks(body);
 * let href = links.data.links.find((link) => link.rel === NODEINFO_2_1)?.href;
 */
export function parseLinks(text: string): Result<NodeInfoLinks, WellKnownParseError> {
	let decoded = readJsonObject(text, NAME);
	if (decoded.status === "failure") return decoded;
	let body = decoded.data;
	let issues: WellKnownParseError.Issue[] = [];
	let links: NodeInfoLink[] = [];

	if (!Array.isArray(body.links)) {
		issues.push({ at: "/links", message: '"links" is not an array.' });
	} else {
		for (let [index, entry] of body.links.entries()) {
			let at = pointer("links", index);
			if (!isObject(entry)) {
				issues.push({ at, message: "A link is not an object." });
				continue;
			}
			let valid = true;
			if (typeof entry.rel !== "string") {
				issues.push({ at: `${at}/rel`, message: 'A link has no string "rel".' });
				valid = false;
			}
			if (typeof entry.href !== "string" || !URL.canParse(entry.href)) {
				issues.push({ at: `${at}/href`, message: 'A link has no absolute URL "href".' });
				valid = false;
			}
			if (valid) links.push({ rel: entry.rel as string, href: entry.href as string });
		}
	}

	if (issues.length > 0) return failure(new WellKnownParseError(NAME, issues));
	return success({ links });
}

/**
 * Writes the links document.
 *
 * @param document - The versions to advertise.
 */
export function stringifyLinks(document: NodeInfoLinks): string {
	return JSON.stringify({
		links: document.links.map((link) => ({ rel: link.rel, href: link.href })),
	});
}

/**
 * Reads a string member, pushing an issue when it is required and missing or of the
 * wrong type.
 *
 * @param body - The object holding it.
 * @param member - The member name.
 * @param at - The object's pointer.
 * @param required - Whether absence is an issue.
 * @param issues - Where problems are collected.
 */
function readString(
	body: JsonObject,
	member: string,
	at: string,
	required: boolean,
	issues: WellKnownParseError.Issue[],
): string | null {
	let value = body[member];
	if (typeof value === "string") return value;
	if (value === undefined || value === null) {
		if (required)
			issues.push({ at: `${at}${pointer(member)}`, message: `"${member}" is missing.` });
		return null;
	}
	issues.push({ at: `${at}${pointer(member)}`, message: `"${member}" is not a string.` });
	return null;
}

/**
 * Reads an optional count, which the schema requires to be a non-negative integer.
 *
 * @param body - The object holding it.
 * @param member - The member name.
 * @param at - The object's pointer.
 * @param issues - Where problems are collected.
 */
function readCount(
	body: JsonObject,
	member: string,
	at: string,
	issues: WellKnownParseError.Issue[],
): number | null {
	let value = body[member];
	if (value === undefined || value === null) return null;
	if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
	issues.push({
		at: `${at}${pointer(member)}`,
		message: `"${member}" is not a non-negative integer.`,
	});
	return null;
}

/**
 * Reads a list of names, each a non-empty string; names outside the schema's registry
 * are kept, so a crawler reads servers that speak newer protocols.
 *
 * @param value - The decoded member.
 * @param at - The member's pointer.
 * @param issues - Where problems are collected.
 */
function readNames(value: unknown, at: string, issues: WellKnownParseError.Issue[]): string[] {
	if (!Array.isArray(value)) {
		issues.push({ at, message: "The member is not an array." });
		return [];
	}
	let result: string[] = [];
	for (let [index, item] of value.entries()) {
		if (typeof item === "string" && item !== "") result.push(item);
		else issues.push({ at: `${at}/${index}`, message: "A name is not a non-empty string." });
	}
	return result;
}

/**
 * Reads `software`, whose 2.1-only `repository` and `homepage` stay `null` for a 2.0
 * document whatever it carries.
 *
 * @param value - The decoded member.
 * @param version - The document's schema version.
 * @param issues - Where problems are collected.
 */
function readSoftware(
	value: unknown,
	version: NodeInfoVersion,
	issues: WellKnownParseError.Issue[],
): NodeInfoSoftware {
	let software: NodeInfoSoftware = { name: "", version: "", repository: null, homepage: null };
	if (!isObject(value)) {
		issues.push({ at: "/software", message: '"software" is not an object.' });
		return software;
	}
	let name = readString(value, "name", "/software", true, issues);
	if (name !== null && !SOFTWARE_NAME.test(name)) {
		issues.push({
			at: "/software/name",
			message: '"name" may hold only lowercase letters, digits and hyphens.',
		});
	}
	software.name = name ?? "";
	software.version = readString(value, "version", "/software", true, issues) ?? "";
	if (version === "2.1") {
		software.repository = readString(value, "repository", "/software", false, issues);
		software.homepage = readString(value, "homepage", "/software", false, issues);
	}
	return software;
}

/**
 * Reads `usage`, which must hold a `users` object; every count is optional.
 *
 * @param value - The decoded member.
 * @param issues - Where problems are collected.
 */
function readUsage(value: unknown, issues: WellKnownParseError.Issue[]): NodeInfoUsage {
	let users: NodeInfoUsers = { total: null, activeMonth: null, activeHalfyear: null };
	if (!isObject(value)) {
		issues.push({ at: "/usage", message: '"usage" is not an object.' });
		return { users, localPosts: null, localComments: null };
	}
	if (isObject(value.users)) {
		users = {
			total: readCount(value.users, "total", "/usage/users", issues),
			activeMonth: readCount(value.users, "activeMonth", "/usage/users", issues),
			activeHalfyear: readCount(value.users, "activeHalfyear", "/usage/users", issues),
		};
	} else issues.push({ at: "/usage/users", message: '"users" is not an object.' });
	return {
		users,
		localPosts: readCount(value, "localPosts", "/usage", issues),
		localComments: readCount(value, "localComments", "/usage", issues),
	};
}

/**
 * Reads a NodeInfo 2.0 or 2.1 document, checking it against its schema: every required
 * member present, `software.name` matching the pattern, at least one protocol, every
 * protocol and service a non-empty string, and non-negative integer counts. Every issue is reported.
 *
 * @param text - The served JSON.
 */
export function parse(text: string): Result<NodeInfo, WellKnownParseError> {
	let decoded = readJsonObject(text, NAME);
	if (decoded.status === "failure") return decoded;
	let body = decoded.data;
	let issues: WellKnownParseError.Issue[] = [];

	let version: NodeInfoVersion = "2.1";
	if (body.version === "2.0" || body.version === "2.1") version = body.version;
	else issues.push({ at: "/version", message: '"version" is not "2.0" or "2.1".' });

	let software = readSoftware(body.software, version, issues);

	let protocols = readNames(body.protocols, "/protocols", issues);
	if (Array.isArray(body.protocols) && body.protocols.length === 0) {
		issues.push({ at: "/protocols", message: '"protocols" lists no protocol.' });
	}

	let services: NodeInfoServices = { inbound: [], outbound: [] };
	if (isObject(body.services)) {
		services = {
			inbound: readNames(body.services.inbound, "/services/inbound", issues),
			outbound: readNames(body.services.outbound, "/services/outbound", issues),
		};
	} else issues.push({ at: "/services", message: '"services" is not an object.' });

	let openRegistrations = false;
	if (typeof body.openRegistrations === "boolean") openRegistrations = body.openRegistrations;
	else issues.push({ at: "/openRegistrations", message: '"openRegistrations" is not a boolean.' });

	let usage = readUsage(body.usage, issues);

	let metadata: JsonObject = {};
	if (isObject(body.metadata)) metadata = body.metadata;
	else issues.push({ at: "/metadata", message: '"metadata" is not an object.' });

	if (issues.length > 0) return failure(new WellKnownParseError(NAME, issues));
	return success({
		version,
		software,
		protocols,
		services,
		openRegistrations,
		usage,
		metadata,
	});
}

/**
 * Writes the document as NodeInfo 2.1 whatever version it was read as, which upgrades a
 * 2.0 document since 2.1 only adds members. `null` members are left out.
 *
 * @param document - The document to publish.
 */
export function stringify(document: NodeInfo): string {
	let software: JsonObject = {
		name: document.software.name,
		version: document.software.version,
	};
	if (document.software.repository !== null) software.repository = document.software.repository;
	if (document.software.homepage !== null) software.homepage = document.software.homepage;

	let users: JsonObject = {};
	let { total, activeMonth, activeHalfyear } = document.usage.users;
	if (total !== null) users.total = total;
	if (activeHalfyear !== null) users.activeHalfyear = activeHalfyear;
	if (activeMonth !== null) users.activeMonth = activeMonth;

	let usage: JsonObject = { users };
	if (document.usage.localPosts !== null) usage.localPosts = document.usage.localPosts;
	if (document.usage.localComments !== null) usage.localComments = document.usage.localComments;

	return JSON.stringify({
		version: "2.1",
		software,
		protocols: document.protocols,
		services: { inbound: document.services.inbound, outbound: document.services.outbound },
		openRegistrations: document.openRegistrations,
		usage,
		metadata: document.metadata,
	});
}

/**
 * The `/.well-known/nodeinfo` links document as a servable format; every answer carries
 * CORS `*` so a browser-based client reads it from any origin.
 */
export const nodeInfoLinks: WellKnownFormat<NodeInfoLinks> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "insert",
	cors: true,
	stringify: stringifyLinks,
	parse: parseLinks,
};

/**
 * The NodeInfo document as a servable format, answered at the path the links document
 * names (such as `/nodeinfo/2.1`) with the 2.1 profile in its media type.
 */
export const nodeInfo: WellKnownFormat<NodeInfo> = {
	name: NAME,
	mediaType: DOCUMENT_MEDIA_TYPE,
	placement: "insert",
	cors: true,
	stringify,
	parse,
};
