/**
 * The examples of RFC 9553: the basic Card of Figure 6, and the property examples of
 * §2 gathered into Cards, so validation is held to the specification's own documents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Figure 6: a basic Card, at version 1.0 with its then-mandatory `uid`. */
export const BASIC_CARD = {
	"@type": "Card",
	version: "1.0",
	uid: "22B2C7DF-9120-4969-8460-05956FE6B065",
	kind: "individual",
	name: {
		components: [
			{ kind: "given", value: "John" },
			{ kind: "surname", value: "Doe" },
		],
		isOrdered: true,
	},
};

/** Figure 11: a group Card with members. */
export const GROUP_CARD = {
	"@type": "Card",
	version: "2.0",
	kind: "group",
	name: { full: "The Doe family" },
	uid: "urn:uuid:ab4310aa-fa43-11e9-8f0b-362b9e155667",
	members: {
		"urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af": true,
		"urn:uuid:b8767877-b4a1-4c70-9acc-505d3819e519": true,
	},
};

/** Figures 7 to 44 with no conflicting keys, gathered into one Card. */
export const PROPERTY_EXAMPLES = {
	"@type": "Card",
	version: "2.0",
	created: "2022-09-30T14:35:10Z",
	kind: "individual",
	language: "de-AT",
	prodId: "ACME Contacts App version 1.23.5",
	relatedTo: {
		"urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6": { relation: { friend: true } },
		"8cacdfb7d1ffdb59@example.com": { relation: {} },
	},
	uid: "urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
	updated: "2021-10-31T22:27:10Z",
	name: {
		components: [
			{ kind: "given", value: "Robert" },
			{ kind: "given2", value: "Pau" },
			{ kind: "surname", value: "Shou Chang" },
		],
		sortAs: { surname: "Pau Shou Chang", given: "Robert" },
		isOrdered: true,
	},
	nicknames: { k391: { name: "Johnny" } },
	organizations: {
		o1: {
			name: "ABC, Inc.",
			units: [{ name: "North American Division" }, { name: "Marketing" }],
			sortAs: "ABC",
		},
		o2: { name: "ABC, Inc." },
	},
	speakToAs: {
		grammaticalGender: "neuter",
		pronouns: { k19: { pronouns: "they/them", pref: 2 }, k32: { pronouns: "xe/xir", pref: 1 } },
	},
	titles: {
		le9: { kind: "title", name: "Research Scientist" },
		k2: { kind: "role", name: "Project Leader", organizationId: "o2" },
	},
	emails: {
		e1: { contexts: { work: true }, address: "jqpublic@xyz.example.com" },
		e2: { address: "jane_doe@example.com", pref: 1 },
	},
	onlineServices: {
		x1: { uri: "xmpp:alice@example.com" },
		x2: { service: "Mastodon", user: "@alice@example2.com", uri: "https://example2.com/@alice" },
	},
	phones: {
		tel0: {
			contexts: { private: true },
			features: { voice: true },
			number: "tel:+1-555-555-5555;ext=5555",
			pref: 1,
		},
		tel3: { contexts: { work: true }, number: "tel:+1-201-555-0123" },
	},
	preferredLanguages: {
		l1: { language: "en", contexts: { work: true }, pref: 1 },
		l2: { language: "fr", contexts: { work: true }, pref: 2 },
		l3: { language: "fr", contexts: { private: true } },
	},
	calendars: {
		calA: { kind: "calendar", uri: "webcal://calendar.example.com/calA.ics" },
		"project-a": { kind: "freeBusy", uri: "https://calendar.example.com/busy/project-a" },
	},
	schedulingAddresses: { sched1: { uri: "mailto:janedoe@example.com" } },
	addresses: {
		k23: {
			contexts: { work: true },
			components: [
				{ kind: "number", value: "54321" },
				{ kind: "separator", value: " " },
				{ kind: "name", value: "Oak St" },
				{ kind: "locality", value: "Reston" },
				{ kind: "region", value: "VA" },
				{ kind: "separator", value: " " },
				{ kind: "postcode", value: "20190" },
				{ kind: "country", value: "USA" },
			],
			countryCode: "US",
			defaultSeparator: ", ",
			isOrdered: true,
		},
	},
	cryptoKeys: { mykey1: { uri: "https://www.example.com/keys/jdoe.cer" } },
	directories: {
		dir1: { kind: "entry", uri: "https://dir.example.com/addrbook/jdoe/Jean%20Dupont.vcf" },
		dir2: {
			kind: "directory",
			uri: "ldap://ldap.example/o=Example%20Tech,ou=Engineering",
			pref: 1,
		},
	},
	links: { link3: { kind: "contact", uri: "mailto:contact@example.com", pref: 1 } },
	media: {
		res45: { kind: "sound", uri: "CID:JOHNQ.part8.19960229T080000.xyzMail@example.com" },
		res47: { kind: "logo", uri: "https://www.example.com/pub/logos/abccorp.jpg" },
	},
	anniversaries: {
		k8: { kind: "birth", date: { year: 1953, month: 4, day: 15 } },
		k9: {
			kind: "death",
			date: { "@type": "Timestamp", utc: "2019-10-15T23:10:00Z" },
			place: { full: "4445 Tree Street\nNew England, ND 58647\nUSA" },
		},
	},
	keywords: { internet: true, IETF: true },
	notes: {
		n1: {
			note: "Open office hours are 1600 to 1715 EST, Mon-Fri",
			created: "2022-11-23T15:01:32Z",
			author: { name: "John" },
		},
	},
	personalInfo: {
		pi2: { kind: "expertise", value: "chemistry", level: "high" },
		pi1: { kind: "hobby", value: "reading", level: "high" },
		pi6: { kind: "interest", value: "r&b music", level: "medium" },
	},
	"example.com:foo": "bar",
	"example.com:foo2": { bar: "baz" },
};

/** Figure 39: a name localized in Ukrainian with Cyrillic script. */
export const LOCALIZED_NAME = {
	"@type": "Card",
	version: "2.0",
	name: {
		components: [
			{ kind: "title", value: "Mr." },
			{ kind: "given", value: "Ivan" },
			{ kind: "given2", value: "Petrovich" },
			{ kind: "surname", value: "Vasiliev" },
		],
	},
	localizations: {
		"uk-Cyrl": {
			name: {
				components: [
					{ kind: "title", value: "г-н" },
					{ kind: "given", value: "Иван" },
					{ kind: "given2", value: "Петрович" },
					{ kind: "surname", value: "Васильев" },
				],
			},
		},
	},
};

/** Figure 40: a title localized by patching inside the titles map. */
export const LOCALIZED_TITLE = {
	"@type": "Card",
	version: "2.0",
	name: { full: "Gabriel García Márquez" },
	titles: { t1: { kind: "title", name: "novelist" } },
	localizations: { es: { "titles/t1/name": "escritor" } },
};
