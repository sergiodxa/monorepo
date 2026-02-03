import type { UUID } from "~/utils/uuid";

import { getDB } from "~/middleware/drizzle";
import { Like } from "~/models/like.server";

export async function deleteLike(id: UUID) {
	let db = getDB();
	await Like.destroy({ db }, id);
}
