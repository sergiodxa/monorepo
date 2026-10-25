/**
 * The examples of RFC 9610 (JMAP Contacts) as test fixtures: the first fetch of every
 * address book and card, and a change of the default address book.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Section 4.1, Figure 1: fetch every AddressBook and ContactCard. */
export const INITIAL_CALLS = [
	["AddressBook/get", { accountId: "a0x9" }, "0"],
	["ContactCard/get", { accountId: "a0x9" }, "1"],
];

/** Section 4.1, Figure 2: two address books, one shared, and one card. */
export const INITIAL_RESPONSE = {
	methodResponses: [
		[
			"AddressBook/get",
			{
				accountId: "a0x9",
				list: [
					{
						id: "062adcfa-105d-455c-bc60-6db68b69c3f3",
						name: "Personal",
						description: null,
						sortOrder: 0,
						isDefault: true,
						isSubscribed: true,
						shareWith: {
							"3f1502e0-63fe-4335-9ff3-e739c188f5dd": {
								mayRead: true,
								mayWrite: false,
								mayShare: false,
								mayDelete: false,
							},
						},
						myRights: { mayRead: true, mayWrite: true, mayShare: true, mayDelete: false },
					},
					{
						id: "cd40089d-35f9-4fd7-980b-ba3a9f1d74fe",
						name: "Autosaved",
						description: null,
						sortOrder: 1,
						isDefault: false,
						isSubscribed: true,
						shareWith: null,
						myRights: { mayRead: true, mayWrite: true, mayShare: true, mayDelete: false },
					},
				],
				notFound: [],
				state: "~4144",
			},
			"0",
		],
		[
			"ContactCard/get",
			{
				accountId: "a0x9",
				list: [
					{
						id: "3",
						addressBookIds: { "062adcfa-105d-455c-bc60-6db68b69c3f3": true },
						name: {
							components: [
								{ kind: "given", value: "Joe" },
								{ kind: "surname", value: "Bloggs" },
							],
							isOrdered: true,
						},
						emails: {
							"0": { contexts: { private: true }, address: "joe.bloggs@example.com" },
						},
					},
				],
				notFound: [],
				state: "ewarbckaqJ::112",
			},
			"1",
		],
	],
	sessionState: "75128aab4b1b",
};

/** Section 4.2, Figure 3: make "Autosaved" the default address book. */
export const SET_DEFAULT_CALLS = [
	[
		"AddressBook/set",
		{ accountId: "a0x9", onSuccessSetIsDefault: "cd40089d-35f9-4fd7-980b-ba3a9f1d74fe" },
		"0",
	],
];
