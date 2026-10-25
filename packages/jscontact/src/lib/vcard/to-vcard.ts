/**
 * Converts a JSContact Card to a vCard following RFC 9555 §3: each map entry becomes a
 * property carrying its key in PROP-ID, localizations become LANGUAGE alternatives, and
 * whatever vCard has no property for travels in JSPROP, so converting back is lossless.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isSuccess } from "@sdxc/result";

import type { JSContact } from "../../types.js";

import { diff, equal } from "../diff.js";
import { applyPatch } from "../patch.js";

import type { VCard, VCardProperty, VCardValue } from "./model.js";

import { fromVCard } from "./from-vcard.js";
import { parameter } from "./model.js";
import { escapeText } from "./text.js";

/** The N component position of each NameComponent kind. */
const N_COLUMNS: Record<string, number> = {
	surname: 0,
	given: 1,
	given2: 2,
	title: 3,
	credential: 4,
	surname2: 5,
	generation: 6,
};

/** The ADR component position of each AddressComponent kind in the RFC 6350 layout. */
const ADR_COLUMNS: Record<string, number> = {
	postOfficeBox: 0,
	apartment: 1,
	name: 2,
	locality: 3,
	region: 4,
	postcode: 5,
	country: 6,
};

/** The ADR component position of each AddressComponent kind in the RFC 9554 layout. */
const EXTENDED_ADR_COLUMNS: Record<string, number> = {
	postOfficeBox: 0,
	locality: 3,
	region: 4,
	postcode: 5,
	country: 6,
	room: 7,
	apartment: 8,
	floor: 9,
	number: 10,
	name: 11,
	building: 12,
	block: 13,
	subdistrict: 14,
	district: 15,
	landmark: 16,
	direction: 17,
};

/** The address kinds only the RFC 9554 layout has a position for. */
const EXTENDED_KINDS = new Set([
	"room",
	"floor",
	"number",
	"building",
	"block",
	"subdistrict",
	"district",
	"landmark",
	"direction",
]);

/** The TEL TYPE value each Phone feature converts to. */
const TEL_TYPES: Record<string, string> = { mobile: "cell" };

/** The EXPERTISE LEVEL value each JSContact level converts to. */
const EXPERTISE_LEVELS: Record<string, string> = {
	low: "beginner",
	medium: "average",
	high: "expert",
};

/** The properties a localization converts into LANGUAGE alternatives. */
const LOCALIZABLE = new Set(["fn", "n", "org", "title", "role", "note", "nickname", "adr"]);

/** Whether a value is a URI, which decides the value type of a property that takes either. */
function isUri(value: string): boolean {
	return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

/** The TYPE values a set of contexts converts to: `private` is `home`, the others stay. */
function typesOf(contexts: JSContact.Contexts | undefined): string[] {
	return Object.keys(contexts ?? {}).map((context) => (context === "private" ? "home" : context));
}

/** A parameter object without empty entries, so absent fields add no parameter. */
function parameters(
	entries: Record<string, string | string[] | number | undefined>,
): Record<string, string | string[]> {
	let result: Record<string, string | string[]> = {};
	for (let [key, value] of Object.entries(entries)) {
		if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
		if (typeof value === "number") result[key] = String(value);
		else if (Array.isArray(value) && value.length === 1) result[key] = value[0] as string;
		else result[key] = value;
	}
	return result;
}

/** A structured component: empty, one value, or several. */
function cell(values: string[]): VCardValue {
	if (values.length === 0) return "";
	return values.length === 1 ? (values[0] as string) : values;
}

/** Escapes a JSCOMPS separator entry, whose `,` and `;` are vCard separators. */
function jscompsSeparator(value: string): string {
	return `s,${escapeText(value)}`;
}

/** A Name or Address laid out in structured columns, with its JSCOMPS order and phonetic values. */
interface Layout {
	cells: string[][];
	phonetics: string[][];
	jscomps?: string;
}

/** Lays components into their columns; an ordered list records its order and separators in JSCOMPS. */
function layout(
	object: JSContact.Name | JSContact.Address,
	columnOf: (kind: string) => number | undefined,
	size: number,
): Layout {
	let cells: string[][] = Array.from({ length: size }, () => []);
	let phonetics: string[][] = Array.from({ length: size }, () => []);
	let entries = [object.defaultSeparator ? jscompsSeparator(object.defaultSeparator) : ""];
	for (let component of object.components ?? []) {
		if (component.kind === "separator") {
			entries.push(jscompsSeparator(component.value));
			continue;
		}
		let column = columnOf(component.kind);
		if (column === undefined) continue;
		let index = (cells[column] as string[]).length;
		(cells[column] as string[]).push(component.value);
		(phonetics[column] as string[]).push(component.phonetic ?? "");
		entries.push(index === 0 ? String(column) : `${column},${index}`);
	}
	return object.isOrdered ? { cells, phonetics, jscomps: entries.join(";") } : { cells, phonetics };
}

/** Whether a Name or Address carries phonetic data, which a PHONETIC alternative holds. */
function hasPhonetics(object: JSContact.Name | JSContact.Address): boolean {
	return (
		object.phoneticSystem !== undefined ||
		object.phoneticScript !== undefined ||
		(object.components ?? []).some((component) => component.phonetic !== undefined)
	);
}

/** Builds the properties of one Card, the localizations left out. */
class Writer {
	properties: VCardProperty[] = [];
	#groups = 0;
	#altids = 0;
	#card: JSContact.Card;

	/** @param card - The Card to write */
	constructor(card: JSContact.Card) {
		this.#card = card;
		this.#metadata();
		this.#name();
		this.#organizations();
		this.#speakToAs();
		this.#entries("emails", (email: JSContact.EmailAddress) =>
			this.#simple("email", "text", email.address, email),
		);
		this.#entries("onlineServices", (service: JSContact.OnlineService) =>
			this.#onlineService(service),
		);
		this.#entries("phones", (phone: JSContact.Phone) => this.#phone(phone));
		this.#entries("preferredLanguages", (language: JSContact.LanguagePref) =>
			this.#simple("lang", "language-tag", language.language, language),
		);
		this.#entries("calendars", (calendar: JSContact.Calendar) =>
			this.#resource(calendar.kind === "freeBusy" ? "fburl" : "caluri", calendar),
		);
		this.#entries("schedulingAddresses", (address: JSContact.SchedulingAddress) =>
			this.#simple("caladruri", "uri", address.uri, address),
		);
		this.#entries("addresses", (address: JSContact.Address) => this.#address(address));
		this.#entries("cryptoKeys", (key: JSContact.CryptoKey) => this.#resource("key", key));
		this.#entries("directories", (directory: JSContact.Directory) =>
			this.#resource(directory.kind === "entry" ? "source" : "org-directory", directory, {
				index: directory.listAs,
			}),
		);
		this.#entries("links", (link: JSContact.Link) =>
			this.#resource(link.kind === "contact" ? "contact-uri" : "url", link),
		);
		this.#entries("media", (media: JSContact.Media) =>
			this.#resource(media.kind === "logo" || media.kind === "sound" ? media.kind : "photo", media),
		);
		this.#anniversaries();
		this.#rest();
	}

	/** The next property group name, for a TITLE and its ORG or a value and its X-ABLabel. */
	#group(): string {
		this.#groups++;
		return `item${this.#groups}`;
	}

	/** The next ALTID, which ties alternative representations of one value together. */
	altid(): string {
		this.#altids++;
		return String(this.#altids);
	}

	/** Adds a property; a `label` on the object adds an X-ABLabel in a shared group. */
	#push(property: VCardProperty, label?: string): void {
		if (label === undefined) {
			this.properties.push(property);
			return;
		}
		let group =
			typeof property.parameters.group === "string" ? property.parameters.group : this.#group();
		property.parameters.group = group;
		this.properties.push(property, {
			name: "x-ablabel",
			parameters: { group },
			type: "text",
			values: [label],
		});
	}

	/**
	 * Calls `write` for each entry of a map with its key, which every property it adds
	 * carries as PROP-ID.
	 */
	#entries<T>(map: string, write: (value: T, id: string) => void): void {
		let entries = (this.#card[map] as Record<string, T> | undefined) ?? {};
		for (let [id, value] of Object.entries(entries)) {
			let before = this.properties.length;
			write(value, id);
			for (let property of this.properties.slice(before)) {
				if (property.name !== "x-ablabel") property.parameters["prop-id"] = id;
			}
		}
	}

	/** A property whose value is one field, with TYPE from contexts, PREF and a label. */
	#simple(
		name: string,
		type: string,
		value: string,
		object: { contexts?: JSContact.Contexts; pref?: number; label?: string },
		extra: Record<string, string | string[] | number | undefined> = {},
	): void {
		this.#push(
			{
				name,
				parameters: parameters({ type: typesOf(object.contexts), pref: object.pref, ...extra }),
				type,
				values: [value],
			},
			object.label,
		);
	}

	/** A Resource: its URI as the value, MEDIATYPE, TYPE, PREF and label. */
	#resource(
		name: string,
		resource: JSContact.Resource,
		extra: Record<string, string | number | undefined> = {},
	): void {
		this.#simple(name, "uri", resource.uri, resource, { mediatype: resource.mediaType, ...extra });
	}

	/** KIND, UID, PRODID, CREATED, REV and LANGUAGE. */
	#metadata(): void {
		let card = this.#card;
		let add = (name: string, type: string, value: string | undefined) => {
			if (value !== undefined)
				this.properties.push({ name, parameters: {}, type, values: [value] });
		};
		add("kind", "text", card.kind);
		add("uid", card.uid !== undefined && isUri(card.uid) ? "uri" : "text", card.uid);
		add("prodid", "text", card.prodId);
		add("created", "timestamp", card.created);
		add("rev", "timestamp", card.updated);
		add("language", "language-tag", card.language);
	}

	/**
	 * FN and N. A Name without `full` gets an FN derived from its components and marked
	 * DERIVED; a Card without a name still gets the empty FN vCard requires.
	 */
	#name(): void {
		let name = this.#card.name;
		let components = name?.components ?? [];
		if (name?.full !== undefined) {
			this.properties.push({ name: "fn", parameters: {}, type: "text", values: [name.full] });
		} else {
			let derived = name?.isOrdered
				? components
						.map((component, index) => {
							let next = components[index + 1];
							let gap =
								component.kind !== "separator" && next !== undefined && next.kind !== "separator";
							return component.value + (gap ? (name?.defaultSeparator ?? " ") : "");
						})
						.join("")
				: components
						.filter((component) => component.kind !== "separator")
						.map((component) => component.value)
						.join(" ");
			this.properties.push({
				name: "fn",
				parameters: derived === "" ? {} : { derived: "TRUE" },
				type: "text",
				values: [derived],
			});
		}
		if (name === undefined || components.length === 0) return;

		let { cells, phonetics, jscomps } = layout(name, (kind) => N_COLUMNS[kind], 7);
		let sortAs = Object.entries(name.sortAs ?? {}).reduce<string[]>((list, [kind, value]) => {
			let column = N_COLUMNS[kind];
			if (column !== undefined && value !== undefined) list[column] = value;
			return list;
		}, []);
		let property: VCardProperty = {
			name: "n",
			parameters: parameters({
				"sort-as": sortAs.length > 0 ? Array.from(sortAs, (value) => value ?? "") : undefined,
				jscomps,
			}),
			type: "text",
			values: [cells.map(cell)],
		};
		this.properties.push(property);
		if (hasPhonetics(name)) this.#phonetic(property, name, phonetics);
	}

	/** The PHONETIC alternative of an N or ADR, sharing its ALTID. */
	#phonetic(
		property: VCardProperty,
		object: JSContact.Name | JSContact.Address,
		phonetics: string[][],
	): void {
		let altid = parameter(property, "altid") ?? this.altid();
		property.parameters.altid = altid;
		this.properties.push({
			name: property.name,
			parameters: parameters({
				altid,
				phonetic: object.phoneticSystem ?? "script",
				script: object.phoneticScript,
				jscomps: parameter(property, "jscomps"),
			}),
			type: "text",
			values: [phonetics.map(cell)],
		});
	}

	/** NICKNAME, ORG, TITLE and ROLE; when titles exist, each ORG takes a group its titles join. */
	#organizations(): void {
		this.#entries("nicknames", (nickname: JSContact.Nickname) =>
			this.#simple("nickname", "text", nickname.name, nickname),
		);
		let titles = Object.values(this.#card.titles ?? {});
		let groups = new Map<string, string>();
		this.#entries("organizations", (organization: JSContact.Organization, id) => {
			let units = organization.units ?? [];
			let sortAs = [organization.sortAs ?? "", ...units.map((unit) => unit.sortAs ?? "")];
			while (sortAs.length > 0 && sortAs.at(-1) === "") sortAs.pop();
			let group = titles.length > 0 ? this.#group() : undefined;
			if (group) groups.set(id, group);
			let value = [organization.name ?? "", ...units.map((unit) => unit.name)];
			this.properties.push({
				name: "org",
				parameters: parameters({ group, type: typesOf(organization.contexts), "sort-as": sortAs }),
				type: "text",
				values: [value.length === 1 ? (value[0] as string) : value],
			});
		});
		this.#entries("titles", (title: JSContact.Title) => {
			let group = title.organizationId === undefined ? undefined : groups.get(title.organizationId);
			this.properties.push({
				name: title.kind === "role" ? "role" : "title",
				parameters: parameters({ group }),
				type: "text",
				values: [title.name],
			});
		});
	}

	/** GRAMGENDER and PRONOUNS. */
	#speakToAs(): void {
		let speakToAs = this.#card.speakToAs;
		if (speakToAs === undefined) return;
		if (speakToAs.grammaticalGender !== undefined) {
			this.properties.push({
				name: "gramgender",
				parameters: {},
				type: "text",
				values: [speakToAs.grammaticalGender.toUpperCase()],
			});
		}
		for (let [id, pronouns] of Object.entries(speakToAs.pronouns ?? {})) {
			this.#simple("pronouns", "text", pronouns.pronouns, pronouns, { "prop-id": id });
		}
	}

	/** IMPP for a bare messaging URI, SOCIALPROFILE for a profile or a user name. */
	#onlineService(service: JSContact.OnlineService): void {
		let extra = { "service-type": service.service, username: service.user };
		if (
			service.uri !== undefined &&
			service.service === undefined &&
			service.user === undefined &&
			!/^https?:/i.test(service.uri)
		) {
			this.#simple("impp", "uri", service.uri, service);
			return;
		}
		if (service.uri !== undefined) {
			this.#simple("socialprofile", "uri", service.uri, service, extra);
			return;
		}
		this.#simple("socialprofile", "text", service.user ?? "", service, {
			"service-type": service.service,
		});
	}

	/** TEL: a URI value when the number is one, its features and contexts in TYPE. */
	#phone(phone: JSContact.Phone): void {
		let types = [
			...typesOf(phone.contexts),
			...Object.keys(phone.features ?? {}).map((feature) => TEL_TYPES[feature] ?? feature),
		];
		this.#push(
			{
				name: "tel",
				parameters: parameters({ type: types, pref: phone.pref }),
				type: isUri(phone.number) ? "uri" : "text",
				values: [phone.number],
			},
			phone.label,
		);
	}

	/** ADR: its components in the RFC 6350 layout, or the RFC 9554 one when a new kind is used. */
	#address(address: JSContact.Address): void {
		let extended = (address.components ?? []).some((component) =>
			EXTENDED_KINDS.has(component.kind),
		);
		let columnsOf = extended ? EXTENDED_ADR_COLUMNS : ADR_COLUMNS;
		let { cells, phonetics, jscomps } = layout(
			address,
			(kind) => columnsOf[kind],
			extended ? 18 : 7,
		);
		if (extended) {
			cells[2] = [[...(cells[10] ?? []), ...(cells[11] ?? [])].join(" ")].filter(
				(value) => value !== "",
			);
		}
		let property: VCardProperty = {
			name: "adr",
			parameters: parameters({
				type: typesOf(address.contexts),
				pref: address.pref,
				label: address.full,
				geo: address.coordinates,
				tz: address.timeZone,
				cc: address.countryCode,
				jscomps,
			}),
			type: "text",
			values: [cells.map(cell)],
		};
		this.properties.push(property);
		if (hasPhonetics(address)) this.#phonetic(property, address, phonetics);
	}

	/** BDAY with BIRTHPLACE, DEATHDATE with DEATHPLACE, and ANNIVERSARY for a wedding. */
	#anniversaries(): void {
		let all = Object.values(this.#card.anniversaries ?? {});
		this.#entries("anniversaries", (anniversary: JSContact.Anniversary) => {
			let names: Record<string, [string, string | null]> = {
				birth: ["bday", "birthplace"],
				death: ["deathdate", "deathplace"],
				wedding: ["anniversary", null],
			};
			let [dateName, placeName] = names[anniversary.kind] ?? ["anniversary", null];
			let shared = all.filter((other) => other.kind === anniversary.kind).length > 1;
			let altid =
				shared && anniversary.place !== undefined && placeName !== null ? this.altid() : undefined;
			let date = anniversary.date;
			let value =
				"utc" in date && date["@type"] === "Timestamp"
					? date.utc
					: partialDate(date as JSContact.PartialDate);
			if (value !== null) {
				this.properties.push({
					name: dateName,
					parameters: parameters({
						altid,
						calscale:
							"calendarScale" in date ? (date.calendarScale as string | undefined) : undefined,
					}),
					type: "date-and-or-time",
					values: [value],
				});
			}
			let place = anniversary.place;
			if (placeName === null || place === undefined) return;
			if (place.full !== undefined) {
				this.properties.push({
					name: placeName,
					parameters: parameters({ altid }),
					type: "text",
					values: [place.full],
				});
			} else if (place.coordinates !== undefined) {
				this.properties.push({
					name: placeName,
					parameters: parameters({ altid }),
					type: "uri",
					values: [place.coordinates],
				});
			}
		});
	}

	/** CATEGORIES, NOTE, EXPERTISE, HOBBY, INTEREST, MEMBER, RELATED and the kept vCard properties. */
	#rest(): void {
		let card = this.#card;
		let keywords = Object.keys(card.keywords ?? {});
		if (keywords.length > 0)
			this.properties.push({ name: "categories", parameters: {}, type: "text", values: keywords });
		this.#entries("notes", (note: JSContact.Note) => {
			this.properties.push({
				name: "note",
				parameters: parameters({
					created: note.created?.replace(/[-:]/g, ""),
					author: note.author?.uri,
					"author-name": note.author?.name,
				}),
				type: "text",
				values: [note.note],
			});
		});
		this.#entries("personalInfo", (info: JSContact.PersonalInfo) => {
			let level =
				info.kind === "expertise" && info.level
					? (EXPERTISE_LEVELS[info.level] ?? info.level)
					: info.level;
			let name = info.kind === "hobby" || info.kind === "interest" ? info.kind : "expertise";
			this.#push(
				{
					name,
					parameters: parameters({ level, index: info.listAs }),
					type: "text",
					values: [info.value],
				},
				info.label,
			);
		});
		for (let member of Object.keys(card.members ?? {})) {
			this.properties.push({
				name: "member",
				parameters: {},
				type: isUri(member) ? "uri" : "text",
				values: [member],
			});
		}
		for (let [key, relation] of Object.entries(card.relatedTo ?? {})) {
			this.properties.push({
				name: "related",
				parameters: parameters({ type: Object.keys(relation.relation ?? {}) }),
				type: isUri(key) ? "uri" : "text",
				values: [key],
			});
		}
		for (let [name, params, type, ...values] of card.vCardProps ?? []) {
			this.properties.push({ name, parameters: params, type, values: values as VCardValue[] });
		}
	}
}

/** A PartialDate as a DATE value in extended form, or `null` for a day without a month. */
function partialDate(date: JSContact.PartialDate): string | null {
	let pad = (value: number, size = 2) => String(value).padStart(size, "0");
	let { year, month, day } = date;
	if (year !== undefined && month !== undefined && day !== undefined)
		return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
	if (year !== undefined && month !== undefined) return `${pad(year, 4)}-${pad(month)}`;
	if (year !== undefined && day === undefined) return pad(year, 4);
	if (month !== undefined && day !== undefined) return `--${pad(month)}-${pad(day)}`;
	return null;
}

/** The identity a localized property is matched to its main value by: name, PROP-ID and whether it is phonetic. */
function identity(property: VCardProperty): string {
	return `${property.name}\u0000${parameter(property, "prop-id") ?? ""}\u0000${parameter(property, "phonetic") === undefined ? "" : "p"}`;
}

/** A property's value and the parameters a localization can change, for telling it from the main value. */
function content(property: VCardProperty): unknown {
	let { altid: _, language: __, ...rest } = property.parameters;
	return [rest, property.values];
}

/**
 * Converts a JSContact Card to a vCard (RFC 9555 §3). Each localization adds LANGUAGE
 * alternatives sharing an ALTID with the value they translate, and a JSPROP carries every
 * property, unknown and vendor ones included, that the vCard properties do not restore.
 *
 * @param card - The Card
 * @returns The vCard, `version` first; `stringifyVCard` or `writeJCard` serializes it
 * @example stringifyVCard(toVCard(card));
 */
export function toVCard(card: JSContact.Card): VCard {
	let { localizations, ...base } = card;
	let writer = new Writer(base as JSContact.Card);
	let properties: VCardProperty[] = [
		{ name: "version", parameters: {}, type: "text", values: ["4.0"] },
		...writer.properties,
	];

	for (let [language, patch] of Object.entries(localizations ?? {})) {
		let localized = applyPatch(base as JSContact.Card, patch);
		if (!isSuccess(localized)) continue;
		for (let property of new Writer(localized.data).properties) {
			if (!LOCALIZABLE.has(property.name)) continue;
			let main = properties.find(
				(candidate) =>
					identity(candidate) === identity(property) &&
					parameter(candidate, "language") === undefined,
			);
			if (main && equal(content(main), content(property))) continue;
			main ??= properties.find(
				(candidate) =>
					parameter(property, "phonetic") !== undefined &&
					identity(candidate) ===
						identity({ ...property, parameters: { ...property.parameters, phonetic: [] } }) &&
					parameter(candidate, "language") === undefined,
			);
			let altid = main ? (parameter(main, "altid") ?? writer.altid()) : undefined;
			if (main && altid) main.parameters.altid = altid;
			let { altid: _, ...rest } = property.parameters;
			properties.push({ ...property, parameters: parameters({ ...rest, altid, language }) });
		}
	}

	let restored = fromVCard({ properties });
	let missing = diff(restored, card, { topLevelOnly: new Set(["@type"]) });
	for (let [pointer, value] of Object.entries(missing)) {
		properties.push({
			name: "jsprop",
			parameters: { jsptr: pointer },
			type: "text",
			values: [JSON.stringify(value)],
		});
	}
	return { properties };
}
