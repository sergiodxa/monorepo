/**
 * The example of draft-ietf-regext-rdap-jscontact-27 §3.1.15: a registrar entity whose
 * contact information is a JSContact `jscontact_card` rather than a jCard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Figure 2: an RDAP entity carrying a Card. */
export const JSCONTACT_ENTITY = {
	rdapConformance: ["rdap_level_0", "jscontact", "versioning"],
	objectClassName: "entity",
	handle: "XXXX",
	jscontact_card: {
		"@type": "Card",
		version: "2.0",
		name: {
			full: "Joe User",
			components: [
				{ kind: "given", value: "Joe" },
				{ kind: "surname", value: "User" },
			],
		},
		organizations: { org: { name: "Org Example" } },
		addresses: {
			addr: {
				components: [
					{ kind: "name", value: "Main Street 1" },
					{ kind: "locality", value: "Ludwigshafen am Rhein" },
					{ kind: "region", value: "Rhineland-Palatinate" },
					{ kind: "postcode", value: "67067" },
					{ kind: "country", value: "Germany" },
				],
				countryCode: "DE",
			},
			"addr-1": { full: "Somewhere Street 1 Mutterstadt 67112 Germany" },
		},
		phones: {
			voice: { number: "tel:+49-1522-3433333" },
			fax: { features: { fax: true }, number: "tel:+49-30-901820" },
		},
		emails: { email: { address: "joe.user@example.com" } },
		links: {
			url: { uri: "https://www.example.com" },
			"contact-uri": { kind: "contact", uri: "mailto:contact@example.com" },
		},
	},
	roles: ["registrar"],
	publicIds: [{ type: "IANA Registrar ID", identifier: "1" }],
	links: [
		{
			value: "https://example.com/entity/XXXX",
			rel: "self",
			href: "https://example.com/entity/XXXX",
			type: "application/rdap+json",
		},
	],
	events: [{ eventAction: "registration", eventDate: "1990-12-31T23:59:59Z" }],
	asEventActor: [{ eventAction: "last changed", eventDate: "1991-12-31T23:59:59Z" }],
	versioning_data: [
		{ extension: "rdap_level_0", type: "opaque", version: "rdap_level_0" },
		{ extension: "versioning", type: "point", version: "versioning-1.0" },
		{ extension: "jscontact", type: "point", version: "jscontact-1.0" },
	],
};
