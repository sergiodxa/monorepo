/**
 * Reads an RDAP entity's contact card into one `RDAP.Contact`, whichever form the server
 * sent: a JSContact `jscontact_card` (draft-ietf-regext-rdap-jscontact) or a jCard
 * `vcardArray`, the latter converted to JSContact first so both read through one path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JSContact } from "@sdxc/jscontact";

import { fromVCard, readJCard } from "@sdxc/jscontact/vcard";
import { isSuccess } from "@sdxc/result";

import type { RDAP } from "./rdap.js";

/** The address component kinds that make up the street lines; the rest have their own field. */
const PLACE_KINDS = new Set(["locality", "region", "postcode", "country", "separator"]);

/** The card's kind when it is one a contact can be, a person or an organization. */
function kindOf(kind: unknown): RDAP.Contact["kind"] {
	return kind === "org" || kind === "individual" ? kind : null;
}

/** Whether a value is a plain JSON object. */
function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A trimmed string, or `null` for anything else or the empty value a redaction leaves. */
function text(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** The values of a map of objects, the shape every JSContact collection takes. */
function entries(value: unknown): Record<string, unknown>[] {
	return isObject(value) ? Object.values(value).filter(isObject) : [];
}

/**
 * The contact card an entity carries, as JSContact. A `jscontact_card` is read as sent, so a
 * card failing strict validation still yields its fields; a jCard is converted to JSContact.
 *
 * @param entity - The entity object from the response
 * @returns The card, or `null` when the entity carries none or it is not a card
 */
export function entityCard(entity: Record<string, unknown>): JSContact.Card | null {
	if (isObject(entity.jscontact_card)) return entity.jscontact_card as JSContact.Card;
	if (entity.vcardArray === undefined) return null;
	let jcard = readJCard(entity.vcardArray);
	return isSuccess(jcard) ? fromVCard(jcard.data) : null;
}

/** The street, locality, region, postal code and country of the card's preferred address. */
function addressOf(card: JSContact.Card): RDAP.Address | null {
	let all = isObject(card.addresses) ? card.addresses : {};
	let preferred = isObject(all.addr) ? all.addr : entries(all)[0];
	if (preferred === undefined) return null;
	let components = Array.isArray(preferred.components) ? preferred.components.filter(isObject) : [];
	let first = (kind: string) =>
		text(components.find((component) => component.kind === kind)?.value);
	let address: RDAP.Address = {
		full: text(preferred.full),
		street: components
			.filter((component) => typeof component.kind === "string" && !PLACE_KINDS.has(component.kind))
			.flatMap((component) => text(component.value) ?? []),
		locality: first("locality"),
		region: first("region"),
		postcode: first("postcode"),
		country: first("country"),
		countryCode: text(preferred.countryCode),
	};
	let empty = Object.values(address).every(
		(value) => value === null || (Array.isArray(value) && value.length === 0),
	);
	return empty ? null : address;
}

/**
 * Normalizes one entity. Every text field reads `null`, and every list empty, when the server
 * left it out or emptied it; `isRedacted` tells which of those the server withheld.
 *
 * @param entity - The entity object from the response
 * @returns The contact
 */
export function toContact(entity: Record<string, unknown>): RDAP.Contact {
	let roles = Array.isArray(entity.roles)
		? entity.roles.flatMap((role) => (typeof role === "string" ? [role.toLowerCase()] : []))
		: [];
	let card = entityCard(entity);
	let name = card?.name;
	let fullName =
		text(name?.full) ??
		text(
			(Array.isArray(name?.components) ? name.components : [])
				.filter((component) => isObject(component) && component.kind !== "separator")
				.map((component) => component.value)
				.join(" "),
		);
	let phones = entries(card?.phones);
	let isFax = (phone: Record<string, unknown>) =>
		isObject(phone.features) && phone.features.fax === true;
	let links = entries(card?.links);

	return {
		roles,
		handle: text(entity.handle),
		kind: kindOf(card?.kind),
		name: fullName,
		organization:
			entries(card?.organizations)
				.map((organization) => text(organization.name))
				.find(Boolean) ?? null,
		emails: entries(card?.emails).flatMap((email) => text(email.address) ?? []),
		phones: phones.filter((phone) => !isFax(phone)).flatMap((phone) => text(phone.number) ?? []),
		faxes: phones.filter(isFax).flatMap((phone) => text(phone.number) ?? []),
		address: card ? addressOf(card) : null,
		contactUri:
			links
				.filter((link) => link.kind === "contact")
				.map((link) => text(link.uri))
				.find(Boolean) ?? null,
		url:
			links
				.filter((link) => link.kind === undefined)
				.map((link) => text(link.uri))
				.find(Boolean) ?? null,
		card,
	};
}

/**
 * Every entity of a response and the entities nested in them, depth first, so the
 * registrar's abuse contact follows the registrar.
 *
 * @param entities - The response's `entities` member, as sent
 * @returns The contacts, in the order the response lists them
 */
export function contacts(entities: unknown): RDAP.Contact[] {
	if (!Array.isArray(entities)) return [];
	return entities
		.filter(isObject)
		.flatMap((entity) => [toContact(entity), ...contacts(entity.entities)]);
}
