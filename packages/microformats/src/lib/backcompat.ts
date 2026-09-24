/**
 * The classic microformats vocabularies the parsing specification maps onto
 * microformats2: each classic root's mf2 type, the property its classic class names
 * become, and the `rel` values some of them read as properties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The four property kinds, by the prefix microformats2 writes them with. */
export type PropertyKind = "p" | "u" | "dt" | "e";

/** One mf2 property a classic class name stands for. */
export interface ClassicProperty {
	kind: PropertyKind;
	name: string;
	/**
	 * The classic vocabulary an element carrying this class is read as, when the class
	 * itself implies a nested item (`author` inside `hentry` is an `h-card`).
	 */
	nested?: string;
}

/** A classic root: the mf2 type it is read as and the classes it maps. */
export interface ClassicVocabulary {
	type: string;
	properties: Record<string, ClassicProperty[]>;
	/** `rel` values read as a property on the link carrying them. */
	rels?: Record<string, ClassicProperty>;
}

/** Shorthand for a single-property mapping. */
function map(kind: PropertyKind, name: string, nested?: string): ClassicProperty[] {
	return nested === undefined ? [{ kind, name }] : [{ kind, name, nested }];
}

/** `rel=tag`, which every vocabulary that has categories reads as one. */
const TAG_REL: Record<string, ClassicProperty> = { tag: { kind: "p", name: "category" } };

/** The classic properties of an address, shared by `vcard` and `adr`. */
const ADR_PROPERTIES: Record<string, ClassicProperty[]> = {
	"post-office-box": map("p", "post-office-box"),
	"extended-address": map("p", "extended-address"),
	"street-address": map("p", "street-address"),
	locality: map("p", "locality"),
	region: map("p", "region"),
	"postal-code": map("p", "postal-code"),
	"country-name": map("p", "country-name"),
};

/**
 * Every classic vocabulary by its root class name. `item` is the one entry that is not
 * a root on its own: it is the vocabulary of the thing an `hreview` reviews.
 */
export const CLASSIC_VOCABULARIES: Record<string, ClassicVocabulary> = {
	vcard: {
		type: "h-card",
		properties: {
			...ADR_PROPERTIES,
			fn: map("p", "name"),
			"honorific-prefix": map("p", "honorific-prefix"),
			"given-name": map("p", "given-name"),
			"additional-name": map("p", "additional-name"),
			"family-name": map("p", "family-name"),
			"honorific-suffix": map("p", "honorific-suffix"),
			nickname: map("p", "nickname"),
			email: map("u", "email"),
			logo: map("u", "logo"),
			photo: map("u", "photo"),
			url: map("u", "url"),
			uid: map("u", "uid"),
			category: map("p", "category"),
			adr: map("p", "adr", "adr"),
			label: map("p", "label"),
			geo: map("p", "geo", "geo"),
			latitude: map("p", "latitude"),
			longitude: map("p", "longitude"),
			tel: map("p", "tel"),
			note: map("p", "note"),
			bday: map("dt", "bday"),
			key: map("p", "key"),
			sound: map("u", "sound"),
			mailer: map("p", "mailer"),
			agent: map("p", "agent"),
			"sort-string": map("p", "sort-string"),
			class: map("p", "class"),
			org: map("p", "org"),
			"organization-name": map("p", "organization-name"),
			"organization-unit": map("p", "organization-unit"),
			title: map("p", "job-title"),
			role: map("p", "role"),
			tz: map("p", "tz"),
			rev: map("dt", "rev"),
		},
	},
	hfeed: {
		type: "h-feed",
		properties: {
			author: map("p", "author", "vcard"),
			url: map("u", "url"),
			photo: map("u", "photo"),
			category: map("p", "category"),
		},
		rels: TAG_REL,
	},
	hentry: {
		type: "h-entry",
		properties: {
			"entry-title": map("p", "name"),
			"entry-summary": map("p", "summary"),
			"entry-content": map("e", "content"),
			published: map("dt", "published"),
			updated: map("dt", "updated"),
			author: map("p", "author", "vcard"),
			category: map("p", "category"),
			geo: map("p", "geo", "geo"),
			latitude: map("p", "latitude"),
			longitude: map("p", "longitude"),
		},
		rels: { ...TAG_REL, bookmark: { kind: "u", name: "url" } },
	},
	hrecipe: {
		type: "h-recipe",
		properties: {
			fn: map("p", "name"),
			ingredient: map("p", "ingredient"),
			yield: map("p", "yield"),
			instructions: map("e", "instructions"),
			duration: map("dt", "duration"),
			photo: map("u", "photo"),
			summary: map("p", "summary"),
			author: map("p", "author", "vcard"),
			nutrition: map("p", "nutrition"),
			category: map("p", "category"),
		},
		rels: TAG_REL,
	},
	hresume: {
		type: "h-resume",
		properties: {
			summary: map("p", "summary"),
			contact: map("p", "contact", "vcard"),
			education: map("p", "education", "vevent"),
			experience: map("p", "experience", "vevent"),
			skill: map("p", "skill"),
			affiliation: map("p", "affiliation", "vcard"),
		},
	},
	vevent: {
		type: "h-event",
		properties: {
			summary: map("p", "name"),
			dtstart: map("dt", "start"),
			dtend: map("dt", "end"),
			duration: map("dt", "duration"),
			description: map("p", "description"),
			url: map("u", "url"),
			category: map("p", "category"),
			location: map("p", "location"),
			geo: map("p", "location", "geo"),
			attendee: map("p", "attendee", "vcard"),
			contact: map("p", "contact", "vcard"),
			organizer: map("p", "organizer", "vcard"),
		},
		rels: TAG_REL,
	},
	hreview: {
		type: "h-review",
		properties: {
			summary: map("p", "name"),
			item: map("p", "item", "item"),
			reviewer: map("p", "author", "vcard"),
			dtreviewed: map("dt", "published"),
			rating: map("p", "rating"),
			best: map("p", "best"),
			worst: map("p", "worst"),
			description: map("e", "content"),
			category: map("p", "category"),
		},
		rels: { ...TAG_REL, "self bookmark": { kind: "u", name: "url" } },
	},
	"hreview-aggregate": {
		type: "h-review-aggregate",
		properties: {
			summary: map("p", "name"),
			item: map("p", "item", "item"),
			rating: map("p", "rating"),
			best: map("p", "best"),
			worst: map("p", "worst"),
			average: map("p", "average"),
			count: map("p", "count"),
			votes: map("p", "votes"),
		},
		rels: TAG_REL,
	},
	hproduct: {
		type: "h-product",
		properties: {
			fn: map("p", "name"),
			photo: map("u", "photo"),
			brand: map("p", "brand"),
			category: map("p", "category"),
			description: map("p", "description"),
			identifier: map("u", "identifier"),
			url: map("u", "url"),
			review: map("p", "review", "hreview"),
			price: map("p", "price"),
		},
		rels: TAG_REL,
	},
	hnews: {
		type: "h-news",
		properties: {
			entry: map("p", "entry", "hentry"),
			"source-org": map("p", "source-org", "vcard"),
			dateline: map("p", "dateline", "vcard"),
			geo: map("p", "geo", "geo"),
		},
		rels: {
			principles: { kind: "u", name: "principles" },
			"item-license": { kind: "u", name: "item-license" },
		},
	},
	adr: { type: "h-adr", properties: ADR_PROPERTIES },
	geo: {
		type: "h-geo",
		properties: { latitude: map("p", "latitude"), longitude: map("p", "longitude") },
	},
	item: {
		type: "h-item",
		properties: { fn: map("p", "name"), url: map("u", "url"), photo: map("u", "photo") },
	},
};

/** The classic class names that start an item on their own, `item` excluded. */
export const CLASSIC_ROOTS: ReadonlySet<string> = new Set(
	Object.keys(CLASSIC_VOCABULARIES).filter((name) => name !== "item"),
);
