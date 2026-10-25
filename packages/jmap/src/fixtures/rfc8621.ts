/**
 * The examples of RFC 8621 (JMAP Mail) as test fixtures, with elided members (`...`)
 * dropped and strings the RFC wraps across lines joined. The `Email/get` call carries
 * the `accountId` its answer names, which every `/get` requires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Section 2.6: the calls that fetch a Mailbox change and only its changed properties. */
export const MAILBOX_CHANGES_CALLS = [
	["Mailbox/changes", { accountId: "u33084183", sinceState: "78540" }, "0"],
	[
		"Mailbox/get",
		{
			accountId: "u33084183",
			"#ids": { resultOf: "0", name: "Mailbox/changes", path: "/created" },
		},
		"1",
	],
	[
		"Mailbox/get",
		{
			accountId: "u33084183",
			"#ids": { resultOf: "0", name: "Mailbox/changes", path: "/updated" },
			"#properties": { resultOf: "0", name: "Mailbox/changes", path: "/updatedProperties" },
		},
		"2",
	],
];

/** Section 2.6: the answer to those calls. */
export const MAILBOX_CHANGES_RESPONSE = {
	methodResponses: [
		[
			"Mailbox/changes",
			{
				accountId: "u33084183",
				oldState: "78541",
				newState: "78542",
				hasMoreChanges: false,
				updatedProperties: ["totalEmails", "unreadEmails", "totalThreads", "unreadThreads"],
				created: [],
				updated: ["MB23cfa8094c0f41e6"],
				destroyed: [],
			},
			"0",
		],
		["Mailbox/get", { accountId: "u33084183", state: "78542", list: [], notFound: [] }, "1"],
		[
			"Mailbox/get",
			{
				accountId: "u33084183",
				state: "78542",
				list: [
					{
						id: "MB23cfa8094c0f41e6",
						totalEmails: 16307,
						unreadEmails: 13903,
						totalThreads: 5833,
						unreadThreads: 5127,
					},
				],
				notFound: [],
			},
			"2",
		],
	],
	sessionState: "75128aab4b1b",
};

/** Section 2.6: a rename that succeeds next to a destroy the user lacks the right for. */
export const MAILBOX_SET_RESPONSE = {
	methodResponses: [
		[
			"Mailbox/set",
			{
				accountId: "u33084183",
				oldState: "78542",
				newState: "78549",
				updated: { MB674cc24095db49ce: null },
				notDestroyed: { MB23cfa8094c0f41e6: { type: "forbidden" } },
			},
			"0",
		],
	],
	sessionState: "75128aab4b1b",
};

/** Section 4.2.1: the `Email/get` call with body values and a `header:` property. */
export const EMAIL_GET_CALLS = [
	[
		"Email/get",
		{
			accountId: "abc",
			ids: ["f123u456", "f123u457"],
			properties: [
				"threadId",
				"mailboxIds",
				"from",
				"subject",
				"receivedAt",
				"header:List-POST:asURLs",
				"htmlBody",
				"bodyValues",
			],
			bodyProperties: ["partId", "blobId", "size", "type"],
			fetchHTMLBodyValues: true,
			maxBodyValueBytes: 256,
		},
		"#1",
	],
];

/** Section 4.2.1: the answer, one Email found and one not. */
export const EMAIL_GET_RESPONSE = {
	methodResponses: [
		[
			"Email/get",
			{
				accountId: "abc",
				state: "41234123231",
				list: [
					{
						id: "f123u457",
						threadId: "ef1314a",
						mailboxIds: { f123: true },
						from: [{ name: "Joe Bloggs", email: "joe@example.com" }],
						subject: "Dinner on Thursday?",
						receivedAt: "2013-10-13T14:12:00Z",
						"header:List-POST:asURLs": ["mailto:partytime@lists.example.com"],
						htmlBody: [
							{ partId: "1", blobId: "B841623871", size: 283331, type: "text/html" },
							{ partId: "2", blobId: "B319437193", size: 10343, type: "text/plain" },
						],
						bodyValues: {
							"1": {
								isEncodingProblem: false,
								isTruncated: true,
								value: "<html><body><p>Hello ...",
							},
							"2": {
								isEncodingProblem: false,
								isTruncated: false,
								value: "-- Sent by your friendly mailing list ...",
							},
						},
					},
				],
				notFound: ["f123u456"],
			},
			"#1",
		],
	],
	sessionState: "75128aab4b1b",
};

/** Section 5.2: search snippets for a text search, highlighted with `<mark>`. */
export const SEARCH_SNIPPET_RESPONSE = {
	methodResponses: [
		[
			"SearchSnippet/get",
			{
				accountId: "ue150411c",
				list: [
					{ emailId: "M44200ec123de277c0c1ce69c", subject: null, preview: null },
					{
						emailId: "M7bcbcb0b58d7729686e83d99",
						subject: "The <mark>Foo</mark>sball competition",
						preview:
							"...year the <mark>foo</mark>sball competition will be held in the Stadium de ...",
					},
				],
				notFound: null,
			},
			"0",
		],
	],
	sessionState: "75128aab4b1b",
};

/** Section 6.4: the user's identities, one of them a whole domain. */
export const IDENTITY_GET_RESPONSE = {
	methodResponses: [
		[
			"Identity/get",
			{
				accountId: "acme",
				state: "99401312ae-11-333",
				list: [
					{
						id: "XD-3301-222-11_22AAz",
						name: "Joe Bloggs",
						email: "joe@example.com",
						replyTo: null,
						bcc: [{ name: null, email: "joe+archive@example.com" }],
						textSignature: "-- \nJoe Bloggs\nMaster of Email",
						htmlSignature: "<div><b>Joe Bloggs</b></div><div>Master of Email</div>",
						mayDelete: false,
					},
					{
						id: "XD-9911312-11_22AAz",
						name: "Joe B",
						email: "*@example.com",
						replyTo: null,
						bcc: null,
						textSignature: "",
						htmlSignature: "",
						mayDelete: true,
					},
				],
				notFound: [],
			},
			"0",
		],
	],
	sessionState: "75128aab4b1b",
};

/** Section 7.5.1: sending a saved draft and moving it to Sent once it goes. */
export const SUBMISSION_CALLS = [
	[
		"EmailSubmission/set",
		{
			accountId: "ue411d190",
			create: {
				k1490: {
					identityId: "I64588216",
					emailId: "M7f6ed5bcfd7e2604d1753f6c",
					envelope: {
						mailFrom: { email: "john@example.com", parameters: null },
						rcptTo: [{ email: "jane@example.com", parameters: null }],
					},
				},
			},
			onSuccessUpdateEmail: {
				"#k1490": {
					"mailboxIds/7cb4e8ee-df87-4757-b9c4-2ea1ca41b38e": null,
					"mailboxIds/73dbcb4b-bffc-48bd-8c2a-a2e91ca672f6": true,
					"keywords/$draft": null,
				},
			},
		},
		"0",
	],
];

/** Section 7.5.1: the submission's answer and the implicit `Email/set` under the same call id. */
export const SUBMISSION_RESPONSE = {
	methodResponses: [
		[
			"EmailSubmission/set",
			{
				accountId: "ue411d190",
				oldState: "012421s6-8nrq-4ps4-n0p4-9330r951ns21",
				newState: "355421f6-8aed-4cf4-a0c4-7377e951af36",
				created: { k1490: { id: "ES-3bab7f9a-623e-4acf-99a5-2e67facb02a0" } },
			},
			"0",
		],
		[
			"Email/set",
			{
				accountId: "ue411d190",
				oldState: "778193",
				newState: "778197",
				updated: { M7f6ed5bcfd7e2604d1753f6c: null },
			},
			"0",
		],
	],
	sessionState: "75128aab4b1b",
};
