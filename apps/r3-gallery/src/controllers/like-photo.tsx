import { createAction } from "@pkg/r3-ui-router";

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
