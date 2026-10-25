/**
 * The JMAP core data types and the argument and response shapes of the standard
 * `/get`, `/changes`, `/set`, `/copy`, `/query` and `/queryChanges` methods, which
 * every data type's methods instantiate with their own record, filter and sort.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A server-assigned identifier: 1 to 255 characters of the URL- and filename-safe base64 alphabet. */
export type Id = string;

/** An RFC 3339 date-time in UTC with a `Z` offset, such as `"2014-10-30T06:12:00Z"`. */
export type UTCDate = string;

/** An RFC 3339 date-time with any offset, such as `"2014-10-30T14:12:00+08:00"`. */
export type LocalDate = string;

/**
 * A partial update in a `/set` call: each key is a property name or a JSON Pointer into
 * the record without its leading `/` (`"keywords/$seen"`), and `null` resets it to its default.
 */
export type PatchObject = Record<string, unknown>;

/** A method call or response on the wire: its name, its arguments and the client's call id. */
export type Invocation = [name: string, arguments: Record<string, unknown>, callId: string];

/** A record as a `/get` answered it: the properties asked for, and always its id. */
export type Fetched<T> = Partial<T> & { id: Id };

/** The method-level error types RFC 8620 and RFC 8621 define. */
export type MethodErrorType =
	| "serverUnavailable"
	| "serverFail"
	| "serverPartialFail"
	| "unknownMethod"
	| "invalidArguments"
	| "invalidResultReference"
	| "forbidden"
	| "accountNotFound"
	| "accountNotSupportedByMethod"
	| "accountReadOnly"
	| "requestTooLarge"
	| "cannotCalculateChanges"
	| "stateMismatch"
	| "fromAccountNotFound"
	| "fromAccountNotSupportedByMethod"
	| "anchorNotFound"
	| "unsupportedSort"
	| "unsupportedFilter"
	| "tooManyChanges";

/** The per-record failure types RFC 8620, RFC 8621 and RFC 9610 define for `/set`, `/copy` and imports. */
export type SetErrorType =
	| "forbidden"
	| "overQuota"
	| "tooLarge"
	| "rateLimit"
	| "notFound"
	| "invalidPatch"
	| "willDestroy"
	| "invalidProperties"
	| "singleton"
	| "alreadyExists"
	| "mailboxHasChild"
	| "mailboxHasEmail"
	| "blobNotFound"
	| "tooManyKeywords"
	| "tooManyMailboxes"
	| "invalidEmail"
	| "tooManyRecipients"
	| "noRecipients"
	| "invalidRecipients"
	| "forbiddenMailFrom"
	| "forbiddenFrom"
	| "forbiddenToSend"
	| "cannotUnsend"
	| "addressBookHasContents";

/**
 * Why one record in a `/set` or `/copy` failed to be created, updated or destroyed. A type
 * outside this list arrives as its own string; read it as `forbidden`-like and show
 * `description`, which servers localise for display.
 */
export interface SetError {
	type: SetErrorType | (string & {});
	description?: string | null;
	/** The properties that failed, for `invalidProperties`. */
	properties?: string[];
	/** The record that already holds this data, for `alreadyExists`. */
	existingId?: Id;
	[member: string]: unknown;
}

/** Combines filter conditions: all of them (`AND`), any (`OR`) or none (`NOT`). */
export interface FilterOperator<Condition> {
	operator: "AND" | "OR" | "NOT";
	conditions: (FilterOperator<Condition> | Condition)[];
}

/** One sort key of a `/query`, compared ascending unless `isAscending` is `false`. */
export interface Comparator<Property extends string = string> {
	property: Property;
	isAscending?: boolean;
	/** An RFC 4790 collation the session's `collationAlgorithms` lists. */
	collation?: string;
}

/** Arguments of a `/get`: `ids: null` fetches every record, `properties: null` every property. */
export interface GetArguments<Property extends string = string> {
	accountId: Id;
	ids?: Id[] | null;
	properties?: Property[] | null;
}

/** Answer of a `/get`; `state` is what a later `/changes` passes as `sinceState`. */
export interface GetResponse<T> {
	accountId: Id;
	state: string;
	list: Fetched<T>[];
	notFound: Id[];
}

/** Arguments of a `/changes`. */
export interface ChangesArguments {
	accountId: Id;
	sinceState: string;
	maxChanges?: number | null;
}

/** Answer of a `/changes`; while `hasMoreChanges` is true, call again with `newState`. */
export interface ChangesResponse {
	accountId: Id;
	oldState: string;
	newState: string;
	hasMoreChanges: boolean;
	created: Id[];
	updated: Id[];
	destroyed: Id[];
}

/**
 * Arguments of a `/set`. A `create` key is a client-chosen creation id, which later calls in
 * the same request reference as `"#" + id`; `ifInState` rejects the whole call when stale.
 */
export interface SetArguments<T> {
	accountId: Id;
	ifInState?: string | null;
	create?: Record<Id, Partial<T>> | null;
	update?: Record<Id, PatchObject> | null;
	destroy?: Id[] | null;
}

/**
 * Answer of a `/set`. `created` maps each creation id to the record's server-set properties,
 * and `updated` to the properties the server changed on its own, or `null` when none.
 */
export interface SetResponse<T> {
	accountId: Id;
	oldState: string | null;
	newState: string;
	created?: Record<Id, Fetched<T>> | null;
	updated?: Record<Id, Partial<T> | null> | null;
	destroyed?: Id[] | null;
	notCreated?: Record<Id, SetError> | null;
	notUpdated?: Record<Id, SetError> | null;
	notDestroyed?: Record<Id, SetError> | null;
}

/**
 * Arguments of a `/copy` between two accounts. Each `create` value names the source record
 * by `id` and overrides any property; `onSuccessDestroyOriginal` makes the copy a move.
 */
export interface CopyArguments<T> {
	fromAccountId: Id;
	ifFromInState?: string | null;
	accountId: Id;
	ifInState?: string | null;
	create: Record<Id, Partial<T> & { id: Id }>;
	onSuccessDestroyOriginal?: boolean;
	destroyFromIfInState?: string | null;
}

/** Answer of a `/copy`; a move adds a second, implicit `/set` response under the same call id. */
export interface CopyResponse<T> {
	fromAccountId: Id;
	accountId: Id;
	oldState: string | null;
	newState: string;
	created?: Record<Id, Fetched<T>> | null;
	notCreated?: Record<Id, SetError> | null;
}

/**
 * Arguments of a `/query`. A window starts at `position`, or at `anchorOffset` from the
 * record `anchor` names; `calculateTotal` asks for `total`, which can be expensive.
 *
 * @template Condition - The data type's filter condition.
 * @template Sort - The data type's comparator.
 */
export interface QueryArguments<Condition, Sort extends Comparator = Comparator> {
	accountId: Id;
	filter?: FilterOperator<Condition> | Condition | null;
	sort?: Sort[] | null;
	position?: number;
	anchor?: Id | null;
	anchorOffset?: number;
	limit?: number | null;
	calculateTotal?: boolean;
}

/** Answer of a `/query`; `queryState` is what a later `/queryChanges` passes as `sinceQueryState`. */
export interface QueryResponse {
	accountId: Id;
	queryState: string;
	canCalculateChanges: boolean;
	position: number;
	ids: Id[];
	total?: number;
	/** Present when the server lowered the requested limit. */
	limit?: number;
}

/** Arguments of a `/queryChanges`, which repeat the original query's `filter` and `sort`. */
export interface QueryChangesArguments<Condition, Sort extends Comparator = Comparator> {
	accountId: Id;
	filter?: FilterOperator<Condition> | Condition | null;
	sort?: Sort[] | null;
	sinceQueryState: string;
	maxChanges?: number | null;
	upToId?: Id | null;
	calculateTotal?: boolean;
}

/** A record that entered a query's results, at its new index. */
export interface AddedItem {
	id: Id;
	index: number;
}

/** Answer of a `/queryChanges`: remove every `removed` id, then splice in `added` in index order. */
export interface QueryChangesResponse {
	accountId: Id;
	oldQueryState: string;
	newQueryState: string;
	total?: number;
	removed: Id[];
	added: AddedItem[];
}

/** Arguments of `Blob/copy`. */
export interface BlobCopyArguments {
	fromAccountId: Id;
	accountId: Id;
	blobIds: Id[];
}

/** Answer of `Blob/copy`: each source blob id mapped to its id in the destination account. */
export interface BlobCopyResponse {
	fromAccountId: Id;
	accountId: Id;
	copied: Record<Id, Id> | null;
	notCopied: Record<Id, SetError> | null;
}
