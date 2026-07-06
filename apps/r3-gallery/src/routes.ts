/**
 * Central route contract for the gallery, declaring the home, album, photo, and
 * form-post routes (open-album and like-photo) with their methods and patterns. It
 * exists so links and the client router share one typed source of URL definitions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { route } from "remix/routes";

/**
 * Route contract shared by links and the client router.
 */
export const routes = route({
	home: "/",
	openAlbum: { method: "POST", pattern: "/album" },
	album: "/album/:id",
	likePhoto: { method: "POST", pattern: "/album/:albumId/photos/:photoId/like" },
	photo: "/photo/:id",
});
