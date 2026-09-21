/**
 * What a verified response answers with. It is built from the one element the
 * signature covered, holds no reference to the document it came out of, and is
 * the only place claims are readable from, so reading an unsigned element is
 * not a thing a caller can express.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Element } from "./lib/tree.js";

import { ASSERTION_NS } from "./lib/namespaces.js";
import { attribute, child, children, text } from "./lib/tree.js";

/**
 * Groups the types a caller names when it handles a verified assertion.
 */
export namespace Assertion {
	/**
	 * The subject's identifier as the provider wrote it. The format matters
	 * because a transient identifier names a session rather than a person, and
	 * linking one to an account outlives the value's own meaning.
	 */
	export interface NameId {
		value: string;
		format: string | null;
	}
}

/**
 * One verified assertion.
 *
 * Every value on it came out of the element the signature covered. Instances
 * arrive from a verification and are never constructed by a caller, which is
 * what makes "this claim was signed" true of the whole object.
 *
 * @example
 * let email = assertion.attribute("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");
 */
export class Assertion {
	/** The assertion's own id, and the value a replay store remembers. */
	readonly id: string;

	/** The provider that issued it, as its `Issuer` element names itself. */
	readonly issuer: string;

	/** The subject's identifier, where the assertion carries one. */
	readonly nameId: Assertion.NameId | null;

	/**
	 * The provider's name for this session, which is what a later single logout
	 * or session query would name back to it.
	 */
	readonly sessionIndex: string | null;

	/** When the provider authenticated the subject. */
	readonly authnInstant: Date | null;

	/**
	 * The moment this assertion stops applying, taken as the earliest the
	 * document offered, so the shortest window any part of it named is the one
	 * that governs.
	 */
	readonly notOnOrAfter: Date;

	/** Attribute values by `Name`, and again by `FriendlyName` where one differs. */
	readonly #attributes: ReadonlyMap<string, readonly string[]>;

	/**
	 * @param fields Values already read off the verified element.
	 */
	private constructor(fields: {
		id: string;
		issuer: string;
		nameId: Assertion.NameId | null;
		sessionIndex: string | null;
		authnInstant: Date | null;
		notOnOrAfter: Date;
		attributes: ReadonlyMap<string, readonly string[]>;
	}) {
		this.id = fields.id;
		this.issuer = fields.issuer;
		this.nameId = fields.nameId;
		this.sessionIndex = fields.sessionIndex;
		this.authnInstant = fields.authnInstant;
		this.notOnOrAfter = fields.notOnOrAfter;
		this.#attributes = fields.attributes;
	}

	/**
	 * Reads one assertion out of the element a signature covered.
	 *
	 * @param element - The verified `saml:Assertion`
	 * @param id - The assertion id, already read and checked
	 * @param issuer - The issuer, already read and checked
	 * @param notOnOrAfter - The narrowest expiry the document named
	 */
	static read(element: Element, id: string, issuer: string, notOnOrAfter: Date): Assertion {
		let statement = child(element, ASSERTION_NS, "AuthnStatement");
		let instant = statement ? attribute(statement, "AuthnInstant") : undefined;
		let authnInstant = instant ? new Date(instant) : null;

		return new Assertion({
			id,
			issuer,
			nameId: readNameId(element),
			sessionIndex: statement ? (attribute(statement, "SessionIndex") ?? null) : null,
			authnInstant: authnInstant && !Number.isNaN(authnInstant.getTime()) ? authnInstant : null,
			notOnOrAfter,
			attributes: readAttributes(element),
		});
	}

	/**
	 * The first value of one attribute, by `Name` or by `FriendlyName`.
	 *
	 * @param name - Attribute name as the provider writes it
	 * @returns The first value, or `null` where the assertion carries none
	 */
	attribute(name: string): string | null {
		return this.#attributes.get(name)?.[0] ?? null;
	}

	/**
	 * Every value of one attribute, for the multi-valued ones a directory sends
	 * group memberships and roles as.
	 *
	 * @param name - Attribute name as the provider writes it
	 * @returns The values in document order, empty where the assertion carries none
	 */
	values(name: string): readonly string[] {
		return this.#attributes.get(name) ?? [];
	}

	/** Every attribute name this assertion answers to, in document order. */
	names(): string[] {
		return [...this.#attributes.keys()];
	}

	/**
	 * Every attribute as one record, which is the shape a mapping from provider
	 * attributes to account fields reads. A single-valued attribute is its
	 * value; a repeated one is the list.
	 */
	claims(): Record<string, string | string[]> {
		let claims: Record<string, string | string[]> = {};
		for (let [name, values] of this.#attributes) {
			claims[name] = values.length === 1 ? (values[0] ?? "") : [...values];
		}
		return claims;
	}
}

/**
 * Reads the subject's identifier, which SAML allows an assertion to leave out
 * when its attributes carry the identity instead.
 */
function readNameId(element: Element): Assertion.NameId | null {
	let subject = child(element, ASSERTION_NS, "Subject");
	let nameId = subject ? child(subject, ASSERTION_NS, "NameID") : undefined;
	if (!nameId) return null;

	let value = text(nameId).trim();
	if (value === "") return null;

	return { value, format: attribute(nameId, "Format") ?? null };
}

/**
 * Indexes the attribute statements by both names a provider may be configured
 * to send, so a mapping written against either one resolves. The formal `Name`
 * is indexed last and wins, since it is the one a provider guarantees.
 */
function readAttributes(element: Element): ReadonlyMap<string, readonly string[]> {
	let indexed = new Map<string, string[]>();

	for (let statement of children(element, ASSERTION_NS, "AttributeStatement")) {
		for (let attributeElement of children(statement, ASSERTION_NS, "Attribute")) {
			let values = children(attributeElement, ASSERTION_NS, "AttributeValue").map((value) =>
				text(value).trim(),
			);

			let friendly = attribute(attributeElement, "FriendlyName");
			let name = attribute(attributeElement, "Name");

			if (friendly) indexed.set(friendly, [...(indexed.get(friendly) ?? []), ...values]);
			if (name) indexed.set(name, [...(indexed.get(name) ?? []), ...values]);
		}
	}

	return indexed;
}
