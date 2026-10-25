/**
 * The registry that types every method call: each method name mapped to its arguments
 * and its response. It lists core, mail, submission, vacation and contacts methods, and
 * a capability outside that list adds its own by augmenting `Methods`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	AddressBook,
	AddressBookSetArguments,
	ContactCard,
	ContactCardComparator,
	ContactCardFilterCondition,
} from "./contacts.js";
import type {
	Email,
	EmailCreate,
	EmailGetArguments,
	EmailImportArguments,
	EmailImportResponse,
	EmailParseArguments,
	EmailParseResponse,
	EmailQueryArguments,
	EmailQueryChangesArguments,
	EmailSubmission,
	EmailSubmissionComparator,
	EmailSubmissionFilterCondition,
	EmailSubmissionSetArguments,
	Identity,
	Mailbox,
	MailboxChangesResponse,
	MailboxComparator,
	MailboxFilterCondition,
	MailboxQueryArguments,
	MailboxSetArguments,
	SearchSnippetGetArguments,
	SearchSnippetGetResponse,
	Thread,
	VacationResponse,
} from "./mail.js";
import type { PushSubscription } from "./push.js";
import type {
	BlobCopyArguments,
	BlobCopyResponse,
	ChangesArguments,
	ChangesResponse,
	CopyArguments,
	CopyResponse,
	Fetched,
	GetArguments,
	GetResponse,
	Id,
	QueryArguments,
	QueryChangesArguments,
	QueryChangesResponse,
	QueryResponse,
	SetArguments,
	SetResponse,
} from "./types.js";

/** One method's argument and response types. */
export interface Method<Arguments, Response> {
	arguments: Arguments;
	response: Response;
}

/** `PushSubscription/get` arguments, which name no account. */
export type PushSubscriptionGetArguments = Omit<
	GetArguments<Exclude<keyof PushSubscription, "url" | "keys">>,
	"accountId"
>;

/** `PushSubscription/get` answer, with no account or state. */
export interface PushSubscriptionGetResponse {
	list: Fetched<PushSubscription>[];
	notFound: Id[];
}

/** `PushSubscription/set` arguments, which name no account and take no `ifInState`. */
export type PushSubscriptionSetArguments = Omit<
	SetArguments<PushSubscription>,
	"accountId" | "ifInState"
>;

/** `PushSubscription/set` answer, with no account or states. */
export type PushSubscriptionSetResponse = Omit<
	SetResponse<PushSubscription>,
	"accountId" | "oldState" | "newState"
>;

/**
 * Every method a batch can call, by name. Augment it to type another capability's methods:
 * `declare module "@sdxc/jmap" { interface Methods { "Calendar/get": Method<…, …> } }`.
 */
export interface Methods {
	"Core/echo": Method<Record<string, unknown>, Record<string, unknown>>;
	"Blob/copy": Method<BlobCopyArguments, BlobCopyResponse>;
	"PushSubscription/get": Method<PushSubscriptionGetArguments, PushSubscriptionGetResponse>;
	"PushSubscription/set": Method<PushSubscriptionSetArguments, PushSubscriptionSetResponse>;

	"Mailbox/get": Method<GetArguments<keyof Mailbox>, GetResponse<Mailbox>>;
	"Mailbox/changes": Method<ChangesArguments, MailboxChangesResponse>;
	"Mailbox/query": Method<MailboxQueryArguments, QueryResponse>;
	"Mailbox/queryChanges": Method<
		QueryChangesArguments<MailboxFilterCondition, MailboxComparator>,
		QueryChangesResponse
	>;
	"Mailbox/set": Method<MailboxSetArguments, SetResponse<Mailbox>>;

	"Thread/get": Method<GetArguments<keyof Thread>, GetResponse<Thread>>;
	"Thread/changes": Method<ChangesArguments, ChangesResponse>;

	"Email/get": Method<EmailGetArguments, GetResponse<Email>>;
	"Email/changes": Method<ChangesArguments, ChangesResponse>;
	"Email/query": Method<EmailQueryArguments, QueryResponse>;
	"Email/queryChanges": Method<EmailQueryChangesArguments, QueryChangesResponse>;
	"Email/set": Method<SetArguments<Email, EmailCreate>, SetResponse<Email>>;
	"Email/copy": Method<CopyArguments<Email>, CopyResponse<Email>>;
	"Email/import": Method<EmailImportArguments, EmailImportResponse>;
	"Email/parse": Method<EmailParseArguments, EmailParseResponse>;

	"SearchSnippet/get": Method<SearchSnippetGetArguments, SearchSnippetGetResponse>;

	"Identity/get": Method<GetArguments<keyof Identity>, GetResponse<Identity>>;
	"Identity/changes": Method<ChangesArguments, ChangesResponse>;
	"Identity/set": Method<SetArguments<Identity>, SetResponse<Identity>>;

	"EmailSubmission/get": Method<GetArguments<keyof EmailSubmission>, GetResponse<EmailSubmission>>;
	"EmailSubmission/changes": Method<ChangesArguments, ChangesResponse>;
	"EmailSubmission/query": Method<
		QueryArguments<EmailSubmissionFilterCondition, EmailSubmissionComparator>,
		QueryResponse
	>;
	"EmailSubmission/queryChanges": Method<
		QueryChangesArguments<EmailSubmissionFilterCondition, EmailSubmissionComparator>,
		QueryChangesResponse
	>;
	"EmailSubmission/set": Method<EmailSubmissionSetArguments, SetResponse<EmailSubmission>>;

	"VacationResponse/get": Method<
		GetArguments<keyof VacationResponse>,
		GetResponse<VacationResponse>
	>;
	"VacationResponse/set": Method<
		Omit<SetArguments<VacationResponse>, "create" | "destroy">,
		SetResponse<VacationResponse>
	>;

	"AddressBook/get": Method<GetArguments<keyof AddressBook>, GetResponse<AddressBook>>;
	"AddressBook/changes": Method<ChangesArguments, ChangesResponse>;
	"AddressBook/set": Method<AddressBookSetArguments, SetResponse<AddressBook>>;

	"ContactCard/get": Method<GetArguments, GetResponse<ContactCard>>;
	"ContactCard/changes": Method<ChangesArguments, ChangesResponse>;
	"ContactCard/query": Method<
		QueryArguments<ContactCardFilterCondition, ContactCardComparator>,
		QueryResponse
	>;
	"ContactCard/queryChanges": Method<
		QueryChangesArguments<ContactCardFilterCondition, ContactCardComparator>,
		QueryChangesResponse
	>;
	"ContactCard/set": Method<SetArguments<ContactCard>, SetResponse<ContactCard>>;
	"ContactCard/copy": Method<CopyArguments<ContactCard>, CopyResponse<ContactCard>>;
}

/** A method `Methods` declares. */
export type MethodName = Extract<keyof Methods, string>;

/** The arguments of method `Name`. */
export type ArgumentsOf<Name extends MethodName> = Methods[Name]["arguments"];

/** The response of method `Name`. */
export type ResponseOf<Name extends MethodName> = Methods[Name]["response"];
