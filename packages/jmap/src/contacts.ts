/**
 * The RFC 9610 JMAP Contacts data types: AddressBooks and the ContactCards in them.
 * A ContactCard is an RFC 9553 JSContact Card plus its JMAP id and address books; the
 * card's own members are typed loosely and read as the JSContact document they are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Comparator, Id, SetArguments, UTCDate } from "./types.js";

/** What a user may do with an AddressBook and the ContactCards in it. */
export interface AddressBookRights {
	mayRead: boolean;
	mayWrite: boolean;
	mayShare: boolean;
	mayDelete: boolean;
}

/** A named collection of ContactCards; exactly one in an account should be `isDefault`. */
export interface AddressBook {
	id: Id;
	name: string;
	description: string | null;
	sortOrder: number;
	isDefault: boolean;
	isSubscribed: boolean;
	/** Each RFC 9670 Principal id it is shared with, and their rights; `null` when unshared. */
	shareWith: Record<Id, AddressBookRights> | null;
	myRights: AddressBookRights;
}

/**
 * `AddressBook/set` arguments. `onDestroyRemoveContents` lets a non-empty AddressBook be
 * destroyed, and `onSuccessSetIsDefault` makes one the default once every change succeeds.
 */
export interface AddressBookSetArguments extends SetArguments<AddressBook> {
	onDestroyRemoveContents?: boolean;
	onSuccessSetIsDefault?: Id | null;
}

/**
 * A JSContact Card stored in JMAP. `uid` identifies the card across accounts, `kind: "group"`
 * makes it a group whose `members` are uids, and media may carry a `blobId` instead of a `uri`.
 */
export interface ContactCard {
	id: Id;
	addressBookIds: Record<Id, boolean>;
	"@type"?: "Card";
	version?: string;
	uid?: string;
	kind?: string;
	created?: UTCDate;
	updated?: UTCDate;
	members?: Record<string, boolean>;
	name?: Record<string, unknown>;
	[property: string]: unknown;
}

/** A condition of `ContactCard/query`; every property given must match. */
export interface ContactCardFilterCondition {
	inAddressBook?: Id;
	uid?: string;
	hasMember?: string;
	kind?: string;
	createdBefore?: UTCDate;
	createdAfter?: UTCDate;
	updatedBefore?: UTCDate;
	updatedAfter?: UTCDate;
	text?: string;
	name?: string;
	"name/given"?: string;
	"name/surname"?: string;
	"name/surname2"?: string;
	nickname?: string;
	organization?: string;
	email?: string;
	phone?: string;
	onlineService?: string;
	address?: string;
	note?: string;
}

/** A sort key of `ContactCard/query`; servers must support `created` and `updated`. */
export type ContactCardComparator = Comparator<
	"created" | "updated" | "name/given" | "name/surname" | "name/surname2" | (string & {})
>;
