/**
 * The conversion examples of RFC 9555 §2 (as carried into draft-ietf-calext-rfc9555bis), each
 * a vCard extract and the Card properties it converts to. Map keys follow the figures; where a
 * figure picks a free-form key, the key is the `<PREFIX>-<n>` this package generates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One figure: the vCard content lines and the Card members they convert to. */
export interface ConversionExample {
	figure: string;
	vcard: string[];
	card: Record<string, unknown>;
}

/** The vCard → JSContact figures, in the order the document lists them. */
export const VCARD_TO_JSCONTACT: ConversionExample[] = [
	{
		figure: "Figure 8: LANGUAGE, one dominant language",
		vcard: [
			"FN;LANGUAGE=EN:John Doe",
			"TITLE;ALTID=1;LANGUAGE=EN:Boss",
			"TITLE;ALTID=1;LANGUAGE=fr:Patron",
		],
		card: {
			language: "en",
			name: { full: "John Doe" },
			titles: { "TITLE-1": { kind: "title", name: "Boss" } },
			localizations: { fr: { "titles/TITLE-1/name": "Patron" } },
		},
	},
	{
		figure: "Figure 9: LANGUAGE, a property without language",
		vcard: ["FN:John Doe", "TITLE;ALTID=1:Boss", "TITLE;ALTID=1;LANGUAGE=fr:Patron"],
		card: {
			name: { full: "John Doe" },
			titles: { "TITLE-1": { kind: "title", name: "Boss" } },
			localizations: { fr: { "titles/TITLE-1/name": "Patron" } },
		},
	},
	{
		figure: "Figure 10: PHONETIC",
		vcard: [
			"LANGUAGE:zh-Hant",
			"FN:孫中山文逸仙",
			"N;ALTID=1;LANGUAGE=zh-Hant:孫;中山;文,逸仙;;",
			"N;ALTID=1;PHONETIC=jyut;SCRIPT=Latn;LANGUAGE=yue:syun1;zung1saan1;man4,jat6sin1;;",
		],
		card: {
			language: "zh-Hant",
			name: {
				full: "孫中山文逸仙",
				components: [
					{ kind: "surname", value: "孫" },
					{ kind: "given", value: "中山" },
					{ kind: "given2", value: "文" },
					{ kind: "given2", value: "逸仙" },
				],
			},
			localizations: {
				yue: {
					"name/phoneticSystem": "jyut",
					"name/phoneticScript": "Latn",
					"name/components/0/phonetic": "syun1",
					"name/components/1/phonetic": "zung1saan1",
					"name/components/2/phonetic": "man4",
					"name/components/3/phonetic": "jat6sin1",
				},
			},
		},
	},
	{
		figure: "Figure 11: PROP-ID",
		vcard: ["TEL;PROP-ID=xyz;VALUE=uri:tel:+1-555-555-5555;ext=5555"],
		card: { phones: { xyz: { number: "tel:+1-555-555-5555;ext=5555" } } },
	},
	{
		figure: "Figure 12: ADR",
		vcard: ["ADR;TYPE=work;CC=US:;;54321 Oak St;Reston;VA;20190;USA;;;;54321;Oak St;;;;;;"],
		card: {
			addresses: {
				"ADDR-1": {
					contexts: { work: true },
					components: [
						{ kind: "number", value: "54321" },
						{ kind: "name", value: "Oak St" },
						{ kind: "locality", value: "Reston" },
						{ kind: "region", value: "VA" },
						{ kind: "postcode", value: "20190" },
						{ kind: "country", value: "USA" },
					],
					countryCode: "US",
				},
			},
		},
	},
	{
		figure: "Figure 13: ANNIVERSARY",
		vcard: ["ANNIVERSARY:19860201"],
		card: {
			anniversaries: {
				"ANNIVERSARY-1": { kind: "wedding", date: { year: 1986, month: 2, day: 1 } },
			},
		},
	},
	{
		figure: "Figure 14: BDAY and BIRTHPLACE",
		vcard: [
			"BDAY:19531015T231000Z",
			"BIRTHPLACE:",
			" 123 Main Street\\nAny Town, CA 91921-1234\\nU.S.A.",
		],
		card: {
			anniversaries: {
				"ANNIVERSARY-1": {
					kind: "birth",
					date: { "@type": "Timestamp", utc: "1953-10-15T23:10:00Z" },
					place: { full: "123 Main Street\nAny Town, CA 91921-1234\nU.S.A." },
				},
			},
		},
	},
	{
		figure: "Figure 15: CALADRURI",
		vcard: [
			"CALADRURI;PREF=1:mailto:janedoe@example.com",
			"CALADRURI:https://example.com/calendar/jdoe",
		],
		card: {
			schedulingAddresses: {
				"SCHEDULING-1": { uri: "mailto:janedoe@example.com", pref: 1 },
				"SCHEDULING-2": { uri: "https://example.com/calendar/jdoe" },
			},
		},
	},
	{
		figure: "Figure 16: CALURI",
		vcard: [
			"CALURI;PREF=1:https://cal.example.com/calA",
			"CALURI;MEDIATYPE=text/calendar:https://ftp.example.com/calA.ics",
		],
		card: {
			calendars: {
				"CAL-1": { kind: "calendar", uri: "https://cal.example.com/calA", pref: 1 },
				"CAL-2": {
					kind: "calendar",
					uri: "https://ftp.example.com/calA.ics",
					mediaType: "text/calendar",
				},
			},
		},
	},
	{
		figure: "Figure 17: CATEGORIES",
		vcard: ["CATEGORIES:internet,IETF,Industry,Information Technology"],
		card: {
			keywords: { internet: true, IETF: true, Industry: true, "Information Technology": true },
		},
	},
	{
		figure: "Figure 18: CONTACT-URI",
		vcard: ["CONTACT-URI;PREF=1:mailto:contact@example.com"],
		card: {
			links: { "CONTACT-1": { kind: "contact", uri: "mailto:contact@example.com", pref: 1 } },
		},
	},
	{
		figure: "Figure 19: CREATED",
		vcard: ["CREATED:19940930T143510Z"],
		card: { created: "1994-09-30T14:35:10Z" },
	},
	{
		figure: "Figure 20: EMAIL",
		vcard: ["EMAIL;TYPE=work:jqpublic@xyz.example.com", "EMAIL;PREF=1:jane_doe@example.com"],
		card: {
			emails: {
				"EMAIL-1": { contexts: { work: true }, address: "jqpublic@xyz.example.com" },
				"EMAIL-2": { address: "jane_doe@example.com", pref: 1 },
			},
		},
	},
	{
		figure: "Figure 21: DEATHDATE and DEATHPLACE",
		vcard: [
			"DEATHDATE:19960415",
			"DEATHPLACE:",
			" 5 Court Street\\nNew England, ND 58647\\nU.S.A.",
		],
		card: {
			anniversaries: {
				"ANNIVERSARY-1": {
					kind: "death",
					date: { year: 1996, month: 4, day: 15 },
					place: { full: "5 Court Street\nNew England, ND 58647\nU.S.A." },
				},
			},
		},
	},
	{
		figure: "Figure 22: EXPERTISE",
		vcard: [
			"EXPERTISE;LEVEL=beginner;INDEX=2:Chinese literature",
			"EXPERTISE;INDEX=1;LEVEL=expert:chemistry",
		],
		card: {
			personalInfo: {
				"PERSINFO-1": { kind: "expertise", value: "Chinese literature", level: "low", listAs: 2 },
				"PERSINFO-2": { kind: "expertise", value: "chemistry", level: "high", listAs: 1 },
			},
		},
	},
	{
		figure: "Figure 23: FBURL",
		vcard: [
			"FBURL;PREF=1:https://www.example.com/busy/janedoe",
			"FBURL;MEDIATYPE=text/calendar:https://example.com/busy/project-a.ifb",
		],
		card: {
			calendars: {
				"FBURL-1": { kind: "freeBusy", uri: "https://www.example.com/busy/janedoe", pref: 1 },
				"FBURL-2": {
					kind: "freeBusy",
					uri: "https://example.com/busy/project-a.ifb",
					mediaType: "text/calendar",
				},
			},
		},
	},
	{
		figure: "Figure 24: FN",
		vcard: ["FN:John Q. Public\\, Esq."],
		card: { name: { full: "John Q. Public, Esq." } },
	},
	{
		figure: "Figure 25: GRAMGENDER",
		vcard: ["GRAMGENDER:NEUTER"],
		card: { speakToAs: { grammaticalGender: "neuter" } },
	},
	{
		figure: "Figure 26: HOBBY",
		vcard: ["HOBBY;INDEX=1;LEVEL=high:reading", "HOBBY;INDEX=2;LEVEL=high:sewing"],
		card: {
			personalInfo: {
				"PERSINFO-1": { kind: "hobby", value: "reading", level: "high", listAs: 1 },
				"PERSINFO-2": { kind: "hobby", value: "sewing", level: "high", listAs: 2 },
			},
		},
	},
	{
		figure: "Figure 27: IMPP",
		vcard: ["IMPP;PREF=1:xmpp:alice@example.com"],
		card: { onlineServices: { "OS-1": { uri: "xmpp:alice@example.com", pref: 1 } } },
	},
	{
		figure: "Figure 28: INTEREST",
		vcard: [
			"INTEREST;INDEX=1;LEVEL=medium:r&b music",
			"INTEREST;INDEX=2;LEVEL=high:rock&roll music",
		],
		card: {
			personalInfo: {
				"PERSINFO-1": { kind: "interest", value: "r&b music", level: "medium", listAs: 1 },
				"PERSINFO-2": { kind: "interest", value: "rock&roll music", level: "high", listAs: 2 },
			},
		},
	},
	{
		figure: "Figure 29: KEY",
		vcard: ["KEY:https://www.example.com/keys/jdoe.cer"],
		card: { cryptoKeys: { "KEY-1": { uri: "https://www.example.com/keys/jdoe.cer" } } },
	},
	{
		figure: "Figure 30: KIND",
		vcard: ["KIND:individual"],
		card: { kind: "individual" },
	},
	{
		figure: "Figure 31: LANG",
		vcard: ["LANG;TYPE=work;PREF=1:en", "LANG;TYPE=work;PREF=2:fr", "LANG;TYPE=home:fr"],
		card: {
			preferredLanguages: {
				"LANG-1": { language: "en", contexts: { work: true }, pref: 1 },
				"LANG-2": { language: "fr", contexts: { work: true }, pref: 2 },
				"LANG-3": { language: "fr", contexts: { private: true } },
			},
		},
	},
	{
		figure: "Figure 32: LANGUAGE",
		vcard: ["LANGUAGE:de-AT"],
		card: { language: "de-AT" },
	},
	{
		figure: "Figure 33: LOGO",
		vcard: ["LOGO:https://www.example.com/pub/logos/abccorp.jpg"],
		card: {
			media: { "LOGO-1": { kind: "logo", uri: "https://www.example.com/pub/logos/abccorp.jpg" } },
		},
	},
	{
		figure: "Figure 34: MEMBER",
		vcard: [
			"KIND:group",
			"FN:The Doe family",
			"MEMBER:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af",
			"MEMBER:urn:uuid:b8767877-b4a1-4c70-9acc-505d3819e519",
			"UID:urn:uuid:ab4310aa-fa43-11e9-8f0b-362b9e155667",
		],
		card: {
			kind: "group",
			name: { full: "The Doe family" },
			uid: "urn:uuid:ab4310aa-fa43-11e9-8f0b-362b9e155667",
			members: {
				"urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af": true,
				"urn:uuid:b8767877-b4a1-4c70-9acc-505d3819e519": true,
			},
		},
	},
	{
		figure: "Figure 36: N",
		vcard: [
			'N;SORT-AS="Stevenson,John Philip":Stevenson;John;Philip,Paul;Dr.;Jr.,M.D.,A.C.P.;;Jr.',
		],
		card: {
			name: {
				components: [
					{ kind: "surname", value: "Stevenson" },
					{ kind: "given", value: "John" },
					{ kind: "given2", value: "Philip" },
					{ kind: "given2", value: "Paul" },
					{ kind: "title", value: "Dr." },
					{ kind: "credential", value: "M.D." },
					{ kind: "credential", value: "A.C.P." },
					{ kind: "generation", value: "Jr." },
				],
				sortAs: { surname: "Stevenson", given: "John Philip" },
			},
		},
	},
	{
		figure: "Figure 37: NICKNAME",
		vcard: ["NICKNAME:Johnny"],
		card: { nicknames: { "NICK-1": { name: "Johnny" } } },
	},
	{
		figure: "Figure 38: NOTE",
		vcard: [
			'NOTE;CREATED=20221123T150132Z;AUTHOR-NAME="John":',
			" Office hours are from 0800 to 1715 EST\\, Mon-Fri.",
		],
		card: {
			notes: {
				"NOTE-1": {
					note: "Office hours are from 0800 to 1715 EST, Mon-Fri.",
					created: "2022-11-23T15:01:32Z",
					author: { name: "John" },
				},
			},
		},
	},
	{
		figure: "Figure 39: ORG",
		vcard: ['ORG;SORT-AS="ABC":ABC\\, Inc.;North American Division;Marketing'],
		card: {
			organizations: {
				"ORG-1": {
					name: "ABC, Inc.",
					units: [{ name: "North American Division" }, { name: "Marketing" }],
					sortAs: "ABC",
				},
			},
		},
	},
	{
		figure: "Figure 40: ORG-DIRECTORY",
		vcard: [
			"ORG-DIRECTORY;INDEX=1:https://directory.mycompany.example.com",
			"ORG-DIRECTORY;PREF=1:ldap://ldap.tech.example/o=Tech,ou=Engineering",
		],
		card: {
			directories: {
				"DIRECTORY-1": {
					kind: "directory",
					uri: "https://directory.mycompany.example.com",
					listAs: 1,
				},
				"DIRECTORY-2": {
					kind: "directory",
					uri: "ldap://ldap.tech.example/o=Tech,ou=Engineering",
					pref: 1,
				},
			},
		},
	},
	{
		figure: "Figure 41: PHOTO",
		vcard: ["PHOTO:https://www.example.com/pub/photos/jqpublic.gif"],
		card: {
			media: {
				"PHOTO-1": { kind: "photo", uri: "https://www.example.com/pub/photos/jqpublic.gif" },
			},
		},
	},
	{
		figure: "Figure 42: PRODID",
		vcard: ["PRODID:ACME Contacts App version 1.23.5"],
		card: { prodId: "ACME Contacts App version 1.23.5" },
	},
	{
		figure: "Figure 43: PRONOUNS",
		vcard: ["PRONOUNS;PREF=2:they/them", "PRONOUNS;PREF=1:xe/xir"],
		card: {
			speakToAs: {
				pronouns: {
					"PRONOUNS-1": { pronouns: "they/them", pref: 2 },
					"PRONOUNS-2": { pronouns: "xe/xir", pref: 1 },
				},
			},
		},
	},
	{
		figure: "Figure 44: RELATED",
		vcard: [
			"RELATED;TYPE=friend:urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
			"RELATED;TYPE=contact:https://example.com/directory/john.vcf",
			"RELATED;VALUE=text:Please contact my deputy John for any inquiries.",
		],
		card: {
			relatedTo: {
				"urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6": { relation: { friend: true } },
				"https://example.com/directory/john.vcf": { relation: { contact: true } },
				"Please contact my deputy John for any inquiries.": { relation: {} },
			},
		},
	},
	{
		figure: "Figure 45: REV",
		vcard: ["REV:19951031T222710Z"],
		card: { updated: "1995-10-31T22:27:10Z" },
	},
	{
		figure: "Figure 46: ROLE",
		vcard: ["group1.ROLE:Project Leader", "group1.ORG:ABC\\, Inc."],
		card: {
			titles: { "ROLE-1": { kind: "role", name: "Project Leader", organizationId: "ORG-1" } },
			organizations: { "ORG-1": { name: "ABC, Inc." } },
		},
	},
	{
		figure: "Figure 47: SOCIALPROFILE",
		vcard: ["SOCIALPROFILE;SERVICE-TYPE=Mastodon:https://example.com/@foo"],
		card: { onlineServices: { "OS-1": { service: "Mastodon", uri: "https://example.com/@foo" } } },
	},
	{
		figure: "Figure 48: SOUND",
		vcard: ["SOUND:CID:JOHNQPUBLIC.19960229T080000.xyzMail@example.com"],
		card: {
			media: {
				"SOUND-1": { kind: "sound", uri: "CID:JOHNQPUBLIC.19960229T080000.xyzMail@example.com" },
			},
		},
	},
	{
		figure: "Figure 49: SOURCE",
		vcard: ["SOURCE:https://dir.example.com/addrbook/jdoe/Jean%20Dupont.vcf"],
		card: {
			directories: {
				"ENTRY-1": {
					kind: "entry",
					uri: "https://dir.example.com/addrbook/jdoe/Jean%20Dupont.vcf",
				},
			},
		},
	},
	{
		figure: "Figure 50: TEL",
		vcard: [
			'TEL;VALUE=uri;PREF=1;TYPE="voice,home":tel:+1-555-555-5555;ext=5555',
			"TEL;VALUE=uri;TYPE=home:tel:+33-01-23-45-67",
		],
		card: {
			phones: {
				"PHONE-1": {
					contexts: { private: true },
					features: { voice: true },
					number: "tel:+1-555-555-5555;ext=5555",
					pref: 1,
				},
				"PHONE-2": { contexts: { private: true }, number: "tel:+33-01-23-45-67" },
			},
		},
	},
	{
		figure: "Figure 51: TITLE",
		vcard: ["TITLE:Research Scientist"],
		card: { titles: { "TITLE-1": { kind: "title", name: "Research Scientist" } } },
	},
	{
		figure: "Figure 52: UID",
		vcard: ["UID:urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6"],
		card: { uid: "urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6" },
	},
	{
		figure: "Figure 54: URL",
		vcard: ["URL:https://example.org/restaurant.french/~chezchic.html"],
		card: { links: { "LINK-1": { uri: "https://example.org/restaurant.french/~chezchic.html" } } },
	},
	{
		figure: "Figure 55: X-ABLabel",
		vcard: ["item1.TEL;VALUE=uri:tel:+1-555-555-5555", "item1.X-ABLabel:foo"],
		card: { phones: { "PHONE-1": { number: "tel:+1-555-555-5555", label: "foo" } } },
	},
	{
		figure: "RFC 9555 Figure 45: vCardProps",
		vcard: ["item1.X-FOO;X-BAR=Hello:World!"],
		card: { vCardProps: [["x-foo", { "x-bar": "Hello", group: "item1" }, "unknown", "World!"]] },
	},
	{
		figure: "Figure 57: JSCOMPS positional entries",
		vcard: ['N;JSCOMPS=";1;0":Doe;Jane;;;;;;', "FN;DERIVED=TRUE:Jane Doe"],
		card: {
			name: {
				components: [
					{ kind: "given", value: "Jane" },
					{ kind: "surname", value: "Doe" },
				],
				isOrdered: true,
			},
		},
	},
	{
		figure: "Figure 58: JSCOMPS secondary index",
		vcard: ['N;JSCOMPS=";1;2;2,1;0;6;4,1":Stevenson;John;Philip,Paul;;Jr.,M.D.;;Jr.'],
		card: {
			name: {
				components: [
					{ kind: "given", value: "John" },
					{ kind: "given2", value: "Philip" },
					{ kind: "given2", value: "Paul" },
					{ kind: "surname", value: "Stevenson" },
					{ kind: "generation", value: "Jr." },
					{ kind: "credential", value: "M.D." },
				],
				isOrdered: true,
			},
		},
	},
	{
		figure: "RFC 9555 Figure 48: JSPROP for an unknown property",
		vcard: ['JSPROP;JSPTR="someUnknownProperty":true'],
		card: { someUnknownProperty: true },
	},
	{
		figure: "RFC 9555 Figure 49: JSPROP for a vendor property",
		vcard: ['JSPROP;JSPTR="example.com:foo":{"bar":1234}'],
		card: { "example.com:foo": { bar: 1234 } },
	},
	{
		figure: "RFC 9555 Figure 50: JSPROP nested in a phone",
		vcard: [
			"TEL;PROP-ID=phone1:tel:+33-01-23-45-67",
			'JSPROP;JSPTR="phones/phone1/example.com:foo~1bar":',
			' "tux hux"',
		],
		card: {
			phones: { phone1: { number: "tel:+33-01-23-45-67", "example.com:foo/bar": "tux hux" } },
		},
	},
];
