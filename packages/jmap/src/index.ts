/**
 * Public surface of the JMAP client: the `JMAP` class, typed batches with result
 * references, the core, mail, contacts and push data types, and the readers for push
 * payloads and event-source streams.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { BatchOptions, CallOptions, JMAPRequestObject, Referable } from "./batch.js";
export type {
	AddressBook,
	AddressBookRights,
	AddressBookSetArguments,
	ContactCard,
	ContactCardComparator,
	ContactCardFilterCondition,
} from "./contacts.js";
export type { JMAPProblemType, JMAPRequestErrorCode, JMAPRequestErrorDetails } from "./error.js";
export type { ServerSentEvent } from "./event-stream.js";
export type { DownloadOptions, EventsOptions, UploadedBlob } from "./jmap.js";
export type {
	DeliveryStatus,
	Email,
	EmailAddress,
	EmailAddressGroup,
	EmailBodyArguments,
	EmailBodyPart,
	EmailBodyPartCreate,
	EmailBodyPartProperty,
	EmailBodyValue,
	EmailComparator,
	EmailCreate,
	EmailFilterCondition,
	EmailGetArguments,
	EmailHeader,
	EmailImport,
	EmailImportArguments,
	EmailImportResponse,
	EmailParseArguments,
	EmailParseResponse,
	EmailProperty,
	EmailQueryArguments,
	EmailQueryChangesArguments,
	EmailSubmission,
	EmailSubmissionComparator,
	EmailSubmissionFilterCondition,
	EmailSubmissionSetArguments,
	Envelope,
	HeaderProperty,
	Identity,
	Mailbox,
	MailboxChangesResponse,
	MailboxComparator,
	MailboxFilterCondition,
	MailboxQueryArguments,
	MailboxRights,
	MailboxSetArguments,
	SearchSnippet,
	SearchSnippetGetArguments,
	SearchSnippetGetResponse,
	SubmissionAddress,
	Thread,
	VacationResponse,
} from "./mail.js";
export type {
	ArgumentsOf,
	Method,
	MethodName,
	Methods,
	PushSubscriptionGetArguments,
	PushSubscriptionGetResponse,
	PushSubscriptionSetArguments,
	PushSubscriptionSetResponse,
	ResponseOf,
} from "./methods.js";
export type {
	PushEvent,
	PushKeys,
	PushSubscription,
	PushVerification,
	StateChange,
	TypeState,
} from "./push.js";
export type { ResultReferenceObject } from "./reference.js";
export type { JMAPResponseObject } from "./response.js";
export type {
	Account,
	AccountCapabilities,
	Capabilities,
	ContactsAccountCapabilities,
	CoreCapabilities,
	MailAccountCapabilities,
	Session,
	SubmissionAccountCapabilities,
	WebSocketCapabilities,
} from "./session.js";
export type {
	AddedItem,
	BlobCopyArguments,
	BlobCopyResponse,
	ChangesArguments,
	ChangesResponse,
	Comparator,
	CopyArguments,
	CopyResponse,
	Fetched,
	FilterOperator,
	GetArguments,
	GetResponse,
	Id,
	Invocation,
	LocalDate,
	MethodErrorType,
	PatchObject,
	QueryArguments,
	QueryChangesArguments,
	QueryChangesResponse,
	QueryResponse,
	SetArguments,
	SetError,
	SetErrorType,
	SetResponse,
	UTCDate,
} from "./types.js";

export { Batch, Call } from "./batch.js";
export { CAPABILITIES, capabilitiesOf } from "./capabilities.js";
export { JMAP_ERROR_PREFIX, JMAPMethodError, JMAPRequestError } from "./error.js";
export { readEventStream } from "./event-stream.js";
export { JMAP } from "./jmap.js";
export { parsePush, readPushEvents } from "./push.js";
export { ResultReference, resolveReference } from "./reference.js";
export { BatchResponse } from "./response.js";
