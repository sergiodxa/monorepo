/**
 * Data helper for the CMS likes route. deleteLike removes a Like record by its
 * UUID through the Like model against the current database. It exists to keep the
 * likes route's delete side effect out of the route module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UUID } from "~/utils/uuid";

import { getDB } from "~/middleware/drizzle";
import { Like } from "~/models/like.server";

export async function deleteLike(id: UUID) {
	let db = getDB();
	await Like.destroy({ db }, id);
}
