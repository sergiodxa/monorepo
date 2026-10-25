/**
 * The examples of RFC 8620 (JMAP core) as test fixtures. Elided members (`...`) are
 * dropped, the session example's missing comma is restored, and template URLs the RFC
 * wraps across lines are joined.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Section 2.1: a session with the user's own mail and contacts and a read-only shared account. */
export const SESSION = {
	capabilities: {
		"urn:ietf:params:jmap:core": {
			maxSizeUpload: 50000000,
			maxConcurrentUpload: 8,
			maxSizeRequest: 10000000,
			maxConcurrentRequest: 8,
			maxCallsInRequest: 32,
			maxObjectsInGet: 256,
			maxObjectsInSet: 128,
			collationAlgorithms: ["i;ascii-numeric", "i;ascii-casemap", "i;unicode-casemap"],
		},
		"urn:ietf:params:jmap:mail": {},
		"urn:ietf:params:jmap:contacts": {},
		"https://example.com/apis/foobar": { maxFoosFinangled: 42 },
	},
	accounts: {
		A13824: {
			name: "john@example.com",
			isPersonal: true,
			isReadOnly: false,
			accountCapabilities: {
				"urn:ietf:params:jmap:mail": { maxMailboxesPerEmail: null, maxMailboxDepth: 10 },
				"urn:ietf:params:jmap:contacts": {},
			},
		},
		A97813: {
			name: "jane@example.com",
			isPersonal: false,
			isReadOnly: true,
			accountCapabilities: {
				"urn:ietf:params:jmap:mail": { maxMailboxesPerEmail: 1, maxMailboxDepth: 10 },
			},
		},
	},
	primaryAccounts: {
		"urn:ietf:params:jmap:mail": "A13824",
		"urn:ietf:params:jmap:contacts": "A13824",
	},
	username: "john@example.com",
	apiUrl: "https://jmap.example.com/api/",
	downloadUrl: "https://jmap.example.com/download/{accountId}/{blobId}/{name}?accept={type}",
	uploadUrl: "https://jmap.example.com/upload/{accountId}/",
	eventSourceUrl:
		"https://jmap.example.com/eventsource/?types={types}&closeafter={closeafter}&ping={ping}",
	state: "75128aab4b1b",
};

/** Section 3.4.1: two responses to one call and an `unknownMethod` error. */
export const RESPONSE = {
	methodResponses: [
		["method1", { arg1: 3, arg2: "foo" }, "c1"],
		["method2", { isBlah: true }, "c2"],
		["anotherResponseFromMethod2", { data: 10, yetmoredata: "Hello" }, "c2"],
		["error", { type: "unknownMethod" }, "c3"],
	],
	sessionState: "75128aab4b1b",
};

/** Section 3.6.1.1: a request naming a capability the server lacks. */
export const UNKNOWN_CAPABILITY = {
	type: "urn:ietf:params:jmap:error:unknownCapability",
	status: 400,
	detail:
		"The Request object used capability 'https://example.com/apis/foobar', which is not supported by this server.",
};

/** Section 3.6.1.1: a request over `maxSizeRequest`. */
export const LIMIT = {
	type: "urn:ietf:params:jmap:error:limit",
	limit: "maxSizeRequest",
	status: 400,
	detail: "The request is larger than the server is willing to process.",
};

/** Section 3.7: the method calls that fetch the first ten inbox Threads' Emails in one request. */
export const INBOX_THREADS_CALLS = [
	[
		"Email/query",
		{
			accountId: "A1",
			filter: { inMailbox: "id_of_inbox" },
			sort: [{ property: "receivedAt", isAscending: false }],
			collapseThreads: true,
			position: 0,
			limit: 10,
			calculateTotal: true,
		},
		"t0",
	],
	[
		"Email/get",
		{
			accountId: "A1",
			"#ids": { resultOf: "t0", name: "Email/query", path: "/ids" },
			properties: ["threadId"],
		},
		"t1",
	],
	[
		"Thread/get",
		{
			accountId: "A1",
			"#ids": { resultOf: "t1", name: "Email/get", path: "/list/*/threadId" },
		},
		"t2",
	],
	[
		"Email/get",
		{
			accountId: "A1",
			"#ids": { resultOf: "t2", name: "Thread/get", path: "/list/*/emailIds" },
			properties: ["from", "receivedAt", "subject"],
		},
		"t3",
	],
];

/** Section 3.7: the responses to the first three of those calls, with the elided items dropped. */
export const INBOX_THREADS_RESPONSES: [string, Record<string, unknown>, string][] = [
	[
		"Email/query",
		{
			accountId: "A1",
			queryState: "abcdefg",
			canCalculateChanges: true,
			position: 0,
			total: 101,
			ids: [
				"msg1023",
				"msg223",
				"msg110",
				"msg93",
				"msg91",
				"msg38",
				"msg36",
				"msg33",
				"msg11",
				"msg1",
			],
		},
		"t0",
	],
	[
		"Email/get",
		{
			accountId: "A1",
			state: "123456",
			list: [
				{ id: "msg1023", threadId: "trd194" },
				{ id: "msg223", threadId: "trd114" },
			],
			notFound: [],
		},
		"t1",
	],
	[
		"Thread/get",
		{
			accountId: "A1",
			state: "123456",
			list: [
				{ id: "trd194", emailIds: ["msg1020", "msg1021", "msg1023"] },
				{ id: "trd114", emailIds: ["msg201", "msg223"] },
			],
			notFound: [],
		},
		"t2",
	],
];

/** Section 3.7: a `Foo/changes` response whose `created` a later `Foo/get` references. */
export const FOO_CHANGES_RESPONSES: [string, Record<string, unknown>, string][] = [
	[
		"Foo/changes",
		{
			accountId: "A1",
			oldState: "abcdef",
			newState: "123456",
			hasMoreChanges: false,
			created: ["f1", "f4"],
			updated: [],
			destroyed: [],
		},
		"t0",
	],
];

/** Section 4.1: `Core/echo` answers with its own arguments. */
export const ECHO = [["Core/echo", { hello: true, high: 5 }, "b3ff"]];

/** Section 7.1.1: changes amalgamated across two accounts. */
export const STATE_CHANGE = {
	"@type": "StateChange",
	changed: {
		a3123: {
			Email: "d35ecb040aab",
			EmailDelivery: "428d565f2440",
			CalendarEvent: "87accfac587a",
		},
		a43461d: { Mailbox: "0af7a512ce70", CalendarEvent: "7a4297cecd76" },
	},
};

/** Section 7.2.3: the verification the server pushes to a new subscription's URL. */
export const PUSH_VERIFICATION = {
	"@type": "PushVerification",
	pushSubscriptionId: "P43dcfa4-1dd4-41ef-9156-2c89b3b19c60",
	verificationCode: "da1f097b11ca17f06424e30bf02bfa67",
};

/** Section 7.2.3: the call that creates a push subscription for every type. */
export const PUSH_SUBSCRIPTION_CREATE_CALLS = [
	[
		"PushSubscription/set",
		{
			create: {
				"4f29": {
					deviceClientId: "a889-ffea-910",
					url: "https://example.com/push/?device=X8980fc&client=12c6d086",
					types: null,
				},
			},
		},
		"0",
	],
];

/** Section 7.2.3: the server's answer, with the expiry it capped at seven days. */
export const PUSH_SUBSCRIPTION_CREATED = [
	[
		"PushSubscription/set",
		{
			created: {
				"4f29": {
					id: "P43dcfa4-1dd4-41ef-9156-2c89b3b19c60",
					keys: null,
					expires: "2018-07-13T02:14:29Z",
				},
			},
		},
		"0",
	],
];
