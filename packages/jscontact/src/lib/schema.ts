/**
 * The `remix/data-schema` schemas of every JSContact object. Each keeps the properties it
 * does not name, so unknown and vendor properties survive a read and write, and checks the
 * value formats and the cross-property rules RFC 9553 states as MUST.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "remix/data-schema";

import type { JSContact } from "../types.js";

import { isId, isUTCDateTime } from "./values.js";

/** The versions the JSContact Version registry holds; `1.0` still requires `uid`. */
const VERSIONS = new Set(["1.0", "2.0"]);

/** The name component kinds RFC 9553 registers. */
const NAME_KINDS = [
	"title",
	"given",
	"given2",
	"surname",
	"surname2",
	"credential",
	"generation",
	"separator",
];

/** The address component kinds RFC 9553 registers. */
const ADDRESS_KINDS = [
	"room",
	"apartment",
	"floor",
	"building",
	"number",
	"name",
	"block",
	"subdistrict",
	"district",
	"locality",
	"region",
	"postcode",
	"country",
	"direction",
	"landmark",
	"postOfficeBox",
	"separator",
];

/**
 * Whether a value differs only in case from a registered one, which RFC 9553 makes invalid
 * whatever version the Card names.
 */
function caseVariant(value: string, known: readonly string[]): boolean {
	let lower = value.toLowerCase();
	return known.some((candidate) => candidate !== value && candidate.toLowerCase() === lower);
}

/**
 * An object schema that keeps unknown properties and rejects one whose name differs only in
 * case from a property the object defines, such as `Name` beside `name`.
 *
 * @param shape - The properties the object names
 * @returns The schema
 */
function open<shape extends Record<string, s.Schema<any, any>>>(shape: shape) {
	let known = Object.keys(shape);
	return s
		.object(shape, { unknownKeys: "passthrough" })
		.refine(
			(value) => Object.keys(value as object).every((key) => !caseVariant(key, known)),
			"Property names are case-sensitive",
		);
}

/** An optional `@type`, which a nested object may leave out when its place implies it. */
function typeTag<const name extends string>(name: name) {
	return s.optional(s.literal(name));
}

/**
 * An enumerated string: any registered value, or an unregistered one such as a vendor value,
 * but never a case variant of a registered one.
 */
function enumerated(known: readonly string[]) {
	return s
		.string()
		.refine((value) => !caseVariant(value, known), "Enumerated values are case-sensitive");
}

/** A non-negative integer within JSON's safe range. */
function unsignedInt() {
	return s
		.number()
		.refine((value) => Number.isSafeInteger(value) && value >= 0, "Expected an UnsignedInt");
}

/** A positive integer, the range of `listAs`. */
function position() {
	return unsignedInt().refine((value) => value > 0, "Expected a value above zero");
}

/** A preference from 1, most preferred, to 100. */
function pref() {
	return unsignedInt().refine((value) => value >= 1 && value <= 100, "Expected 1 to 100");
}

/** A string in the Id alphabet. */
function id() {
	return s.string().refine(isId, "Expected an Id: 1 to 255 characters of A-Za-z0-9, - and _");
}

/** A UTCDateTime such as `2022-09-30T14:35:10Z`. */
function utcDateTime() {
	return s.string().refine(isUTCDateTime, "Expected a UTCDateTime such as 2022-09-30T14:35:10Z");
}

/**
 * A set of strings, written as a map of each to `true`.
 *
 * @param known - Registered keys, whose case variants are rejected
 */
function trueMap(known: readonly string[] = []) {
	return s
		.record(s.string(), s.literal(true as const))
		.refine(
			(value) => Object.keys(value).every((key) => !caseVariant(key, known)),
			"Enumerated values are case-sensitive",
		);
}

/** A map of Ids to objects. */
function idMap<output>(value: s.Schema<unknown, output>) {
	return s.record(id(), value);
}

/** The contexts RFC 9553 registers for every object, plus an Address's own. */
const CONTEXTS = ["private", "work", "billing", "delivery"];

/** The properties that order components: an ordered list may hold separators, an unordered one none. */
interface Ordered {
	components?: Array<{ kind: string }>;
	isOrdered?: boolean;
	defaultSeparator?: string;
}

/** Whether a Name or Address obeys the ordering rules: separators and `defaultSeparator` need `isOrdered`. */
function orderedRules(value: Ordered): boolean {
	let components = value.components;
	if (components !== undefined && !components.some((component) => component.kind !== "separator")) {
		return false;
	}
	if (value.isOrdered === true)
		return value.defaultSeparator === undefined || components !== undefined;
	let separators = components?.some((component) => component.kind === "separator") ?? false;
	return !separators && value.defaultSeparator === undefined;
}

/** A NameComponent. */
const NAME_COMPONENT_SCHEMA = open({
	"@type": typeTag("NameComponent"),
	value: s.string(),
	kind: enumerated(NAME_KINDS),
	phonetic: s.optional(s.string()),
});

/** A Name, with the component, ordering and `sortAs` rules of RFC 9553 §2.2.1.1. */
const NAME_SCHEMA: s.Schema<unknown, JSContact.Name> = open({
	"@type": typeTag("Name"),
	components: s.optional(s.array(NAME_COMPONENT_SCHEMA)),
	isOrdered: s.optional(s.boolean()),
	defaultSeparator: s.optional(s.string()),
	full: s.optional(s.string()),
	sortAs: s.optional(s.record(s.string(), s.string())),
	phoneticScript: s.optional(s.string()),
	phoneticSystem: s.optional(enumerated(["ipa", "jyut", "piny"])),
})
	.refine(
		(name) => name.components !== undefined || name.full !== undefined,
		"A Name needs components or full",
	)
	.refine(orderedRules, "Separators and defaultSeparator need isOrdered and components")
	.refine((name) => {
		if (name.sortAs === undefined) return true;
		let kinds = new Set(name.components?.map((component) => component.kind) ?? []);
		return Object.keys(name.sortAs).every((kind) => kinds.has(kind));
	}, "Each sortAs key needs a component of that kind")
	.refine(
		(name) =>
			!name.components?.some((component) => component.phonetic !== undefined) ||
			name.phoneticScript !== undefined ||
			name.phoneticSystem !== undefined,
		"A phonetic value needs phoneticScript or phoneticSystem",
	);

/** A Nickname. */
const NICKNAME_SCHEMA = open({
	"@type": typeTag("Nickname"),
	name: s.string(),
	contexts: s.optional(trueMap(CONTEXTS)),
	pref: s.optional(pref()),
});

/** An Organization, which needs a name or units. */
const ORGANIZATION_SCHEMA = open({
	"@type": typeTag("Organization"),
	name: s.optional(s.string()),
	units: s.optional(
		s.array(
			open({ "@type": typeTag("OrgUnit"), name: s.string(), sortAs: s.optional(s.string()) }),
		),
	),
	sortAs: s.optional(s.string()),
	contexts: s.optional(trueMap(CONTEXTS)),
}).refine(
	(organization) =>
		organization.name !== undefined ||
		(organization.units !== undefined && organization.units.length > 0),
	"An Organization needs a name or units",
);

/** A SpeakToAs, which needs a grammatical gender or pronouns. */
const SPEAK_TO_AS_SCHEMA = open({
	"@type": typeTag("SpeakToAs"),
	grammaticalGender: s.optional(
		enumerated(["animate", "common", "feminine", "inanimate", "masculine", "neuter"]),
	),
	pronouns: s.optional(
		idMap(
			open({
				"@type": typeTag("Pronouns"),
				pronouns: s.string(),
				contexts: s.optional(trueMap(CONTEXTS)),
				pref: s.optional(pref()),
			}),
		),
	),
}).refine(
	(value) => value.grammaticalGender !== undefined || value.pronouns !== undefined,
	"A SpeakToAs needs grammaticalGender or pronouns",
);

/** A Title. */
const TITLE_SCHEMA = open({
	"@type": typeTag("Title"),
	name: s.string(),
	kind: s.optional(enumerated(["title", "role"])),
	organizationId: s.optional(id()),
});

/** An EmailAddress. */
const EMAIL_SCHEMA = open({
	"@type": typeTag("EmailAddress"),
	address: s.string(),
	contexts: s.optional(trueMap(CONTEXTS)),
	pref: s.optional(pref()),
	label: s.optional(s.string()),
});

/** An OnlineService, which needs a URI or a user name. */
const ONLINE_SERVICE_SCHEMA = open({
	"@type": typeTag("OnlineService"),
	service: s.optional(s.string()),
	uri: s.optional(s.string()),
	user: s.optional(s.string()),
	contexts: s.optional(trueMap(CONTEXTS)),
	pref: s.optional(pref()),
	label: s.optional(s.string()),
}).refine(
	(value) => value.uri !== undefined || value.user !== undefined,
	"An OnlineService needs uri or user",
);

/** A Phone. */
const PHONE_SCHEMA = open({
	"@type": typeTag("Phone"),
	number: s.string(),
	features: s.optional(
		trueMap(["mobile", "voice", "text", "video", "main-number", "textphone", "fax", "pager"]),
	),
	contexts: s.optional(trueMap(CONTEXTS)),
	pref: s.optional(pref()),
	label: s.optional(s.string()),
});

/** A LanguagePref. */
const LANGUAGE_PREF_SCHEMA = open({
	"@type": typeTag("LanguagePref"),
	language: s.string(),
	contexts: s.optional(trueMap(CONTEXTS)),
	pref: s.optional(pref()),
});

/**
 * A Resource subtype: the shared `uri`, `mediaType`, `contexts`, `pref` and `label`, with
 * the type's own `kind` and any extra properties.
 */
function resource<
	const name extends string,
	kind extends s.Schema<any, any>,
	extra extends Record<string, s.Schema<any, any>>,
>(name: name, kind: kind, extra: extra) {
	return open({
		"@type": typeTag(name),
		kind,
		uri: s.string(),
		mediaType: s.optional(s.string()),
		contexts: s.optional(trueMap(CONTEXTS)),
		pref: s.optional(pref()),
		label: s.optional(s.string()),
		...extra,
	});
}

/** A SchedulingAddress. */
const SCHEDULING_ADDRESS_SCHEMA = open({
	"@type": typeTag("SchedulingAddress"),
	uri: s.string(),
	contexts: s.optional(trueMap(CONTEXTS)),
	pref: s.optional(pref()),
	label: s.optional(s.string()),
});

/** An Address, with the presence and ordering rules of RFC 9553 §2.5.1.1. */
const ADDRESS_SCHEMA: s.Schema<unknown, JSContact.Address> = open({
	"@type": typeTag("Address"),
	components: s.optional(
		s.array(
			open({
				"@type": typeTag("AddressComponent"),
				value: s.string(),
				kind: enumerated(ADDRESS_KINDS),
				phonetic: s.optional(s.string()),
			}),
		),
	),
	isOrdered: s.optional(s.boolean()),
	countryCode: s.optional(s.string()),
	coordinates: s.optional(s.string()),
	timeZone: s.optional(s.string()),
	contexts: s.optional(trueMap(CONTEXTS)),
	full: s.optional(s.string()),
	defaultSeparator: s.optional(s.string()),
	pref: s.optional(pref()),
	phoneticScript: s.optional(s.string()),
	phoneticSystem: s.optional(enumerated(["ipa", "jyut", "piny"])),
})
	.refine(
		(address) =>
			address.components !== undefined ||
			address.coordinates !== undefined ||
			address.countryCode !== undefined ||
			address.full !== undefined ||
			address.timeZone !== undefined,
		"An Address needs components, coordinates, countryCode, full or timeZone",
	)
	.refine(orderedRules, "Separators and defaultSeparator need isOrdered and components");

/** A PartialDate, whose month needs a year or day and whose day needs a month. */
const PARTIAL_DATE_SCHEMA = open({
	"@type": typeTag("PartialDate"),
	year: s.optional(unsignedInt()),
	month: s.optional(unsignedInt().refine((value) => value >= 1 && value <= 12, "Expected 1 to 12")),
	day: s.optional(unsignedInt().refine((value) => value >= 1 && value <= 31, "Expected 1 to 31")),
	calendarScale: s.optional(s.string()),
}).refine(
	(date) =>
		(date.month === undefined || date.year !== undefined || date.day !== undefined) &&
		(date.day === undefined || date.month !== undefined),
	"A month needs a year or day, and a day needs a month",
);

/** A Timestamp, which always names its `@type`. */
const TIMESTAMP_SCHEMA = open({ "@type": s.literal("Timestamp"), utc: utcDateTime() });

/** An Anniversary, whose date is a PartialDate unless it says it is a Timestamp. */
const ANNIVERSARY_SCHEMA = open({
	"@type": typeTag("Anniversary"),
	kind: enumerated(["birth", "death", "wedding"]),
	date: s.union([TIMESTAMP_SCHEMA, PARTIAL_DATE_SCHEMA]),
	place: s.optional(ADDRESS_SCHEMA),
});

/** A Note, whose author needs a name or URI. */
const NOTE_SCHEMA = open({
	"@type": typeTag("Note"),
	note: s.string(),
	created: s.optional(utcDateTime()),
	author: s.optional(
		open({
			"@type": typeTag("Author"),
			name: s.optional(s.string()),
			uri: s.optional(s.string()),
		}).refine(
			(author) => author.name !== undefined || author.uri !== undefined,
			"An Author needs a name or uri",
		),
	),
});

/** A PersonalInfo. */
const PERSONAL_INFO_SCHEMA = open({
	"@type": typeTag("PersonalInfo"),
	kind: enumerated(["expertise", "hobby", "interest"]),
	value: s.string(),
	level: s.optional(enumerated(["high", "medium", "low"])),
	listAs: s.optional(position()),
	label: s.optional(s.string()),
});

/** A jCard property kept by a vCard conversion: name, parameters, type, values. */
const JCARD_PROPERTY_SCHEMA = s
	.any()
	.refine(
		(value) =>
			Array.isArray(value) &&
			value.length >= 4 &&
			typeof value[0] === "string" &&
			typeof value[1] === "object" &&
			value[1] !== null &&
			!Array.isArray(value[1]) &&
			typeof value[2] === "string",
		"Expected a jCard property",
	);

/**
 * A JSContact Card, validated as RFC 9553 and RFC 9982 require: version 1.0 still needs
 * `uid`, `members` needs a `group` kind, and no localization patches `localizations`.
 */
export const CARD_SCHEMA: s.Schema<unknown, JSContact.Card> = open({
	"@type": s.literal("Card"),
	version: s
		.string()
		.refine((value) => VERSIONS.has(value), "Expected a registered version: 1.0 or 2.0"),
	created: s.optional(utcDateTime()),
	kind: s.optional(enumerated(["individual", "group", "org", "location", "device", "application"])),
	language: s.optional(s.string()),
	members: s.optional(trueMap()),
	prodId: s.optional(s.string().refine((value) => value.length > 0, "Expected a non-empty prodId")),
	relatedTo: s.optional(
		s.record(s.string(), open({ "@type": typeTag("Relation"), relation: s.optional(trueMap()) })),
	),
	uid: s.optional(s.string()),
	updated: s.optional(utcDateTime()),
	name: s.optional(NAME_SCHEMA),
	nicknames: s.optional(idMap(NICKNAME_SCHEMA)),
	organizations: s.optional(idMap(ORGANIZATION_SCHEMA)),
	speakToAs: s.optional(SPEAK_TO_AS_SCHEMA),
	titles: s.optional(idMap(TITLE_SCHEMA)),
	emails: s.optional(idMap(EMAIL_SCHEMA)),
	onlineServices: s.optional(idMap(ONLINE_SERVICE_SCHEMA)),
	phones: s.optional(idMap(PHONE_SCHEMA)),
	preferredLanguages: s.optional(idMap(LANGUAGE_PREF_SCHEMA)),
	calendars: s.optional(idMap(resource("Calendar", enumerated(["calendar", "freeBusy"]), {}))),
	schedulingAddresses: s.optional(idMap(SCHEDULING_ADDRESS_SCHEMA)),
	addresses: s.optional(idMap(ADDRESS_SCHEMA)),
	cryptoKeys: s.optional(idMap(resource("CryptoKey", s.optional(s.string()), {}))),
	directories: s.optional(
		idMap(
			resource("Directory", enumerated(["directory", "entry"]), { listAs: s.optional(position()) }),
		),
	),
	links: s.optional(idMap(resource("Link", s.optional(enumerated(["contact"])), {}))),
	media: s.optional(idMap(resource("Media", enumerated(["photo", "sound", "logo"]), {}))),
	localizations: s.optional(
		s
			.record(s.string(), s.record(s.string(), s.any()))
			.refine(
				(value) =>
					Object.values(value).every((patch) =>
						Object.keys(patch).every(
							(key) => key !== "localizations" && !key.startsWith("localizations/"),
						),
					),
				"A localization must not patch localizations",
			),
	),
	anniversaries: s.optional(idMap(ANNIVERSARY_SCHEMA)),
	keywords: s.optional(trueMap()),
	notes: s.optional(idMap(NOTE_SCHEMA)),
	personalInfo: s.optional(idMap(PERSONAL_INFO_SCHEMA)),
	vCardProps: s.optional(s.array(JCARD_PROPERTY_SCHEMA)),
})
	.refine(
		(card) => card.version !== "1.0" || card.uid !== undefined,
		"A version 1.0 Card needs a uid",
	)
	.refine(
		(card) => card.members === undefined || card.kind === "group",
		"Only a group Card has members",
	) as s.Schema<unknown, JSContact.Card>;
