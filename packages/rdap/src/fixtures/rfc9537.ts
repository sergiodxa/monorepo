/**
 * The examples of RFC 9537 as published: the redacted lookup response of Figure 12, and
 * the single `redacted` entries of Figures 5, 7 and 9 and the search response of Figure 14,
 * so the parser is held to the specification's own shapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Figure 12: a lookup with the registry domain id, registrant and technical fields and two whole contacts redacted. */
export const REDACTED_LOOKUP = {
	rdapConformance: ["rdap_level_0", "redacted"],
	objectClassName: "domain",
	ldhName: "example.com",
	secureDNS: {
		delegationSigned: false,
	},
	notices: [
		{
			title: "Terms of Use",
			description: ["Service subject to Terms of Use."],
			links: [
				{
					rel: "self",
					href: "https://www.example.com/terms-of-use",
					type: "text/html",
					value: "https://www.example.com/terms-of-use",
				},
			],
		},
	],
	nameservers: [
		{
			objectClassName: "nameserver",
			ldhName: "ns1.example.com",
		},
		{
			objectClassName: "nameserver",
			ldhName: "ns2.example.com",
		},
	],
	entities: [
		{
			objectClassName: "entity",
			handle: "123",
			roles: ["registrar"],
			publicIds: [
				{
					type: "IANA Registrar ID",
					identifier: "1",
				},
			],
			vcardArray: [
				"vcard",
				[
					["version", {}, "text", "4.0"],
					["fn", {}, "text", "Example Registrar Inc."],
					[
						"adr",
						{},
						"text",
						["", "Suite 100", "123 Example Dr.", "Dulles", "VA", "20166-6503", "US"],
					],
					["email", {}, "text", "contact@organization.example"],
					[
						"tel",
						{
							type: "voice",
						},
						"uri",
						"tel:+1.7035555555",
					],
					[
						"tel",
						{
							type: "fax",
						},
						"uri",
						"tel:+1.7035555556",
					],
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
							["email", {}, "text", "abuse@organization.example"],
							[
								"tel",
								{
									type: "voice",
								},
								"uri",
								"tel:+1.7035555555",
							],
						],
					],
				},
			],
		},
		{
			objectClassName: "entity",
			handle: "XXXX",
			roles: ["registrant"],
			vcardArray: [
				"vcard",
				[
					["version", {}, "text", "4.0"],
					["fn", {}, "text", ""],
					["adr", {}, "text", ["", "", "", "", "QC", "", "Canada"]],
				],
			],
		},
		{
			objectClassName: "entity",
			handle: "YYYY",
			roles: ["technical"],
			vcardArray: [
				"vcard",
				[
					["version", {}, "text", "4.0"],
					["fn", {}, "text", ""],
					["org", {}, "text", "Example Inc."],
					[
						"adr",
						{},
						"text",
						["", "Suite 1234", "4321 Rue Somewhere", "Quebec", "QC", "G1V 2M2", "Canada"],
					],
				],
			],
		},
	],
	events: [
		{
			eventAction: "registration",
			eventDate: "1997-06-03T00:00:00Z",
		},
		{
			eventAction: "last changed",
			eventDate: "2020-05-28T01:35:00Z",
		},
		{
			eventAction: "expiration",
			eventDate: "2021-06-03T04:00:00Z",
		},
	],
	status: [
		"server delete prohibited",
		"server update prohibited",
		"server transfer prohibited",
		"client transfer prohibited",
	],
	redacted: [
		{
			name: {
				description: "Registry Domain ID",
			},
			prePath: "$.handle",
			pathLang: "jsonpath",
			method: "removal",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Registrant Name",
			},
			postPath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='fn')][3]",
			pathLang: "jsonpath",
			method: "emptyValue",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Registrant Organization",
			},
			prePath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='org')]",
			pathLang: "jsonpath",
			method: "removal",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Registrant Street",
			},
			postPath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='adr')][3][:3]",
			pathLang: "jsonpath",
			method: "emptyValue",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Registrant City",
			},
			postPath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='adr')][3][3]",
			pathLang: "jsonpath",
			method: "emptyValue",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Registrant Postal Code",
			},
			postPath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='adr')][3][5]",
			pathLang: "jsonpath",
			method: "emptyValue",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Registrant Email",
			},
			prePath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='email')]",
			method: "removal",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Registrant Phone",
			},
			prePath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[1].type=='voice')]",
			method: "removal",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Technical Name",
			},
			postPath: "$.entities[?(@.roles[0]=='technical')].vcardArray[1][?(@[0]=='fn')][3]",
			method: "emptyValue",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Technical Email",
			},
			prePath: "$.entities[?(@.roles[0]=='technical')].vcardArray[1][?(@[0]=='email')]",
			method: "removal",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Technical Phone",
			},
			prePath: "$.entities[?(@.roles[0]=='technical')].vcardArray[1][?(@[1].type=='voice')]",
			method: "removal",
			reason: {
				description: "Server policy",
			},
		},
		{
			name: {
				description: "Technical Fax",
			},
			prePath: "$.entities[?(@.roles[0]=='technical')].vcardArray[1][?(@[1].type=='fax')]",
			reason: {
				description: "Client request",
			},
		},
		{
			name: {
				description: "Administrative Contact",
			},
			prePath: "$.entities[?(@.roles[0]=='administrative')]",
			method: "removal",
			reason: {
				description: "Refer to the technical contact",
			},
		},
		{
			name: {
				description: "Billing Contact",
			},
			prePath: "$.entities[?(@.roles[0]=='billing')]",
			method: "removal",
			reason: {
				description: "Refer to the registrant contact",
			},
		},
	],
};

/** Figure 5: a partially redacted address label, on an entity's own card. */
export const PARTIAL_LABEL = {
	name: {
		description: "Home Address Label",
	},
	postPath: "$.vcardArray[1][?(@[0]=='adr')][1].label",
	pathLang: "jsonpath",
	method: "partialValue",
	reason: {
		description: "Server policy",
	},
};

/** Figure 7: an email replaced in place by an anonymized address. */
export const ANONYMIZED_EMAIL = {
	name: {
		description: "Registrant Email",
	},
	postPath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='email')][3]",
	pathLang: "jsonpath",
	method: "replacementValue",
};

/** Figure 9: an email replaced by a `contact-uri` web form. */
export const EMAIL_TO_WEB_FORM = {
	name: {
		description: "Registrant Email",
	},
	prePath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='email')]",
	replacementPath: "$.entities[?(@.roles[0]=='registrant')].vcardArray[1][?(@[0]=='contact-uri')]",
	pathLang: "jsonpath",
	method: "replacementValue",
};

/** Figure 14: a registered name and reason, as `type` rather than `description`. */
export const REGISTERED_NAME = {
	name: {
		type: "Registry Domain ID",
	},
	prePath: "$.domainSearchResults[0].handle",
	pathLang: "jsonpath",
	method: "removal",
	reason: {
		type: "Server policy",
	},
};
