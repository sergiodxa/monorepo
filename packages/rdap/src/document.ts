/**
 * Validates the part of an RFC 9083 domain response the model reads and builds the
 * camelCase `RDAP.Domain` from it: dates, statuses, contacts and registrar from their jCard
 * or JSContact cards, nameservers, DNSSEC, the `related` link and RFC 9537 redactions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { RDAP } from "./rdap.js";

import { contacts, toContact } from "./contact.js";
import { RDAPError } from "./error.js";
import { redactions } from "./redacted.js";
import { eppStatus } from "./status.js";

/** The `type` of the public id that carries a registrar's IANA number. */
const IANA_REGISTRAR_ID = "iana registrar id";

/** The media type a `related` link names when it points at another RDAP server. */
const RDAP_MEDIA_TYPE = "application/rdap+json";

/** A public id, such as the `IANA Registrar ID` a registrar entity carries. */
const PUBLIC_ID_SCHEMA = s.object({ type: s.string(), identifier: s.string() });

/** The members of a domain response the model reads; everything else passes unvalidated. */
const DOMAIN_SCHEMA = s.object({
	objectClassName: s.string(),
	ldhName: s.optional(s.string()),
	unicodeName: s.optional(s.string()),
	handle: s.optional(s.string()),
	status: s.optional(s.array(s.string())),
	events: s.optional(
		s.array(s.object({ eventAction: s.string(), eventDate: s.optional(s.string()) })),
	),
	entities: s.optional(
		s.array(s.record(s.string(), s.any()) as s.Schema<unknown, Record<string, unknown>>),
	),
	nameservers: s.optional(s.array(s.object({ ldhName: s.optional(s.string()) }))),
	secureDNS: s.optional(s.object({ delegationSigned: s.optional(s.boolean()) })),
	links: s.optional(
		s.array(
			s.object({ rel: s.optional(s.string()), href: s.string(), type: s.optional(s.string()) }),
		),
	),
	redacted: s.optional(s.any()),
});

/** A validated domain response. */
type DomainDocument = s.InferOutput<typeof DOMAIN_SCHEMA>;

/**
 * Builds the model from a parsed response. A body that fails the schema, or that
 * describes anything but a domain, is `invalid-response`.
 *
 * @param json - The parsed body.
 * @param url - The URL that answered, after redirects.
 * @param queried - The A-label name that was asked, used when the response omits `ldhName`.
 * @returns The domain, or why the body is not one.
 */
export function toDomain(
	json: unknown,
	url: string,
	queried: string,
): Result<RDAP.Domain, RDAPError> {
	let parsed = s.parseSafe(DOMAIN_SCHEMA, json);
	if (!parsed.success || parsed.value.objectClassName !== "domain") {
		return failure(
			new RDAPError("invalid-response", `${url} answered something other than a domain`, {
				url,
			}),
		);
	}

	let document = parsed.value;
	let dates = eventDates(document);

	return success({
		name: hostName(document.ldhName ?? queried),
		unicodeName: document.unicodeName ? hostName(document.unicodeName) : null,
		handle: document.handle ?? null,
		expiresAt: dates.get("expiration") ?? null,
		registeredAt: dates.get("registration") ?? null,
		updatedAt: dates.get("last changed") ?? null,
		status: (document.status ?? []).map(eppStatus),
		registrar: registrar(document),
		contacts: contacts(document.entities),
		nameservers: (document.nameservers ?? []).flatMap((nameserver) =>
			nameserver.ldhName ? [hostName(nameserver.ldhName)] : [],
		),
		dnssec: document.secureDNS?.delegationSigned ?? null,
		relatedUrl: relatedUrl(document),
		redacted: redactions(document.redacted),
		server: url,
		document: json,
	});
}

/** Lowercases a host name and drops its trailing dot, the form every name in the model takes. */
function hostName(name: string): string {
	let lower = name.toLowerCase();
	return lower.endsWith(".") ? lower.slice(0, -1) : lower;
}

/**
 * The latest parseable date of each event action, in epoch milliseconds. A registry
 * that repeats an action keeps its history in `document`; a date that does not parse
 * is skipped.
 */
function eventDates(document: DomainDocument): Map<string, number> {
	let dates = new Map<string, number>();
	for (let event of document.events ?? []) {
		if (event.eventDate === undefined) continue;
		let time = Date.parse(event.eventDate);
		if (Number.isNaN(time)) continue;

		let action = event.eventAction.toLowerCase();
		let seen = dates.get(action);
		if (seen === undefined || time > seen) dates.set(action, time);
	}
	return dates;
}

/** A validated entity, which keeps every member it was sent. */
type Entity = Record<string, unknown>;

/**
 * The registrar entity's name, IANA id and abuse email, or `null` when the response names
 * none. The name is the card's full name, or its organization when the name is empty.
 */
function registrar(document: DomainDocument): RDAP.Registrar | null {
	let entity = document.entities?.find((candidate) => hasRole(candidate, "registrar"));
	if (entity === undefined) return null;

	let contact = toContact(entity);
	let nested = Array.isArray(entity.entities) ? (entity.entities as unknown[]) : [];
	let abuse = nested.find(
		(candidate): candidate is Entity =>
			typeof candidate === "object" && candidate !== null && hasRole(candidate as Entity, "abuse"),
	);
	let ids: unknown[] = Array.isArray(entity.publicIds) ? entity.publicIds : [];
	let ianaId = ids.find((id) => {
		let parsed = s.parseSafe(PUBLIC_ID_SCHEMA, id);
		return parsed.success && parsed.value.type.toLowerCase() === IANA_REGISTRAR_ID;
	}) as { identifier: string } | undefined;

	return {
		name: contact.name ?? contact.organization,
		ianaId: ianaId?.identifier || null,
		abuseEmail: abuse ? (toContact(abuse).emails[0] ?? null) : null,
	};
}

/** Whether an entity plays a role, compared case-insensitively since registries vary the spelling. */
function hasRole(entity: Entity, role: string): boolean {
	return (
		Array.isArray(entity.roles) &&
		entity.roles.some(
			(candidate) => typeof candidate === "string" && candidate.toLowerCase() === role,
		)
	);
}

/** The `related` link that points at another RDAP server, which on a thin registry is the registrar's. */
function relatedUrl(document: DomainDocument): string | null {
	let link = document.links?.find(
		(candidate) =>
			candidate.rel?.toLowerCase() === "related" &&
			candidate.type?.toLowerCase() === RDAP_MEDIA_TYPE &&
			URL.canParse(candidate.href),
	);
	return link?.href ?? null;
}
