/**
 * Home route action controller for the gallery. It loads the album list from the
 * JSONPlaceholder data layer and renders the albums index, or a state-message error
 * view when the fetch fails, serving as the entry screen of the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "@pkg/r3-ui-router";
import { isFailure } from "@pkg/result";

import { getAlbums } from "../data/jsonplaceholder";
import { routes } from "../routes";
import { AlbumsPage } from "../views/albums";
import { StateMessage } from "../views/state-message";

/**
 * Renders the home route after loading albums.
 *
 * @param ctx Current home route context, including abort signal.
 * @returns Album index UI or an error state.
 */
export const renderHome = createAction(routes.home, async function renderHome(ctx) {
	let albums = await getAlbums(ctx.signal);

	if (isFailure(albums)) {
		return <StateMessage title="Could not load albums" message={albums.error.message} />;
	}

	return <AlbumsPage albums={albums.data} />;
});
