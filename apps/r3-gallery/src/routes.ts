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
