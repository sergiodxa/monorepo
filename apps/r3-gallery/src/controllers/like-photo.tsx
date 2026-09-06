/**
 * Like-photo action controller for the gallery. It validates the album and photo ids
 * from the route params in middleware and then toggles the photo's like via the
 * middleware-provided likes storage, answering with the new like state as JSON.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Action } from "remix/router";

import type { LikeToggleResult } from "../middleware/likes";
import type { AppContext } from "../router";

import { getLikes } from "../middleware/likes";
import { routes } from "../routes";

/** Toggles one photo like using middleware-provided localStorage state. */
export const likePhoto: Action<typeof routes.likePhoto, AppContext> = {
	middleware: [
		(ctx, next) => {
			let albumId = Number(ctx.params.albumId);
			let photoId = Number(ctx.params.photoId);

			if (!Number.isInteger(albumId) || !Number.isInteger(photoId)) {
				return Response.json({
					photoId,
					liked: false,
					likedPhotoIds: [],
				} satisfies LikeToggleResult);
			}

			return next();
		},
	],

	handler(ctx) {
		let likes = getLikes(ctx);

		return Response.json(likes.toggle(ctx.params.albumId, ctx.params.photoId));
	},
};
