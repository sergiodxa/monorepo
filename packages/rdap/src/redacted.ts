/**
 * Reads the RFC 9537 `redacted` member of a response and resolves each entry onto the
 * model field it hides, so a caller can tell a field the registry withheld from one the
 * registration never had.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type { RDAP } from "./rdap.js";

/** The methods RFC 9537 defines; `removal` is the one an entry without `method` used. */
const METHODS = new Set<string>(["removal", "emptyValue", "partialValue", "replacementValue"]);

/** A `name` or `reason` object: a registered value in `type`, free text in `description`. */
const LABEL_SCHEMA = s.object({
	type: s.optional(s.string()),
	description: s.optional(s.string()),
});

/** One `redacted` entry; an entry failing it is skipped rather than failing the lookup. */
const REDACTION_SCHEMA = s.object({
	name: LABEL_SCHEMA,
	prePath: s.optional(s.string()),
	postPath: s.optional(s.string()),
	replacementPath: s.optional(s.string()),
	pathLang: s.optional(s.string()),
	method: s.optional(s.string()),
	reason: s.optional(LABEL_SCHEMA),
});

/** The words a redacted name uses for each contact role, in the ICANN profile and RFC 9537's examples. */
const ROLE_WORDS: Record<string, string> = {
	registrant: "registrant",
	tech: "technical",
	technical: "technical",
	admin: "administrative",
	administrative: "administrative",
	billing: "billing",
	registrar: "registrar",
	abuse: "abuse",
	reseller: "reseller",
	sponsor: "sponsor",
	proxy: "proxy",
	notifications: "notifications",
	noc: "noc",
};

/** The words a redacted name uses for each contact property, longest first so `Postal Code` wins over `Code`. */
const PROPERTY_WORDS: Array<[string, RDAP.ContactField]> = [
	["organization", "organization"],
	["postal code", "address"],
	["phone ext", "phone"],
	["fax ext", "fax"],
	["contact uri", "contactUri"],
	["street", "address"],
	["city", "address"],
	["country", "address"],
	["province", "address"],
	["state", "address"],
	["address", "address"],
	["contact", "contact"],
	["email", "email"],
	["phone", "phone"],
	["name", "name"],
	["fax", "fax"],
	["id", "handle"],
];

/** The contact field each jCard property (RFC 7095) holds. */
const JCARD_PROPERTIES: Record<string, RDAP.ContactField> = {
	fn: "name",
	n: "name",
	org: "organization",
	email: "email",
	tel: "phone",
	adr: "address",
	"contact-uri": "contactUri",
};

/** The contact field each JSContact `Card` member holds in the RDAP profile. */
const CARD_MEMBERS: Record<string, RDAP.ContactField> = {
	name: "name",
	organizations: "organization",
	emails: "email",
	phones: "phone",
	addresses: "address",
};

/** The role an entity filter selects, as `@.roles[0]=='registrant'`. */
const ROLE_FILTER = /roles(?:\[[^\]]*\])?==['"]([^'"]+)['"]/g;

/**
 * Validates the `redacted` member and resolves each entry's field. A member that is not
 * an array reads as no redactions, and an entry without a name is skipped.
 *
 * @param member - The response's `redacted` value, as sent.
 * @returns The redactions, in the order the response lists them.
 */
export function redactions(member: unknown): RDAP.Redaction[] {
	if (!Array.isArray(member)) return [];

	return member.flatMap((entry: unknown) => {
		let parsed = s.parseSafe(REDACTION_SCHEMA, entry);
		if (!parsed.success) return [];

		let value = parsed.value;
		let name = value.name.type ?? value.name.description;
		if (name === undefined || name.trim() === "") return [];

		let method =
			value.method !== undefined && METHODS.has(value.method)
				? (value.method as RDAP.RedactionMethod)
				: "removal";
		let path = value.postPath ?? value.prePath ?? null;

		return [
			{
				name: name.trim(),
				registered: value.name.type !== undefined,
				field: fieldOfPath(path) ?? fieldOfName(name),
				method,
				prePath: value.prePath ?? null,
				postPath: value.postPath ?? null,
				replacementPath: value.replacementPath ?? null,
				pathLang: value.pathLang ?? "jsonpath",
				reason: value.reason?.type ?? value.reason?.description ?? null,
			},
		];
	});
}

/**
 * Whether the registry withheld a field. A redaction of a whole contact covers each of
 * its fields, so `registrant.email` is redacted when the registrant entity was removed.
 *
 * @param domain - A looked-up domain.
 * @param field - `handle`, or a contact role and field such as `registrant.email`.
 * @returns `true` when one of the response's redactions resolves onto the field.
 * @example if (isRedacted(domain, "registrant.name")) show("Hidden by the registry");
 */
export function isRedacted(domain: Pick<RDAP.Domain, "redacted">, field: RDAP.Field): boolean {
	let role = field.includes(".") ? field.slice(0, field.indexOf(".")) : null;
	return domain.redacted.some(
		(redaction) =>
			redaction.field === field || (role !== null && redaction.field === `${role}.contact`),
	);
}

/**
 * Resolves a JSONPath onto a field from the shapes RFC 9537 and the RDAP JSContact
 * profile write: `$.handle`, an entity filter by role, and a jCard property filter or
 * `jscontact_card` member below it. The last role filter names the contact, so the
 * registrar's nested abuse entity reads as `abuse`.
 */
function fieldOfPath(path: string | null): RDAP.Field | null {
	if (path === null) return null;
	let compact = path.replace(/\s+/g, "");
	if (/^\$\.handle$/.test(compact)) return "handle";

	let roles = [...compact.matchAll(ROLE_FILTER)].map((match) => match[1] ?? "");
	let role = roles.at(-1)?.toLowerCase();
	if (role === undefined || role === "") return null;

	let tail = compact.slice(compact.lastIndexOf("roles"));
	let property = cardField(tail);
	if (property !== null) return `${role}.${property}`;
	if (tail.endsWith("].handle")) return `${role}.handle`;
	return tail.endsWith(")]") ? `${role}.contact` : null;
}

/**
 * The contact field a path below an entity reaches: a jCard property filter on
 * `vcardArray`, or the `jscontact_card` member after any `localizations` entry. A path
 * that stops at the card itself is the whole contact.
 */
function cardField(tail: string): RDAP.ContactField | null {
	let jCard = /vcardArray\[1\](.*)$/.exec(tail);
	if (jCard) {
		let rest = jCard[1] ?? "";
		if (/type==['"]fax['"]/.test(rest)) return "fax";
		if (/type==['"]voice['"]/.test(rest)) return "phone";
		let name = /@\[0\]==['"]([^'"]+)['"]/.exec(rest)?.[1];
		return name ? (JCARD_PROPERTIES[name.toLowerCase()] ?? null) : null;
	}

	let card = /jscontact_card(.*)$/.exec(tail);
	if (!card) return null;
	let rest = (card[1] ?? "").replace(/^\.localizations(?:\.[^.[]+|\[[^\]]*\])/, "");
	if (rest === "") return "contact";

	let member = /^(?:\.([\w-]+)|\[['"]([^'"]+)['"]\])/.exec(rest);
	let name = member?.[1] ?? member?.[2];
	if (name === "links") return /contact-uri/.test(rest) ? "contactUri" : null;
	if (name === "phones" && /fax/.test(rest)) return "fax";
	return name ? (CARD_MEMBERS[name] ?? null) : null;
}

/**
 * Resolves a redacted name onto a field for an entry whose path is absent or in a shape
 * {@link fieldOfPath} does not read: `Registry Domain ID` is the handle, and
 * `<Role> <Property>` (`Tech Email`, `Registrant Postal Code`) names a contact field.
 */
function fieldOfName(name: string): RDAP.Field | null {
	let words = name.trim().toLowerCase().replace(/\s+/g, " ");
	if (words === "registry domain id") return "handle";

	let registryId = /^registry (\w+) id$/.exec(words);
	if (registryId) {
		let role = ROLE_WORDS[registryId[1] ?? ""];
		return role ? `${role}.handle` : null;
	}

	let space = words.indexOf(" ");
	if (space === -1) return null;
	let role = ROLE_WORDS[words.slice(0, space)];
	let rest = words.slice(space + 1);
	let property = PROPERTY_WORDS.find(([word]) => rest === word || rest.startsWith(`${word} `));
	return role && property ? `${role}.${property[1]}` : null;
}
