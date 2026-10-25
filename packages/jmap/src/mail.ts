/**
 * The RFC 8621 JMAP Mail data types: Mailbox, Thread, Email, SearchSnippet, Identity,
 * EmailSubmission and VacationResponse, with each type's filter conditions, sort
 * properties and the extra arguments its methods take beyond the standard ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	ChangesResponse,
	Comparator,
	FilterOperator,
	GetArguments,
	Id,
	LocalDate,
	PatchObject,
	QueryArguments,
	QueryChangesArguments,
	SetArguments,
	SetError,
	UTCDate,
} from "./types.js";

/** What the user may do with the Emails in a Mailbox, and with the Mailbox itself. */
export interface MailboxRights {
	mayReadItems: boolean;
	mayAddItems: boolean;
	mayRemoveItems: boolean;
	maySetSeen: boolean;
	maySetKeywords: boolean;
	mayCreateChild: boolean;
	mayRename: boolean;
	mayDelete: boolean;
	maySubmit: boolean;
}

/** A named set of Emails, nested under `parentId`. `role` marks the special-use folders. */
export interface Mailbox {
	id: Id;
	name: string;
	parentId: Id | null;
	/** An IANA special-use attribute in lowercase: `"inbox"`, `"sent"`, `"drafts"`, `"trash"`… */
	role: string | null;
	sortOrder: number;
	totalEmails: number;
	unreadEmails: number;
	totalThreads: number;
	unreadThreads: number;
	myRights: MailboxRights;
	isSubscribed: boolean;
}

/** A condition of `Mailbox/query`; `parentId: null` matches top-level Mailboxes. */
export interface MailboxFilterCondition {
	parentId?: Id | null;
	name?: string;
	role?: string | null;
	hasAnyRole?: boolean;
	isSubscribed?: boolean;
}

/** A sort key of `Mailbox/query`. */
export type MailboxComparator = Comparator<"sortOrder" | "name" | (string & {})>;

/** `Mailbox/query` arguments: `sortAsTree` lists parents before children, `filterAsTree` drops orphans. */
export interface MailboxQueryArguments extends QueryArguments<
	MailboxFilterCondition,
	MailboxComparator
> {
	sortAsTree?: boolean;
	filterAsTree?: boolean;
}

/** `Mailbox/changes` answer; `updatedProperties` lists the only properties that changed, when the server knows. */
export interface MailboxChangesResponse extends ChangesResponse {
	updatedProperties?: (keyof Mailbox)[] | null;
}

/** `Mailbox/set` arguments; `onDestroyRemoveEmails` destroys a Mailbox that still holds Emails. */
export interface MailboxSetArguments extends SetArguments<Mailbox> {
	onDestroyRemoveEmails?: boolean;
}

/** A conversation: the ids of its Emails, oldest first by `receivedAt`. */
export interface Thread {
	id: Id;
	emailIds: Id[];
}

/** One mailbox in a parsed address header; `name` is the display name. */
export interface EmailAddress {
	name: string | null;
	email: string;
}

/** An RFC 5322 group in an address header, or the addresses outside any group when `name` is `null`. */
export interface EmailAddressGroup {
	name: string | null;
	addresses: EmailAddress[];
}

/** One raw header field. */
export interface EmailHeader {
	name: string;
	value: string;
}

/**
 * A `header:` property: a header field by name, in one of the parsed forms (`asText`,
 * `asAddresses`, `asURLs`…) and `:all` for every instance, as in `"header:List-Post:asURLs"`.
 */
export type HeaderProperty = `header:${string}`;

/** A MIME part. A `multipart/*` part has `subParts` and no `partId` or `blobId`. */
export interface EmailBodyPart {
	partId: string | null;
	blobId: Id | null;
	size: number;
	headers: EmailHeader[];
	name: string | null;
	type: string;
	charset: string | null;
	disposition: string | null;
	cid: string | null;
	language: string[] | null;
	location: string | null;
	subParts: EmailBodyPart[] | null;
	[header: HeaderProperty]: unknown;
}

/** The decoded text of a body part, as `Email/get` fetched it. */
export interface EmailBodyValue {
	value: string;
	/** True when the part could not be decoded cleanly and `value` holds replacement characters. */
	isEncodingProblem?: boolean;
	/** True when `value` stops at the call's `maxBodyValueBytes`. */
	isTruncated?: boolean;
}

/**
 * A message. `mailboxIds` and `keywords` are sets as objects whose values are `true`; patch
 * one member with `"keywords/$seen": true` or remove it with `null`.
 */
export interface Email {
	id: Id;
	blobId: Id;
	threadId: Id;
	mailboxIds: Record<Id, boolean>;
	keywords: Record<string, boolean>;
	size: number;
	receivedAt: UTCDate;
	headers: EmailHeader[];
	messageId: string[] | null;
	inReplyTo: string[] | null;
	references: string[] | null;
	sender: EmailAddress[] | null;
	from: EmailAddress[] | null;
	to: EmailAddress[] | null;
	cc: EmailAddress[] | null;
	bcc: EmailAddress[] | null;
	replyTo: EmailAddress[] | null;
	subject: string | null;
	sentAt: LocalDate | null;
	bodyStructure: EmailBodyPart;
	bodyValues: Record<string, EmailBodyValue>;
	textBody: EmailBodyPart[];
	htmlBody: EmailBodyPart[];
	attachments: EmailBodyPart[];
	hasAttachment: boolean;
	/** Up to 256 characters of plain text from the body, for a message list. */
	preview: string;
	[header: HeaderProperty]: unknown;
}

/**
 * A body part as `Email/set` creates it: `partId` names an entry in the Email's `bodyValues`,
 * or `blobId` an uploaded blob, and the server derives `size` and every property left out.
 */
export interface EmailBodyPartCreate extends Partial<Omit<EmailBodyPart, "subParts">> {
	subParts?: EmailBodyPartCreate[] | null;
}

/**
 * An Email as `Email/set` creates it. Every property is optional, the body parts take their
 * creation shape, and the server sets `id`, `blobId`, `threadId`, `size` and `preview`.
 */
export interface EmailCreate extends Partial<
	Omit<Email, "bodyStructure" | "textBody" | "htmlBody" | "attachments">
> {
	bodyStructure?: EmailBodyPartCreate;
	textBody?: EmailBodyPartCreate[];
	htmlBody?: EmailBodyPartCreate[];
	attachments?: EmailBodyPartCreate[];
}

/** A property `Email/get` can return: a named one or a `header:` form. */
export type EmailProperty = Exclude<keyof Email, HeaderProperty> | HeaderProperty;

/** A property of a body part `Email/get` can return in `bodyProperties`. */
export type EmailBodyPartProperty = Exclude<keyof EmailBodyPart, HeaderProperty> | HeaderProperty;

/** Body options shared by `Email/get` and `Email/parse`: which part properties, and which decoded values. */
export interface EmailBodyArguments {
	bodyProperties?: EmailBodyPartProperty[];
	fetchTextBodyValues?: boolean;
	fetchHTMLBodyValues?: boolean;
	fetchAllBodyValues?: boolean;
	/** Truncates each fetched value to this many UTF-8 bytes; `0` fetches it whole. */
	maxBodyValueBytes?: number;
}

/** `Email/get` arguments. */
export interface EmailGetArguments extends GetArguments<EmailProperty>, EmailBodyArguments {}

/** A condition of `Email/query`; every property given must match. */
export interface EmailFilterCondition {
	inMailbox?: Id;
	inMailboxOtherThan?: Id[];
	before?: UTCDate;
	after?: UTCDate;
	minSize?: number;
	maxSize?: number;
	allInThreadHaveKeyword?: string;
	someInThreadHaveKeyword?: string;
	noneInThreadHaveKeyword?: string;
	hasKeyword?: string;
	notKeyword?: string;
	hasAttachment?: boolean;
	text?: string;
	from?: string;
	to?: string;
	cc?: string;
	bcc?: string;
	subject?: string;
	body?: string;
	/** A header name, and optionally a value its field must contain. */
	header?: [name: string] | [name: string, value: string];
}

/** A sort key of `Email/query`; the keyword sorts read `keyword`. */
export interface EmailComparator extends Comparator<
	| "receivedAt"
	| "size"
	| "from"
	| "to"
	| "subject"
	| "sentAt"
	| "hasKeyword"
	| "allInThreadHaveKeyword"
	| "someInThreadHaveKeyword"
	| (string & {})
> {
	keyword?: string;
}

/** `Email/query` arguments; `collapseThreads` keeps only the first Email of each Thread. */
export interface EmailQueryArguments extends QueryArguments<EmailFilterCondition, EmailComparator> {
	collapseThreads?: boolean;
}

/** `Email/queryChanges` arguments, repeating the original query's `collapseThreads`. */
export interface EmailQueryChangesArguments extends QueryChangesArguments<
	EmailFilterCondition,
	EmailComparator
> {
	collapseThreads?: boolean;
}

/** One message to import from an uploaded RFC 5322 blob. */
export interface EmailImport {
	blobId: Id;
	mailboxIds: Record<Id, boolean>;
	keywords?: Record<string, boolean>;
	receivedAt?: UTCDate;
}

/** `Email/import` arguments, keyed by creation id. */
export interface EmailImportArguments {
	accountId: Id;
	ifInState?: string | null;
	emails: Record<Id, EmailImport>;
}

/** `Email/import` answer: each creation id's `id`, `blobId`, `threadId` and `size`. */
export interface EmailImportResponse {
	accountId: Id;
	oldState: string | null;
	newState: string;
	created: Record<Id, Pick<Email, "id" | "blobId" | "threadId" | "size">> | null;
	notCreated: Record<Id, SetError> | null;
}

/** `Email/parse` arguments: reads RFC 5322 blobs as Emails without storing them. */
export interface EmailParseArguments extends EmailBodyArguments {
	accountId: Id;
	blobIds: Id[];
	properties?: EmailProperty[];
}

/** `Email/parse` answer. */
export interface EmailParseResponse {
	accountId: Id;
	parsed: Record<Id, Partial<Email>> | null;
	notParsable: Id[] | null;
	notFound: Id[] | null;
}

/** Where a search matched one Email: `subject` and `preview` with matches in `<mark>`, or `null`. */
export interface SearchSnippet {
	emailId: Id;
	subject: string | null;
	preview: string | null;
}

/** `SearchSnippet/get` arguments: the same `filter` the `Email/query` used. */
export interface SearchSnippetGetArguments {
	accountId: Id;
	filter?: FilterOperator<EmailFilterCondition> | EmailFilterCondition | null;
	emailIds: Id[];
}

/** `SearchSnippet/get` answer. */
export interface SearchSnippetGetResponse {
	accountId: Id;
	list: SearchSnippet[];
	notFound: Id[] | null;
}

/** An address the user may send as; an `email` like `"*@example.com"` covers a whole domain. */
export interface Identity {
	id: Id;
	name: string;
	email: string;
	replyTo: EmailAddress[] | null;
	bcc: EmailAddress[] | null;
	textSignature: string;
	htmlSignature: string;
	mayDelete: boolean;
}

/** An SMTP envelope address with its `MAIL FROM` or `RCPT TO` parameters. */
export interface SubmissionAddress {
	email: string;
	parameters: Record<string, string | null> | null;
}

/** The SMTP envelope of a submission; without one the server derives it from the message headers. */
export interface Envelope {
	mailFrom: SubmissionAddress;
	rcptTo: SubmissionAddress[];
}

/** How delivery to one recipient went. */
export interface DeliveryStatus {
	/** The SMTP reply the receiving server gave, such as `"250 2.0.0 OK"`. */
	smtpReply: string;
	delivered: "queued" | "yes" | "no" | "unknown";
	displayed: "unknown" | "yes";
}

/** One message sent, or scheduled to send, as an Identity. */
export interface EmailSubmission {
	id: Id;
	identityId: Id;
	emailId: Id;
	threadId: Id;
	envelope: Envelope | null;
	sendAt: UTCDate;
	/** `pending` can still be cancelled by setting it to `canceled`. */
	undoStatus: "pending" | "final" | "canceled";
	deliveryStatus: Record<string, DeliveryStatus> | null;
	dsnBlobIds: Id[];
	mdnBlobIds: Id[];
}

/** A condition of `EmailSubmission/query`. */
export interface EmailSubmissionFilterCondition {
	identityIds?: Id[];
	emailIds?: Id[];
	threadIds?: Id[];
	undoStatus?: EmailSubmission["undoStatus"];
	before?: UTCDate;
	after?: UTCDate;
}

/** A sort key of `EmailSubmission/query`. */
export type EmailSubmissionComparator = Comparator<
	"emailId" | "threadId" | "sentAt" | (string & {})
>;

/**
 * `EmailSubmission/set` arguments. On success the server patches or destroys the sent Emails,
 * keyed by submission id or `"#" + creationId`, in an implicit `Email/set` under the same call id.
 */
export interface EmailSubmissionSetArguments extends SetArguments<EmailSubmission> {
	onSuccessUpdateEmail?: Record<Id, PatchObject> | null;
	onSuccessDestroyEmail?: Id[] | null;
}

/** The automatic reply the server sends while the user is away; its `id` is always `"singleton"`. */
export interface VacationResponse {
	id: "singleton";
	isEnabled: boolean;
	fromDate: UTCDate | null;
	toDate: UTCDate | null;
	subject: string | null;
	textBody: string | null;
	htmlBody: string | null;
}
