import { route } from "remix/routes";

/**
 * Route contract shared by links and the client router.
 */
export const routes = route({
	home: "/",
	album: "/album/:id",
	photo: "/photo/:id",
});
