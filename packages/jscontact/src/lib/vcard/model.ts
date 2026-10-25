/**
 * The in-memory vCard: the jCard shape of RFC 7095, which vCard text and jCard JSON both read
 * into. Values keep jCard's extended date format and structured arrays, so a card converts
 * to JSContact the same way whichever form it arrived in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { VCardParseError } from "../errors.js";

/** One vCard: its properties in order, `version` included. */
export interface VCard {
	properties: VCardProperty[];
}

/** A property value: text, a number or boolean, or a structured value of components. */
export type VCardValue = string | number | boolean | null | VCardValue[];

/** One property, as jCard writes it. */
export interface VCardProperty {
	/** Lowercase, such as `fn` or `x-ablabel`. */
	name: string;
	/** Lowercase names; a list parameter such as `type` holds an array. `group` holds the property group. */
	parameters: Record<string, string | string[]>;
	/** The lowercase value type, such as `text`, `uri` or `date-and-or-time`; `unknown` when none applies. */
	type: string;
	/** One value, or several for a list property such as `categories`. */
	values: VCardValue[];
}

/** A jCard document: `["vcard", [property, …]]`. */
export type JCard = ["vcard", JCardProperty[]];

/** A jCard property: name, parameters, value type, then the values. */
export type JCardProperty = [string, Record<string, string | string[]>, string, ...VCardValue[]];

/** The value type each property has when no `VALUE` parameter says otherwise (RFC 6350 and its extensions). */
export const DEFAULT_TYPES: Record<string, string> = {
	source: "uri",
	kind: "text",
	xml: "text",
	fn: "text",
	n: "text",
	nickname: "text",
	photo: "uri",
	bday: "date-and-or-time",
	anniversary: "date-and-or-time",
	gender: "text",
	adr: "text",
	tel: "text",
	email: "text",
	impp: "uri",
	lang: "language-tag",
	tz: "text",
	geo: "uri",
	title: "text",
	role: "text",
	logo: "uri",
	org: "text",
	member: "uri",
	related: "uri",
	categories: "text",
	note: "text",
	prodid: "text",
	rev: "timestamp",
	sound: "uri",
	uid: "uri",
	clientpidmap: "text",
	url: "uri",
	version: "text",
	key: "uri",
	fburl: "uri",
	caladruri: "uri",
	caluri: "uri",
	birthplace: "text",
	deathplace: "text",
	deathdate: "date-and-or-time",
	expertise: "text",
	hobby: "text",
	interest: "text",
	"org-directory": "uri",
	"contact-uri": "uri",
	created: "timestamp",
	gramgender: "text",
	language: "language-tag",
	pronouns: "text",
	socialprofile: "uri",
	jsprop: "text",
	"x-ablabel": "text",
};

/** Properties whose text value is structured into `;`-separated components. */
export const STRUCTURED = new Set(["n", "adr", "org", "gender", "clientpidmap"]);

/** Properties whose text value is a `,`-separated list of values. */
export const LISTS = new Set(["categories", "nickname"]);

/**
 * Reads a jCard document. A property that is not `[name, parameters, type, value, …]` is
 * skipped, so one malformed entry does not hide the rest of the card.
 *
 * @param json - The parsed jCard, e.g. an RDAP entity's `vcardArray`
 * @returns The card, or why the value is not a jCard at all
 * @example readJCard(["vcard", [["fn", {}, "text", "Joe User"]]]);
 */
export function readJCard(json: unknown): Result<VCard, VCardParseError> {
	if (!Array.isArray(json) || json[0] !== "vcard" || !Array.isArray(json[1])) {
		return failure(new VCardParseError('A jCard is ["vcard", [properties]]'));
	}
	let properties: VCardProperty[] = [];
	for (let entry of json[1] as unknown[]) {
		if (!Array.isArray(entry) || entry.length < 4) continue;
		let [name, parameters, type, ...values] = entry as unknown[];
		if (typeof name !== "string" || typeof type !== "string") continue;
		if (typeof parameters !== "object" || parameters === null || Array.isArray(parameters))
			continue;
		properties.push({
			name: name.toLowerCase(),
			parameters: lowercaseKeys(parameters as Record<string, string | string[]>),
			type: type.toLowerCase(),
			values: values as VCardValue[],
		});
	}
	return success({ properties });
}

/**
 * Writes a card as a jCard document, `version` first as RFC 7095 requires.
 *
 * @param card - The card
 * @returns The jCard, ready for `JSON.stringify`
 */
export function writeJCard(card: VCard): JCard {
	let rest = card.properties.filter((property) => property.name !== "version");
	return [
		"vcard",
		[
			["version", {}, "text", "4.0"],
			...rest.map((property): JCardProperty => [
				property.name,
				property.parameters,
				property.type,
				...property.values,
			]),
		],
	];
}

/** A copy of a parameter object with lowercase names, as jCard requires. */
function lowercaseKeys(
	parameters: Record<string, string | string[]>,
): Record<string, string | string[]> {
	let result: Record<string, string | string[]> = {};
	for (let [key, value] of Object.entries(parameters)) result[key.toLowerCase()] = value;
	return result;
}

/**
 * The values of a parameter, a list parameter split into its items.
 *
 * @param property - The property
 * @param name - The lowercase parameter name
 * @returns The values, empty when the parameter is absent
 */
export function parameterValues(property: VCardProperty, name: string): string[] {
	let value = property.parameters[name];
	if (value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

/**
 * A parameter's single value.
 *
 * @param property - The property
 * @param name - The lowercase parameter name
 * @returns The first value, or `undefined` when the parameter is absent
 */
export function parameter(property: VCardProperty, name: string): string | undefined {
	return parameterValues(property, name)[0];
}
