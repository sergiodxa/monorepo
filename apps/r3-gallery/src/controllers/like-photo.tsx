/**
 * Like-photo action controller for the gallery. It validates the album and photo ids
 * from the route params in middleware and then toggles the photo's like via the
 * middleware-provided likes storage, returning the new like state to the fetcher.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "@pkg/ui-router";

import { getLikes } from "../middleware/likes";
import { routes } from "../routes";

/** Toggles one photo like using middleware-provided localStorage state. */
export const likePhoto = createAction(routes.likePhoto, {
	middleware: [
		(ctx, next) => {
			let albumId = Number(ctx.params.albumId);
			let photoId = Number(ctx.params.photoId);

			if (!Number.isInteger(albumId) || !Number.isInteger(photoId)) {
				return { photoId, liked: false, likedPhotoIds: [] };
			}

			return next();
		},
	],
	handler(ctx) {
		let likes = getLikes(ctx);

		return likes.toggle(ctx.params.albumId, ctx.params.photoId);
	},
});
