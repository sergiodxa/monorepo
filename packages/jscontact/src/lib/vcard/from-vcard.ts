/**
 * Converts a vCard to a JSContact Card following RFC 9555 §2, with RFC 9982's rule that a
 * card without UID gets no generated `uid`. Language alternatives become `localizations`,
 * JSPROP properties patch the result, and anything else is kept in `vCardProps`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isSuccess } from "@sdxc/result";

import type { JSContact } from "../../types.js";

import { diff } from "../diff.js";
import { applyPatch } from "../patch.js";
import { canonicalLanguage, isId } from "../values.js";

import type { JCardProperty, VCard, VCardProperty, VCardValue } from "./model.js";

import { parameter, parameterValues } from "./model.js";
import { splitEscaped, toExtended, unescapeText } from "./text.js";

/** The NameComponent kind of each N component, by position. */
const N_KINDS = ["surname", "given", "given2", "title", "credential", "surname2", "generation"];

/**
 * The AddressComponent kind of each ADR component, by position: the seven of RFC 6350, then
 * the eleven RFC 9554 adds after the country.
 */
const ADR_KINDS = [
	"postOfficeBox",
	"apartment",
	"name",
	"locality",
	"region",
	"postcode",
	"country",
	"room",
	"apartment",
	"floor",
	"number",
	"name",
	"building",
	"block",
	"subdistrict",
	"district",
	"landmark",
	"direction",
];

/** The Phone feature each TEL-specific TYPE value converts to. */
const TEL_FEATURES: Record<string, string> = {
	cell: "mobile",
	fax: "fax",
	"main-number": "main-number",
	pager: "pager",
	text: "text",
	textphone: "textphone",
	video: "video",
	voice: "voice",
};

/** The JSContact level of each EXPERTISE LEVEL value; the others convert lowercased. */
const EXPERTISE_LEVELS: Record<string, string> = {
	beginner: "low",
	average: "medium",
	expert: "high",
};

/** Properties whose language alternatives (ALTID and LANGUAGE) become localizations. */
const LOCALIZABLE = new Set(["fn", "n", "org", "title", "role", "note", "nickname", "adr"]);

/** Properties converted after the rest, since they attach to an ADR or ORG wherever it appears. */
const SECOND_PASS = new Set(["geo", "tz", "title", "role"]);

/** The object types that carry a `label`, which an X-ABLabel in the same group sets. */
const LABELED = new Set([
	"emails",
	"onlineServices",
	"phones",
	"calendars",
	"schedulingAddresses",
	"cryptoKeys",
	"directories",
	"links",
	"media",
	"personalInfo",
]);

/** A converted object without the members its vCard property left unset. */
function compact<T extends Record<string, unknown>>(object: T): T {
	let result: Record<string, unknown> = {};
	for (let [key, value] of Object.entries(object)) if (value !== undefined) result[key] = value;
	return result as T;
}

/** The text of a property's first value, or of every component joined when it is structured. */
function textOf(property: VCardProperty): string {
	let [value] = property.values;
	if (Array.isArray(value)) return value.flat().join(",");
	return value === undefined || value === null ? "" : String(value);
}

/** The components of a structured value, each a list of its non-empty values. */
function columns(value: VCardValue | undefined, size: number): string[][] {
	let parts = Array.isArray(value) ? value : [value ?? ""];
	let result: string[][] = [];
	for (let index = 0; index < Math.max(size, parts.length); index++) {
		let part = parts[index];
		let values = Array.isArray(part) ? part : [part ?? ""];
		result.push(
			values.map((item) => (item === null ? "" : String(item))).filter((item) => item !== ""),
		);
	}
	return result;
}

/** `PREF` as an integer from 1 to 100, or `undefined`. */
function prefOf(property: VCardProperty): number | undefined {
	let value = Number(parameter(property, "pref"));
	return Number.isInteger(value) && value >= 1 && value <= 100 ? value : undefined;
}

/** A positive integer parameter such as `INDEX`, or `undefined`. */
function positionOf(property: VCardProperty, name: string): number | undefined {
	let value = Number(parameter(property, name));
	return Number.isInteger(value) && value > 0 ? value : undefined;
}

/** The lowercase `TYPE` values of a property. */
function typesOf(property: VCardProperty): string[] {
	return parameterValues(property, "type").map((value) => value.toLowerCase());
}

/**
 * The contexts a property's `TYPE` names: `home` is `private`, `work` stays, and an
 * address also takes `billing` and `delivery`.
 */
function contextsOf(
	property: VCardProperty,
	extra: readonly string[] = [],
): JSContact.Contexts | undefined {
	let contexts: JSContact.Contexts = {};
	for (let type of typesOf(property)) {
		if (type === "home") contexts.private = true;
		else if (type === "work" || extra.includes(type)) contexts[type] = true;
	}
	return Object.keys(contexts).length > 0 ? contexts : undefined;
}

/**
 * A complete date-time in UTC, from a TIMESTAMP or DATE-AND-OR-TIME value in extended format.
 * An offset is applied; a floating time, with no zone, has no UTC instant and reads `null`.
 */
function utcOf(value: string): string | null {
	let match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(
		value,
	);
	if (!match) return null;
	let [, year, month, day, hour, minute, second, zone = "Z"] = match;
	let time = Date.UTC(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
		Number(second),
	);
	if (zone !== "Z") {
		let offset = /^([+-])(\d{2}):?(\d{2})?$/.exec(zone);
		let sign = offset?.[1] === "-" ? -1 : 1;
		time -= sign * (Number(offset?.[2]) * 60 + Number(offset?.[3] ?? 0)) * 60_000;
	}
	return new Date(time).toISOString().replace(".000Z", "Z");
}

/** A PartialDate from a DATE value: a year, a year and month, a month and day, or all three. */
function partialDateOf(value: string): JSContact.PartialDate | null {
	let complete = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (complete)
		return { year: Number(complete[1]), month: Number(complete[2]), day: Number(complete[3]) };
	let yearMonth = /^(\d{4})-(\d{2})$/.exec(value);
	if (yearMonth) return { year: Number(yearMonth[1]), month: Number(yearMonth[2]) };
	if (/^\d{4}$/.test(value)) return { year: Number(value) };
	let monthDay = /^--(\d{2})-(\d{2})$/.exec(value);
	if (monthDay) return { month: Number(monthDay[1]), day: Number(monthDay[2]) };
	return null;
}

/** An anniversary date: a PartialDate for a date, a Timestamp for a UTC date-time, else `null`. */
function anniversaryDate(
	property: VCardProperty,
): JSContact.PartialDate | JSContact.Timestamp | null {
	let value = textOf(property);
	let calendarScale = parameter(property, "calscale")?.toLowerCase();
	if (property.type !== "timestamp") {
		let date = partialDateOf(value);
		if (date) return calendarScale ? { ...date, calendarScale } : date;
	}
	let utc = utcOf(value);
	return utc ? { "@type": "Timestamp", utc } : null;
}

/** The IANA zone a UTC offset names: `Etc/UTC`, or `Etc/GMT` with the sign reversed (`-05:00` → `Etc/GMT+5`). */
function zoneOfOffset(value: string): string | null {
	let match = /^([+-])(\d{2}):?(\d{2})?$/.exec(value);
	if (!match || Number(match[3] ?? 0) !== 0) return null;
	let hours = Number(match[2]) * (match[1] === "-" ? -1 : 1);
	if (hours < -12 || hours > 14) return null;
	if (hours === 0) return "Etc/UTC";
	return `Etc/GMT${hours < 0 ? "+" : "-"}${Math.abs(hours)}`;
}

/** One JSCOMPS entry: a reference to a component value, or a verbatim separator. */
type JSCompsEntry = { column: number; index: number } | { separator: string };

/** Reads a JSCOMPS parameter into its default separator and entries, or `null` when it does not parse. */
function readJSComps(value: string): { defaultSeparator: string; entries: JSCompsEntry[] } | null {
	let [first = "", ...rest] = splitEscaped(value, ";");
	let entry = (raw: string): JSCompsEntry | null => {
		if (raw.startsWith("s,")) return { separator: unescapeText(raw.slice(2)) };
		let match = /^(\d+)(?:,(\d+))?$/.exec(raw);
		return match ? { column: Number(match[1]), index: Number(match[2] ?? 0) } : null;
	};
	if (first !== "" && !first.startsWith("s,")) return null;
	let entries = rest.map(entry);
	if (entries.some((item) => item === null)) return null;
	return {
		defaultSeparator: first === "" ? "" : unescapeText(first.slice(2)),
		entries: entries as JSCompsEntry[],
	};
}

/** A component of a Name or Address with the structured position it came from. */
interface Positioned {
	kind: string;
	value: string;
	column: number;
	index: number;
}

/**
 * Orders the components of an N or ADR. A valid JSCOMPS orders them and adds separators; it
 * is valid when every entry exists and the entries cover every counted value exactly.
 */
function ordered(
	property: VCardProperty,
	cells: string[][],
	counted: Positioned[],
	kinds: readonly string[],
): {
	components: Array<Positioned | { kind: "separator"; value: string }>;
	defaultSeparator?: string;
} | null {
	let raw = parameter(property, "jscomps");
	if (raw === undefined) return null;
	let parsed = readJSComps(raw);
	if (parsed === null) return null;
	let positions = parsed.entries.filter((entry) => "column" in entry);
	if (positions.length !== counted.length) return null;
	let components: Array<Positioned | { kind: "separator"; value: string }> = [];
	for (let entry of parsed.entries) {
		if ("separator" in entry) {
			components.push({ kind: "separator", value: entry.separator });
			continue;
		}
		let value = cells[entry.column]?.[entry.index];
		if (value === undefined) return null;
		components.push({
			kind: kinds[entry.column] as string,
			value,
			column: entry.column,
			index: entry.index,
		});
	}
	return parsed.defaultSeparator === ""
		? { components }
		: { components, defaultSeparator: parsed.defaultSeparator };
}

/** The phonetic system and script a PHONETIC property names. */
function phoneticOf(property: VCardProperty): { phoneticSystem?: string; phoneticScript?: string } {
	let system = parameter(property, "phonetic")?.toLowerCase();
	let script = parameter(property, "script");
	return compact({
		phoneticSystem: system === "script" ? undefined : system,
		phoneticScript: script,
	});
}

/**
 * The components of an N or ADR, with the phonetic values of an overlaying PHONETIC property
 * set at the same positions.
 */
function structuredComponents(
	property: VCardProperty,
	cells: string[][],
	counted: Positioned[],
	kinds: readonly string[],
	overlay: VCardProperty | undefined,
) {
	let order = ordered(property, cells, counted, kinds);
	let phonetic = overlay ? columns(overlay.values[0], cells.length) : null;
	let components = (order?.components ?? counted).map((component) => {
		if (!("column" in component)) return component;
		let sound = phonetic?.[component.column]?.[component.index];
		return compact({ kind: component.kind, value: component.value, phonetic: sound });
	});
	return {
		components,
		isOrdered: order ? true : undefined,
		defaultSeparator: order?.defaultSeparator,
		...(overlay ? phoneticOf(overlay) : {}),
	};
}

/** What a conversion run reads beside the properties: the phonetic overlays by alternative group. */
interface RunInput {
	properties: VCardProperty[];
	overlays: Map<VCardProperty, VCardProperty>;
}

/** Converts one ordered list of properties into a Card, with ids assigned in property order. */
class Run {
	card: JSContact.Card = { "@type": "Card", version: "2.0" };
	#counters = new Map<string, number>();
	#labels = new Map<string, VCardProperty>();
	#usedLabels = new Set<VCardProperty>();
	#organizations = new Map<string, string>();
	#addresses = new Map<string, string[]>();
	#unknown: JCardProperty[] = [];
	#jsprops: VCardProperty[] = [];
	#overlays: Map<VCardProperty, VCardProperty>;

	/** @param input - The properties and phonetic overlays to convert */
	constructor(input: RunInput) {
		this.#overlays = input.overlays;
		for (let property of input.properties) {
			let group = parameter(property, "group");
			if (property.name === "x-ablabel" && group !== undefined)
				this.#labels.set(group.toLowerCase(), property);
		}
		let fullNames = input.properties.filter((property) => property.name === "fn");
		let chosen = [...fullNames].sort(
			(a, b) => Object.keys(a.parameters).length - Object.keys(b.parameters).length,
		)[0];
		for (let property of input.properties) {
			if (property.name === "x-ablabel" || SECOND_PASS.has(property.name)) continue;
			if (property.name === "fn" && property !== chosen) this.#keep(property);
			else this.#convert(property);
		}
		for (let property of input.properties)
			if (SECOND_PASS.has(property.name)) this.#convert(property);
		for (let label of this.#labels.values()) if (!this.#usedLabels.has(label)) this.#keep(label);
		if (this.#unknown.length > 0) this.card.vCardProps = this.#unknown;
	}

	/** The JSPROP properties, applied by the caller once localizations are in place. */
	get jsprops(): VCardProperty[] {
		return this.#jsprops;
	}

	/** Keeps a property with no JSContact counterpart as a jCard property in `vCardProps`. */
	#keep(property: VCardProperty): void {
		this.#unknown.push([
			property.name,
			property.parameters,
			property.type,
			...property.values,
		] as JCardProperty);
	}

	/**
	 * The key for a converted object: JSID, then PROP-ID, when it is a free Id, otherwise
	 * `<PREFIX>-<n>` as RFC 9555's examples number them.
	 */
	#id(prefix: string, property: VCardProperty, existing: object): string {
		let given = parameter(property, "jsid") ?? parameter(property, "prop-id");
		if (given !== undefined && isId(given) && !Object.hasOwn(existing, given)) return given;
		let id: string;
		do {
			let next = (this.#counters.get(prefix) ?? 0) + 1;
			this.#counters.set(prefix, next);
			id = `${prefix}-${next}`;
		} while (Object.hasOwn(existing, id));
		return id;
	}

	/** Adds an object to one of the Card's maps, with the label of its group's X-ABLabel. */
	#add(
		map: string,
		prefix: string,
		property: VCardProperty,
		object: Record<string, unknown>,
	): string {
		let id = this.#id(prefix, property, (this.card[map] as object | undefined) ?? {});
		let group = parameter(property, "group")?.toLowerCase();
		let label = group === undefined ? undefined : this.#labels.get(group);
		if (label && LABELED.has(map)) {
			object.label = textOf(label);
			this.#usedLabels.add(label);
		}
		let target = ((this.card[map] as Record<string, unknown> | undefined) ??= {});
		target[id] = compact(object);
		this.card[map] = target;
		return id;
	}

	/** The `name` object, created on first use so FN and N fill the same one. */
	get #name(): JSContact.Name {
		this.card.name ??= {} as JSContact.Name;
		return this.card.name;
	}

	/** The `speakToAs` object, created on first use so GRAMGENDER and PRONOUNS fill the same one. */
	get #speakToAs(): JSContact.SpeakToAs {
		this.card.speakToAs ??= {};
		return this.card.speakToAs;
	}

	/** Dispatches one property to its conversion rule. */
	#convert(property: VCardProperty): void {
		let value = textOf(property);
		switch (property.name) {
			case "version":
				return;
			case "fn":
				this.#name.full = value;
				return;
			case "n":
				return this.#n(property);
			case "adr":
				return this.#adr(property);
			case "geo":
			case "tz":
				return this.#location(property);
			case "org":
				return this.#org(property);
			case "title":
			case "role":
				return this.#title(property);
			case "nickname":
				for (let nickname of property.values) {
					this.#add("nicknames", "NICK", property, {
						name: String(nickname),
						contexts: contextsOf(property),
						pref: prefOf(property),
					});
				}
				return;
			case "email":
				this.#add("emails", "EMAIL", property, {
					address: value,
					contexts: contextsOf(property),
					pref: prefOf(property),
				});
				return;
			case "tel":
				return this.#tel(property);
			case "impp":
			case "socialprofile":
				this.#add("onlineServices", "OS", property, {
					service: parameter(property, "service-type"),
					uri: property.name === "impp" || property.type === "uri" ? value : undefined,
					user:
						parameter(property, "username") ??
						(property.name === "socialprofile" && property.type !== "uri" ? value : undefined),
					contexts: contextsOf(property),
					pref: prefOf(property),
				});
				return;
			case "lang":
				this.#add("preferredLanguages", "LANG", property, {
					language: value,
					contexts: contextsOf(property),
					pref: prefOf(property),
				});
				return;
			case "caladruri":
				this.#add("schedulingAddresses", "SCHEDULING", property, {
					uri: value,
					contexts: contextsOf(property),
					pref: prefOf(property),
				});
				return;
			case "caluri":
			case "fburl":
				this.#resource("calendars", property.name === "caluri" ? "CAL" : "FBURL", property, {
					kind: property.name === "caluri" ? "calendar" : "freeBusy",
				});
				return;
			case "key":
				this.#resource("cryptoKeys", "KEY", property, {});
				return;
			case "source":
			case "org-directory":
				this.#resource(
					"directories",
					property.name === "source" ? "ENTRY" : "DIRECTORY",
					property,
					{
						kind: property.name === "source" ? "entry" : "directory",
						listAs: positionOf(property, "index"),
					},
				);
				return;
			case "url":
			case "contact-uri":
				this.#resource("links", property.name === "url" ? "LINK" : "CONTACT", property, {
					kind: property.name === "url" ? undefined : "contact",
				});
				return;
			case "photo":
			case "logo":
			case "sound":
				this.#resource("media", property.name.toUpperCase(), property, { kind: property.name });
				return;
			case "bday":
			case "anniversary":
			case "deathdate":
			case "birthplace":
			case "deathplace":
				return this.#anniversary(property);
			case "expertise":
			case "hobby":
			case "interest":
				return this.#personalInfo(property);
			case "note":
				return this.#note(property);
			case "categories":
				this.card.keywords ??= {};
				for (let keyword of property.values) this.card.keywords[String(keyword)] = true;
				return;
			case "member":
				this.card.members ??= {};
				this.card.members[value] = true;
				return;
			case "related":
				this.card.relatedTo ??= {};
				this.card.relatedTo[value] = {
					relation: Object.fromEntries(typesOf(property).map((type) => [type, true as const])),
				};
				return;
			case "gramgender":
				this.#speakToAs.grammaticalGender = value.toLowerCase();
				return;
			case "pronouns":
				this.#speakToAs.pronouns ??= {};
				this.#speakToAs.pronouns[this.#id("PRONOUNS", property, this.#speakToAs.pronouns)] =
					compact({
						pronouns: value,
						contexts: contextsOf(property),
						pref: prefOf(property),
					});
				return;
			case "kind":
				this.card.kind = value.toLowerCase();
				return;
			case "uid":
				this.card.uid = value;
				return;
			case "prodid":
				this.card.prodId = value;
				return;
			case "language":
				this.card.language = canonicalLanguage(value);
				return;
			case "created":
			case "rev": {
				let utc = utcOf(value);
				if (utc === null) return this.#keep(property);
				this.card[property.name === "created" ? "created" : "updated"] = utc;
				return;
			}
			case "jsprop":
				this.#jsprops.push(property);
				return;
			default:
				this.#keep(property);
		}
	}

	/** A Resource subtype: the value is its `uri`, with MEDIATYPE, TYPE and PREF. */
	#resource(
		map: string,
		prefix: string,
		property: VCardProperty,
		extra: Record<string, unknown>,
	): void {
		this.#add(map, prefix, property, {
			...extra,
			uri: textOf(property),
			mediaType: parameter(property, "mediatype"),
			contexts: contextsOf(property),
			pref: prefOf(property),
		});
	}

	/** N: its components, SORT-AS, JSCOMPS order and any PHONETIC overlay, into `name`. */
	#n(property: VCardProperty): void {
		let cells = columns(property.values[0], 7);
		let secondary = new Set(cells[5]);
		let generation = new Set(cells[6]);
		let counted: Positioned[] = [];
		cells.forEach((values, column) => {
			values.forEach((value, index) => {
				if (column === 0 && secondary.has(value)) return;
				if (column === 4 && generation.has(value)) return;
				let kind = N_KINDS[column];
				if (kind !== undefined) counted.push({ kind, value, column, index });
			});
		});
		let name = this.#name;
		Object.assign(
			name,
			compact(
				structuredComponents(property, cells, counted, N_KINDS, this.#overlays.get(property)),
			),
		);
		let sortAs: Record<string, string> = {};
		parameterValues(property, "sort-as").forEach((value, index) => {
			let kind = N_KINDS[index];
			if (kind && value !== "" && counted.some((component) => component.kind === kind))
				sortAs[kind] = value;
		});
		if (Object.keys(sortAs).length > 0) name.sortAs = sortAs;
	}

	/** ADR: an Address with its components, LABEL, GEO, TZ, CC, TYPE, PREF and JSCOMPS. */
	#adr(property: VCardProperty): void {
		let cells = columns(property.values[0], 7);
		let extended = cells.slice(7).some((values) => values.length > 0);
		let counted: Positioned[] = [];
		cells.forEach((values, column) => {
			if (extended && (column === 1 || column === 2)) return;
			values.forEach((value, index) => {
				let kind = ADR_KINDS[column];
				if (kind !== undefined) counted.push({ kind, value, column, index });
			});
		});
		let { components, ...rest } = structuredComponents(
			property,
			cells,
			counted,
			ADR_KINDS,
			this.#overlays.get(property),
		);
		let id = this.#add("addresses", "ADDR", property, {
			contexts: contextsOf(property, ["billing", "delivery"]),
			components: components.length > 0 ? components : undefined,
			...rest,
			full: parameter(property, "label"),
			coordinates: parameter(property, "geo"),
			timeZone: parameter(property, "tz"),
			countryCode: parameter(property, "cc"),
			pref: prefOf(property),
		});
		let group = parameter(property, "group")?.toLowerCase() ?? "";
		this.#addresses.set(group, [...(this.#addresses.get(group) ?? []), id]);
	}

	/** GEO and TZ: the coordinates or zone of the address in the same group, or a new Address. */
	#location(property: VCardProperty): void {
		let field = property.name === "geo" ? "coordinates" : "timeZone";
		let value = textOf(property);
		if (property.name === "tz" && property.type === "utc-offset") {
			let zone = zoneOfOffset(value);
			if (zone === null) return this.#keep(property);
			value = zone;
		} else if (property.name === "tz" && property.type !== "text") {
			return this.#keep(property);
		}
		let group = parameter(property, "group")?.toLowerCase() ?? "";
		let addresses = (this.card.addresses ?? {}) as Record<string, JSContact.Address>;
		let target = (this.#addresses.get(group) ?? []).find(
			(id) => addresses[id]?.[field] === undefined,
		);
		if (target !== undefined) {
			(addresses[target] as JSContact.Address)[field] = value;
			return;
		}
		let id = this.#add("addresses", "ADDR", property, { [field]: value });
		this.#addresses.set(group, [...(this.#addresses.get(group) ?? []), id]);
	}

	/** ORG: an Organization with its units and SORT-AS, remembered by group for TITLE and ROLE. */
	#org(property: VCardProperty): void {
		let [value] = property.values;
		let parts = (Array.isArray(value) ? value : [value]).map((part) => {
			if (Array.isArray(part)) return part.join(",");
			return part === null || part === undefined ? "" : String(part);
		});
		let [name = "", ...units] = parts;
		let sortAs = parameterValues(property, "sort-as");
		let id = this.#add("organizations", "ORG", property, {
			name: name === "" ? undefined : name,
			units:
				units.length > 0
					? units.map((unit, index) =>
							compact({ name: unit, sortAs: sortAs[index + 1] || undefined }),
						)
					: undefined,
			sortAs: sortAs[0] || undefined,
			contexts: contextsOf(property),
		});
		let group = parameter(property, "group")?.toLowerCase() ?? "";
		if (!this.#organizations.has(group)) this.#organizations.set(group, id);
	}

	/** TITLE and ROLE: a Title, held at the ORG of the same group or, ungrouped, the ungrouped ORG. */
	#title(property: VCardProperty): void {
		let group = parameter(property, "group")?.toLowerCase() ?? "";
		this.#add("titles", property.name === "role" ? "ROLE" : "TITLE", property, {
			kind: property.name,
			name: textOf(property),
			organizationId: this.#organizations.get(group),
		});
	}

	/** TEL: a Phone, its TEL-specific TYPE values as features and `home`/`work` as contexts. */
	#tel(property: VCardProperty): void {
		let features: Record<string, true> = {};
		for (let type of typesOf(property)) {
			let feature = TEL_FEATURES[type];
			if (feature) features[feature] = true;
		}
		this.#add("phones", "PHONE", property, {
			contexts: contextsOf(property),
			features: Object.keys(features).length > 0 ? features : undefined,
			number: textOf(property),
			pref: prefOf(property),
		});
	}

	/**
	 * BDAY, ANNIVERSARY and DEATHDATE set an Anniversary's date; BIRTHPLACE and DEATHPLACE its
	 * place, joining the date of the same kind when their ALTIDs match or neither has one.
	 */
	#anniversary(property: VCardProperty): void {
		let kinds: Record<string, string> = {
			bday: "birth",
			birthplace: "birth",
			anniversary: "wedding",
			deathdate: "death",
			deathplace: "death",
		};
		let kind = kinds[property.name] as string;
		let isPlace = property.name.endsWith("place");
		let anniversaries = (this.card.anniversaries ?? {}) as Record<string, JSContact.Anniversary>;
		let altid = parameter(property, "altid");
		let partner = Object.entries(anniversaries).find(
			([id, anniversary]) =>
				anniversary.kind === kind &&
				(isPlace ? anniversary.place === undefined : anniversary.date === undefined) &&
				this.#anniversaryAltids.get(id) === altid,
		);

		let place: JSContact.Address | null = null;
		let date: JSContact.Anniversary["date"] | null = null;
		if (isPlace) {
			let value = textOf(property);
			if (property.type === "text") place = { full: value };
			else if (property.type === "uri" && value.toLowerCase().startsWith("geo:"))
				place = { coordinates: value };
		} else {
			date = anniversaryDate(property);
		}
		if (place === null && date === null) return this.#keep(property);

		if (partner) {
			let [, anniversary] = partner;
			if (place) anniversary.place = place;
			if (date) anniversary.date = date;
			return;
		}
		let id = this.#add("anniversaries", "ANNIVERSARY", property, {
			kind,
			...(date ? { date } : {}),
			...(place ? { place } : {}),
		});
		this.#anniversaryAltids.set(id, altid);
	}

	/** The ALTID each anniversary was created with, which a date and a place must share to join. */
	#anniversaryAltids = new Map<string, string | undefined>();

	/** EXPERTISE, HOBBY and INTEREST: a PersonalInfo with its LEVEL and INDEX. */
	#personalInfo(property: VCardProperty): void {
		let level = parameter(property, "level")?.toLowerCase();
		if (level !== undefined && property.name === "expertise")
			level = EXPERTISE_LEVELS[level] ?? level;
		this.#add("personalInfo", "PERSINFO", property, {
			kind: property.name,
			value: textOf(property),
			level,
			listAs: positionOf(property, "index"),
		});
	}

	/** NOTE: a Note with its CREATED, AUTHOR and AUTHOR-NAME parameters. */
	#note(property: VCardProperty): void {
		let created = parameter(property, "created");
		let author = compact({
			name: parameter(property, "author-name"),
			uri: parameter(property, "author"),
		});
		this.#add("notes", "NOTE", property, {
			note: textOf(property),
			created:
				created === undefined ? undefined : (utcOf(toExtended("timestamp", created)) ?? undefined),
			author: Object.keys(author).length > 0 ? author : undefined,
		});
	}
}

/** A localizable property's language, canonicalized, or `null` when it names none. */
function languageOf(property: VCardProperty): string | null {
	let value = parameter(property, "language");
	return value === undefined || value === "" ? null : canonicalLanguage(value);
}

/** Whether a property is a PHONETIC rendering of an N or ADR rather than a value of its own. */
function isPhonetic(property: VCardProperty): boolean {
	return (
		(property.name === "n" || property.name === "adr") &&
		parameter(property, "phonetic") !== undefined
	);
}

/** The alternatives of one localizable property: the main value and its translations. */
interface Alternatives {
	members: VCardProperty[];
	main: VCardProperty;
}

/**
 * Groups localizable properties by name and ALTID and chooses each group's main value: one
 * without LANGUAGE, else one in the card's language, else one in the dominant language.
 */
function alternatives(properties: VCardProperty[], cardLanguage: string | null): Alternatives[] {
	let groups = new Map<string, VCardProperty[]>();
	for (let [index, property] of properties.entries()) {
		if (!LOCALIZABLE.has(property.name) || isPhonetic(property)) continue;
		let altid = parameter(property, "altid");
		let key = altid === undefined ? `#${index}` : `${property.name}\u0000${altid}`;
		groups.set(key, [...(groups.get(key) ?? []), property]);
	}

	let counts = new Map<string, number>();
	for (let members of groups.values()) {
		if (members.some((member) => languageOf(member) === null)) continue;
		for (let member of members) {
			let language = languageOf(member) as string;
			counts.set(language, (counts.get(language) ?? 0) + 1);
		}
	}
	let dominant = cardLanguage ?? [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

	return [...groups.values()].map((members) => ({
		members,
		main:
			members.find((member) => languageOf(member) === null) ??
			members.find((member) => languageOf(member) === dominant) ??
			(members[0] as VCardProperty),
	}));
}

/** Applies the JSPROP properties as one PatchObject, leaving the Card as it was when any is invalid. */
function applyJSProps(card: JSContact.Card, jsprops: VCardProperty[]): JSContact.Card {
	if (jsprops.length === 0) return card;
	let patch: JSContact.PatchObject = {};
	for (let property of jsprops) {
		let pointer = parameter(property, "jsptr");
		if (pointer === undefined) return card;
		try {
			patch[pointer.replace(/^\//, "")] = JSON.parse(textOf(property));
		} catch {
			return card;
		}
	}
	let patched = applyPatch(card, patch);
	return isSuccess(patched) ? patched.data : card;
}

/**
 * Converts a vCard to a JSContact Card (RFC 9555 §2). Language alternatives sharing an ALTID
 * become `localizations`, JSPROP properties patch the result last, and a property with no
 * counterpart, or a DERIVED one, is kept in `vCardProps` or dropped respectively.
 *
 * @param vcard - The card, read from vCard text or jCard
 * @returns The Card, version 2.0, with a `uid` only when the vCard had a UID
 * @example fromVCard(unwrap(parseVCard(text))[0]);
 */
export function fromVCard(vcard: VCard): JSContact.Card {
	let properties = vcard.properties.filter(
		(property) =>
			property.name !== "version" && parameter(property, "derived")?.toLowerCase() !== "true",
	);
	let languageProperty = properties.find((property) => property.name === "language");
	let cardLanguage = languageProperty ? canonicalLanguage(textOf(languageProperty)) : null;

	let groups = alternatives(properties, cardLanguage);
	let mains = new Set(groups.map((group) => group.main));
	let groupOf = new Map<VCardProperty, Alternatives>();
	for (let group of groups) for (let member of group.members) groupOf.set(member, group);

	let mainLanguages = new Set([...mains].map(languageOf).filter((language) => language !== null));
	let derived = mainLanguages.size === 1 ? ([...mainLanguages][0] as string) : null;
	let effective = cardLanguage ?? derived;

	let phonetics = properties.filter(isPhonetic);
	let overlaysFor = (language: string | null, list: VCardProperty[]) => {
		let overlays = new Map<VCardProperty, VCardProperty>();
		for (let phonetic of phonetics) {
			let tag = languageOf(phonetic);
			let matches = language === null ? tag === null || tag === effective : tag === language;
			if (!matches) continue;
			let altid = parameter(phonetic, "altid");
			let target = list.find(
				(property) =>
					property.name === phonetic.name &&
					!isPhonetic(property) &&
					parameter(property, "altid") === altid,
			);
			if (target) overlays.set(target, phonetic);
		}
		return overlays;
	};

	let mainList = properties.filter(
		(property) => !isPhonetic(property) && (!groupOf.has(property) || mains.has(property)),
	);
	let main = new Run({ properties: mainList, overlays: overlaysFor(null, mainList) });
	let card = main.card;
	if (derived !== null && cardLanguage === null) card.language = derived;

	let languages = new Set<string>();
	for (let property of [...groupOf.keys(), ...phonetics]) {
		let language = languageOf(property);
		if (language !== null && language !== effective && !mains.has(property))
			languages.add(language);
	}

	let localizations: Record<string, JSContact.PatchObject> = {};
	for (let language of languages) {
		let list = mainList.map((property) => {
			let group = groupOf.get(property);
			return group?.members.find((member) => languageOf(member) === language) ?? property;
		});
		let localized = new Run({ properties: list, overlays: overlaysFor(language, list) }).card;
		if (card.language !== undefined) localized.language = card.language;
		let patch = diff(card, localized, { arrays: true });
		if (Object.keys(patch).length > 0) localizations[language] = patch;
	}
	if (Object.keys(localizations).length > 0) card.localizations = localizations;

	return applyJSProps(card, main.jsprops);
}
