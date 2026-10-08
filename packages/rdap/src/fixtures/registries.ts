/**
 * Registry responses shaped after what Verisign (thin, with a `related` link), Public
 * Interest Registry (thick), SWITCH (no `expiration` event) and an IDN registration send,
 * with fictional names and contacts, plus a bootstrap file trimmed to the TLDs they cover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * An RFC 9224 DNS bootstrap file. `io` lists HTTP before HTTPS and `tv` HTTP alone, so
 * both scheme choices are exercised; the `org` base URL lacks its trailing slash.
 */
export const BOOTSTRAP = {
	description: "RDAP bootstrap file for Domain Name System registrations",
	publication: "2026-10-01T18:00:01Z",
	services: [
		[["com", "net"], ["https://rdap.verisign.com/com/v1/"]],
		[["org"], ["https://rdap.publicinterestregistry.org/rdap"]],
		[["CH", "li"], ["https://rdap.nic.ch/"]],
		[
			["io"],
			["http://rdap.identitydigital.services/rdap/", "https://rdap.identitydigital.services/rdap/"],
		],
		[["tv"], ["http://rdap.nic.tv/"]],
		[["uk"], ["https://rdap.nominet.uk/uk/"]],
	],
	version: "1.0",
};

/** A thin registry: registry dates and statuses, a registrar without an abuse email, and a `related` link. */
export const THIN_COM = {
	objectClassName: "domain",
	handle: "2336799_DOMAIN_COM-VRSN",
	ldhName: "ACME-WIDGETS.COM",
	links: [
		{
			value: "https://rdap.verisign.com/com/v1/domain/ACME-WIDGETS.COM",
			rel: "self",
			href: "https://rdap.verisign.com/com/v1/domain/ACME-WIDGETS.COM",
			type: "application/rdap+json",
		},
		{
			value: "https://rdap.verisign.com/com/v1/domain/ACME-WIDGETS.COM",
			rel: "related",
			href: "https://rdap.exampleregistrar.com/domain/ACME-WIDGETS.COM",
			type: "application/rdap+json",
		},
	],
	status: ["client delete prohibited", "client transfer prohibited", "client update prohibited"],
	entities: [
		{
			objectClassName: "entity",
			handle: "9999",
			roles: ["registrar"],
			publicIds: [{ type: "IANA Registrar ID", identifier: "9999" }],
			vcardArray: [
				"vcard",
				[
					["version", {}, "text", "4.0"],
					["fn", {}, "text", "Example Registrar, LLC"],
				],
			],
			entities: [
				{
					objectClassName: "entity",
					roles: ["abuse"],
					vcardArray: [
						"vcard",
						[
							["version", {}, "text", "4.0"],
							["fn", {}, "text", ""],
						],
					],
				},
			],
		},
	],
	events: [
		{ eventAction: "registration", eventDate: "1997-09-15T04:00:00Z" },
		{ eventAction: "expiration", eventDate: "2028-09-14T04:00:00Z" },
		{ eventAction: "last changed", eventDate: "2019-09-09T15:39:04Z" },
		{ eventAction: "last update of RDAP database", eventDate: "2026-10-08T12:00:00Z" },
	],
	secureDNS: { delegationSigned: false },
	nameservers: [
		{ objectClassName: "nameserver", ldhName: "NS1.EXAMPLEDNS.COM" },
		{ objectClassName: "nameserver", ldhName: "NS2.EXAMPLEDNS.COM." },
	],
	rdapConformance: ["rdap_level_0", "icann_rdap_technical_implementation_guide_1"],
	notices: [{ title: "Terms of Use", description: ["Service subject to Terms of Use."] }],
};

/** The registrar's own record for the thin registration, with the abuse contact the registry left out. */
export const REGISTRAR_COM = {
	objectClassName: "domain",
	ldhName: "acme-widgets.com",
	status: ["active"],
	entities: [
		{
			objectClassName: "entity",
			roles: ["registrar"],
			publicIds: [{ type: "IANA Registrar ID", identifier: "9999" }],
			vcardArray: ["vcard", [["fn", {}, "text", "Example Registrar"]]],
			entities: [
				{
					objectClassName: "entity",
					roles: ["abuse"],
					vcardArray: [
						"vcard",
						[
							["fn", {}, "text", "Abuse Desk"],
							["email", {}, "text", "abuse@exampleregistrar.com"],
						],
					],
				},
			],
		},
	],
	events: [{ eventAction: "expiration", eventDate: "2028-09-13T00:00:00Z" }],
};

/** A thick registry: everything in one answer, a repeated transfer event, DNSSEC signed. */
export const THICK_ORG = {
	objectClassName: "domain",
	handle: "D402200000001234567-LROR",
	ldhName: "acme-widgets.org",
	status: ["client transfer prohibited", "server hold", "renew prohibited"],
	entities: [
		{
			objectClassName: "entity",
			roles: ["Registrar"],
			publicIds: [{ type: "IANA Registrar ID", identifier: "1234" }],
			vcardArray: [
				"vcard",
				[
					["version", {}, "text", "4.0"],
					["fn", {}, "text", "Org Registrar Inc."],
				],
			],
			entities: [
				{
					objectClassName: "entity",
					roles: ["abuse"],
					vcardArray: [
						"vcard",
						[
							["version", {}, "text", "4.0"],
							["fn", {}, "text", "Abuse Contact"],
							["tel", { type: "voice" }, "uri", "tel:+1.5555551234"],
							["email", {}, "text", "abuse@orgregistrar.com"],
						],
					],
				},
			],
		},
		{
			objectClassName: "entity",
			roles: ["registrant"],
			vcardArray: ["vcard", [["fn", {}, "text", "REDACTED FOR PRIVACY"]]],
			remarks: [{ title: "REDACTED FOR PRIVACY", type: "object redacted due to authorization" }],
		},
	],
	events: [
		{ eventAction: "registration", eventDate: "2002-03-11T10:20:30.000Z" },
		{ eventAction: "transfer", eventDate: "2010-01-01T00:00:00Z" },
		{ eventAction: "transfer", eventDate: "2018-06-01T00:00:00Z" },
		{ eventAction: "expiration", eventDate: "2027-03-11T10:20:30.000Z" },
		{ eventAction: "last changed", eventDate: "not a date" },
	],
	secureDNS: {
		zoneSigned: true,
		delegationSigned: true,
		dsData: [{ keyTag: 12345, algorithm: 13 }],
	},
	nameservers: [{ objectClassName: "nameserver", ldhName: "ns1.orghost.net" }],
};

/** A registry that publishes no expiration date and no registrar entity. */
export const NO_EXPIRY_CH = {
	objectClassName: "domain",
	ldhName: "acme-widgets.ch",
	status: ["active"],
	events: [{ eventAction: "registration", eventDate: "2005-07-01T00:00:00+02:00" }],
	nameservers: [{ objectClassName: "nameserver", ldhName: "ns1.swisshost.ch" }],
};

/** An internationalized registration: the A-label in `ldhName`, the U-label in `unicodeName`. */
export const IDN_COM = {
	objectClassName: "domain",
	ldhName: "XN--BCHER-KVA.COM",
	unicodeName: "bücher.com",
	status: ["active", "registrar experimental hold"],
	events: [{ eventAction: "expiration", eventDate: "2027-01-31T23:59:59Z" }],
};
