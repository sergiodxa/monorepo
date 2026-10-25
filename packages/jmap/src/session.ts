/**
 * The JMAP Session resource: what the server supports, the accounts the credentials
 * reach, and the URLs every other request goes to. It is read once per client and read
 * again whenever an API response reports a different `sessionState`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type { Id } from "./types.js";

/** The server's request limits, which a client keeps its batches, uploads and gets within. */
export interface CoreCapabilities {
	maxSizeUpload: number;
	maxConcurrentUpload: number;
	maxSizeRequest: number;
	maxConcurrentRequests: number;
	maxCallsInRequest: number;
	maxObjectsInGet: number;
	maxObjectsInSet: number;
	collationAlgorithms: string[];
}

/** The WebSocket transport's endpoint, advertised under the RFC 8887 capability. */
export interface WebSocketCapabilities {
	url: string;
	supportsPush: boolean;
}

/**
 * The capabilities a server supports. Vendor extensions appear under their own URL and
 * arrive unchecked; a client reads only the capabilities it uses.
 */
export interface Capabilities {
	"urn:ietf:params:jmap:core": CoreCapabilities;
	"urn:ietf:params:jmap:websocket"?: WebSocketCapabilities;
	[uri: string]: unknown;
}

/** Mail limits and permissions in one account. */
export interface MailAccountCapabilities {
	/** `null` when an Email may be in any number of Mailboxes. */
	maxMailboxesPerEmail: number | null;
	maxMailboxDepth: number | null;
	maxSizeMailboxName: number;
	maxSizeAttachmentsPerEmail: number;
	emailQuerySortOptions: string[];
	mayCreateTopLevelMailbox: boolean;
}

/** Submission limits in one account. */
export interface SubmissionAccountCapabilities {
	/** Seconds a submission may be delayed; `0` means delayed send is unsupported. */
	maxDelayedSend: number;
	/** The SMTP extensions the server supports, with their arguments. */
	submissionExtensions: Record<string, string[]>;
}

/** Contacts limits and permissions in one account. */
export interface ContactsAccountCapabilities {
	maxAddressBooksPerCard: number | null;
	mayCreateAddressBook: boolean;
}

/** The capabilities whose methods work in one account, with that account's limits for each. */
export interface AccountCapabilities {
	"urn:ietf:params:jmap:mail"?: MailAccountCapabilities;
	"urn:ietf:params:jmap:submission"?: SubmissionAccountCapabilities;
	"urn:ietf:params:jmap:contacts"?: ContactsAccountCapabilities;
	[uri: string]: unknown;
}

/** One account the credentials reach: the user's own, a shared one, or a group's. */
export interface Account {
	name: string;
	isPersonal: boolean;
	isReadOnly: boolean;
	accountCapabilities: AccountCapabilities;
}

/**
 * A JMAP Session. `downloadUrl`, `uploadUrl` and `eventSourceUrl` are RFC 6570 level 1
 * templates the client expands, and `state` changes whenever any other member does.
 */
export interface Session {
	capabilities: Capabilities;
	accounts: Record<Id, Account>;
	/** The user's default account for each capability, absent when none is the default. */
	primaryAccounts: Record<string, Id>;
	username: string;
	apiUrl: string;
	downloadUrl: string;
	uploadUrl: string;
	eventSourceUrl: string;
	state: string;
}

/** The structural check a session document passes before a client trusts its URLs; unknown members are kept. */
export const SESSION_SCHEMA = s.object(
	{
		capabilities: s.record(s.string(), s.any()),
		accounts: s.record(
			s.string(),
			s.object(
				{
					name: s.string(),
					isPersonal: s.boolean(),
					isReadOnly: s.boolean(),
					accountCapabilities: s.record(s.string(), s.any()),
				},
				{ unknownKeys: "passthrough" },
			),
		),
		primaryAccounts: s.record(s.string(), s.string()),
		username: s.string(),
		apiUrl: s.string(),
		downloadUrl: s.string(),
		uploadUrl: s.string(),
		eventSourceUrl: s.string(),
		state: s.string(),
	},
	{ unknownKeys: "passthrough" },
);
