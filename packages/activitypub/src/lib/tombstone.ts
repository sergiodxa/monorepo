/**
 * The document a deleted object is served as, so a server that refetches it learns it
 * is gone (`respond` answers it with `410`) and a `Delete` names what was removed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ActivityPub } from "./types.js";

/** What a deleted object is described by. */
export interface TombstoneInit {
	/** The deleted object's own id, which the Tombstone keeps. */
	id: string;
	/** The type the object had, such as `Note` or `Article`. */
	formerType?: string | null;
	deleted?: Date | null;
}

/**
 * A `Tombstone` for a deleted object, served in its place and embedded in its `Delete`.
 *
 * @param init - The object's id, former type and deletion time.
 * @example
 * return respond(tombstone({ id: post.url, formerType: "Article", deleted: post.deletedAt }));
 */
export function tombstone(init: TombstoneInit): ActivityPub.Tombstone {
	return {
		id: init.id,
		type: "Tombstone",
		formerType: init.formerType ?? null,
		deleted: init.deleted ?? null,
	};
}
