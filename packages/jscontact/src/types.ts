/**
 * The typed model of RFC 9553 JSContact, at version 2.0 (RFC 9982): a Card and every object
 * it holds. Each value is the JSON the document carries, so a parsed Card serializes back
 * unchanged, unknown and vendor properties included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The JSContact types under one import. */
export namespace JSContact {
	/**
	 * `A-Za-z0-9`, `-` and `_`, 1 to 255 octets: the keys of every map of objects, such as
	 * `emails` or `phones`.
	 */
	export type Id = string;

	/** `2022-09-30T14:35:10Z`: uppercase, always `Z`, fractional seconds only when non-zero. */
	export type UTCDateTime = string;

	/**
	 * A set of contexts such as `{ work: true }`; `private` and `work` are common to every
	 * object, and an Address adds `billing` and `delivery`.
	 */
	export type Contexts = Record<string, true>;

	/**
	 * A set of keys mapped to `true`, the form JSContact writes every set in.
	 *
	 * @template key - The values the set may hold.
	 */
	export type BooleanSet<key extends string = string> = Partial<Record<key, true>>;

	/**
	 * Patches keyed by a JSON Pointer without its leading `/`; `null` removes the property.
	 * A Card's `localizations` hold one per language.
	 */
	export type PatchObject = Record<string, unknown>;

	/** What a Card describes; a vendor value such as `example.com:robot` is kept as written. */
	export type Kind =
		| "individual"
		| "group"
		| "org"
		| "location"
		| "device"
		| "application"
		| (string & {});

	/** A contact card: a person, organization, group, place, device or application. */
	export interface Card {
		"@type": "Card";
		/** `2.0` for a Card this package writes; `1.0` Cards additionally require `uid`. */
		version: string;
		created?: UTCDateTime;
		/** @default "individual" */
		kind?: Kind;
		/** An RFC 5646 language tag for the Card's text, which `localizations` translate. */
		language?: string;
		/** The `uid` of each member of a `group` Card. */
		members?: BooleanSet;
		prodId?: string;
		/** Related Cards keyed by their `uid`. */
		relatedTo?: Record<string, Relation>;
		/** Optional since version 2.0; a Card without one cannot be a member or a relation. */
		uid?: string;
		updated?: UTCDateTime;
		name?: Name;
		nicknames?: Record<Id, Nickname>;
		organizations?: Record<Id, Organization>;
		speakToAs?: SpeakToAs;
		titles?: Record<Id, Title>;
		emails?: Record<Id, EmailAddress>;
		onlineServices?: Record<Id, OnlineService>;
		phones?: Record<Id, Phone>;
		preferredLanguages?: Record<Id, LanguagePref>;
		calendars?: Record<Id, Calendar>;
		schedulingAddresses?: Record<Id, SchedulingAddress>;
		addresses?: Record<Id, Address>;
		cryptoKeys?: Record<Id, CryptoKey>;
		directories?: Record<Id, Directory>;
		links?: Record<Id, Link>;
		media?: Record<Id, Media>;
		/** PatchObjects keyed by language tag; `localize` applies one. */
		localizations?: Record<string, PatchObject>;
		anniversaries?: Record<Id, Anniversary>;
		/** Free-text tags. */
		keywords?: BooleanSet;
		notes?: Record<Id, Note>;
		personalInfo?: Record<Id, PersonalInfo>;
		/**
		 * vCard properties a conversion found no JSContact counterpart for, as jCard
		 * properties (RFC 9555), so converting back restores them.
		 */
		vCardProps?: JCardProperty[];
		/** Any other property: an unknown IANA one, or a vendor one such as `example.com:foo`. */
		[property: string]: unknown;
	}

	/** One jCard property: name, parameters, value type, then one or more values. */
	export type JCardProperty = [string, Record<string, string | string[]>, string, ...unknown[]];

	/** How a related Card relates to this one. */
	export interface Relation {
		"@type"?: "Relation";
		/** Relation types such as `friend` or `colleague`; empty when unspecified. */
		relation?: BooleanSet<RelationType>;
		[property: string]: unknown;
	}

	/** The relation types RFC 9553 lists, taken from the vCard RELATED property. */
	export type RelationType =
		| "acquaintance"
		| "agent"
		| "child"
		| "co-resident"
		| "co-worker"
		| "colleague"
		| "contact"
		| "crush"
		| "date"
		| "emergency"
		| "friend"
		| "kin"
		| "me"
		| "met"
		| "muse"
		| "neighbor"
		| "parent"
		| "sibling"
		| "spouse"
		| "sweetheart"
		| (string & {});

	/** A name, as a full string, as components, or both. `components` or `full` is set. */
	export interface Name {
		"@type"?: "Name";
		components?: NameComponent[];
		/** Whether joining `components` in order, with separators, gives the full name. */
		isOrdered?: boolean;
		/** Inserted between ordered components that have no `separator` between them. */
		defaultSeparator?: string;
		full?: string;
		/** The string to sort by for each component kind. */
		sortAs?: Partial<Record<NameComponentKind, string>>;
		phoneticScript?: string;
		phoneticSystem?: PhoneticSystem;
		[property: string]: unknown;
	}

	/** One part of a name. */
	export interface NameComponent {
		"@type"?: "NameComponent";
		value: string;
		kind: NameComponentKind;
		phonetic?: string;
		[property: string]: unknown;
	}

	/** What a name component holds; `separator` only appears in an ordered name. */
	export type NameComponentKind =
		| "title"
		| "given"
		| "given2"
		| "surname"
		| "surname2"
		| "credential"
		| "generation"
		| "separator"
		| (string & {});

	/** The romanization a `phonetic` value is written in. */
	export type PhoneticSystem = "ipa" | "jyut" | "piny" | (string & {});

	/** A nickname, with the contexts it is used in. */
	export interface Nickname {
		"@type"?: "Nickname";
		name: string;
		contexts?: Contexts;
		pref?: number;
		[property: string]: unknown;
	}

	/** An organization and its units; `name` or `units` is set. */
	export interface Organization {
		"@type"?: "Organization";
		name?: string;
		/** Descending by hierarchy: a division before a department within it. */
		units?: OrgUnit[];
		sortAs?: string;
		contexts?: Contexts;
		[property: string]: unknown;
	}

	/** A unit of an organization, such as a division or department. */
	export interface OrgUnit {
		"@type"?: "OrgUnit";
		name: string;
		sortAs?: string;
		[property: string]: unknown;
	}

	/** How to address the entity; `grammaticalGender` or `pronouns` is set. */
	export interface SpeakToAs {
		"@type"?: "SpeakToAs";
		grammaticalGender?: GrammaticalGender;
		pronouns?: Record<Id, Pronouns>;
		[property: string]: unknown;
	}

	/** The grammatical gender of salutations, which says nothing of a person's gender. */
	export type GrammaticalGender =
		| "animate"
		| "common"
		| "feminine"
		| "inanimate"
		| "masculine"
		| "neuter"
		| (string & {});

	/** Pronouns the entity uses for itself, overridable per language in `localizations`. */
	export interface Pronouns {
		"@type"?: "Pronouns";
		pronouns: string;
		contexts?: Contexts;
		pref?: number;
		[property: string]: unknown;
	}

	/** A job title or a role, optionally held at one of the Card's organizations. */
	export interface Title {
		"@type"?: "Title";
		name: string;
		/** @default "title" */
		kind?: "title" | "role" | (string & {});
		/** The key of the organization in the Card's `organizations`. */
		organizationId?: Id;
		[property: string]: unknown;
	}

	/** An address to email the entity at. */
	export interface EmailAddress {
		"@type"?: "EmailAddress";
		/** An RFC 5322 `addr-spec`. */
		address: string;
		contexts?: Contexts;
		/** 1 to 100, 1 being most preferred; an unset `pref` is least preferred. */
		pref?: number;
		label?: string;
		[property: string]: unknown;
	}

	/** An account at a messaging or social service; `uri` or `user` is set. */
	export interface OnlineService {
		"@type"?: "OnlineService";
		/** Compared case-insensitively, such as `Mastodon`. */
		service?: string;
		uri?: string;
		user?: string;
		contexts?: Contexts;
		pref?: number;
		label?: string;
		[property: string]: unknown;
	}

	/** A number to reach the entity at, by voice, text, fax or the features it lists. */
	export interface Phone {
		"@type"?: "Phone";
		/** A `tel:` or `sip:` URI, or free text. */
		number: string;
		features?: BooleanSet<PhoneFeature>;
		contexts?: Contexts;
		pref?: number;
		label?: string;
		[property: string]: unknown;
	}

	/** What a number can be used for; an absent `features` says nothing. */
	export type PhoneFeature =
		| "mobile"
		| "voice"
		| "text"
		| "video"
		| "main-number"
		| "textphone"
		| "fax"
		| "pager"
		| (string & {});

	/** A language to contact the entity in, ranked by `pref` within its contexts. */
	export interface LanguagePref {
		"@type"?: "LanguagePref";
		/** An RFC 5646 language tag. */
		language: string;
		contexts?: Contexts;
		pref?: number;
		[property: string]: unknown;
	}

	/** The properties every resource shares: a URI and how to use it. */
	export interface Resource {
		kind?: string;
		uri: string;
		mediaType?: string;
		contexts?: Contexts;
		pref?: number;
		label?: string;
		[property: string]: unknown;
	}

	/** A calendar of the entity, or where to look up its free-busy time. */
	export interface Calendar extends Resource {
		"@type"?: "Calendar";
		kind: "calendar" | "freeBusy" | (string & {});
	}

	/** Where the entity receives calendar scheduling invitations. */
	export interface SchedulingAddress {
		"@type"?: "SchedulingAddress";
		uri: string;
		contexts?: Contexts;
		pref?: number;
		label?: string;
		[property: string]: unknown;
	}

	/**
	 * A postal address or a location; at least one of `components`, `coordinates`,
	 * `countryCode`, `full` or `timeZone` is set.
	 */
	export interface Address {
		"@type"?: "Address";
		components?: AddressComponent[];
		/** Whether joining `components` in order, with separators, gives the full address. */
		isOrdered?: boolean;
		/** ISO 3166-1 alpha-2. */
		countryCode?: string;
		/** A `geo:` URI. */
		coordinates?: string;
		/** An IANA Time Zone Database name. */
		timeZone?: string;
		contexts?: Contexts;
		full?: string;
		defaultSeparator?: string;
		pref?: number;
		phoneticScript?: string;
		phoneticSystem?: PhoneticSystem;
		[property: string]: unknown;
	}

	export interface AddressComponent {
		"@type"?: "AddressComponent";
		value: string;
		kind: AddressComponentKind;
		phonetic?: string;
		[property: string]: unknown;
	}

	/** What an address component holds; `name` is the street name. */
	export type AddressComponentKind =
		| "room"
		| "apartment"
		| "floor"
		| "building"
		| "number"
		| "name"
		| "block"
		| "subdistrict"
		| "district"
		| "locality"
		| "region"
		| "postcode"
		| "country"
		| "direction"
		| "landmark"
		| "postOfficeBox"
		| "separator"
		| (string & {});

	/** A public key or certificate of the entity, by URI or embedded as a `data:` URI. */
	export interface CryptoKey extends Resource {
		"@type"?: "CryptoKey";
	}

	/** A directory the entity is listed in (`directory`), or its entry there (`entry`). */
	export interface Directory extends Resource {
		"@type"?: "Directory";
		kind: "directory" | "entry" | (string & {});
		/** Position among directories of the same kind, from 1. */
		listAs?: number;
	}

	/** A resource no other property fits; `kind: "contact"` marks a way to reach the entity. */
	export interface Link extends Resource {
		"@type"?: "Link";
		/** `contact` for a URI the entity is reached at, such as a web form. */
		kind?: "contact" | (string & {});
	}

	/** A photo, logo or sound of the entity. */
	export interface Media extends Resource {
		"@type"?: "Media";
		kind: "photo" | "sound" | "logo" | (string & {});
	}

	/** A memorable date: a birth, death or wedding, with an optional place. */
	export interface Anniversary {
		"@type"?: "Anniversary";
		kind: "birth" | "death" | "wedding" | (string & {});
		date: PartialDate | Timestamp;
		place?: Address;
		[property: string]: unknown;
	}

	/** A Gregorian date with any of year, month and day; `month` needs `year` or `day`. */
	export interface PartialDate {
		"@type"?: "PartialDate";
		year?: number;
		month?: number;
		day?: number;
		/** A CLDR calendar name the date is meant in; the fields stay Gregorian. */
		calendarScale?: string;
		[property: string]: unknown;
	}

	/** An instant, which an Anniversary writes with `@type` since `PartialDate` is the default. */
	export interface Timestamp {
		"@type": "Timestamp";
		utc: UTCDateTime;
		[property: string]: unknown;
	}

	/** A free-text note about the entity. */
	export interface Note {
		"@type"?: "Note";
		note: string;
		created?: UTCDateTime;
		author?: Author;
		[property: string]: unknown;
	}

	/** Who wrote a note; `name` or `uri` is set. */
	export interface Author {
		"@type"?: "Author";
		name?: string;
		uri?: string;
		[property: string]: unknown;
	}

	/** An expertise, hobby or interest, with a level and list position. */
	export interface PersonalInfo {
		"@type"?: "PersonalInfo";
		kind: "expertise" | "hobby" | "interest" | (string & {});
		value: string;
		level?: "high" | "medium" | "low" | (string & {});
		/** Position among entries of the same kind, from 1. */
		listAs?: number;
		label?: string;
		[property: string]: unknown;
	}
}
