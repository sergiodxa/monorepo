/**
 * Album route action controller for the gallery. It loads the album and its photos in
 * parallel, surfaces either failure as a state message, and renders the album page with
 * the album's liked photo ids so the grid shows the current like state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Action } from "remix/router";

import { isFailure } from "@sdxc/result";

import type { AppContext } from "../router";

import { getAlbum, getAlbumPhotos } from "../data/jsonplaceholder";
import { getLikes } from "../middleware/likes";
import { routes } from "../routes";
import { AlbumPage } from "../views/album";
import { StateMessage } from "../views/state-message";

/**
 * Renders one album with its photo grid.
 *
 * @param ctx Current album route context.
 * @returns Album route UI or an error state.
 */
export const renderAlbum: Action<typeof routes.album, AppContext> = async function renderAlbum(
	ctx,
) {
	let [album, photos] = await Promise.all([
		getAlbum(ctx.params.id, ctx.request.signal),
		getAlbumPhotos(ctx.params.id, ctx.request.signal),
	]);

	if (isFailure(album)) {
		return ctx.render(<StateMessage title="Could not load album" message={album.error.message} />);
	}

	if (isFailure(photos)) {
		return ctx.render(
			<StateMessage title="Could not load photos" message={photos.error.message} />,
		);
	}

	return ctx.render(
		<AlbumPage
			album={album.data}
			photos={photos.data}
			likedPhotoIds={getLikes(ctx).list(ctx.params.id)}
		/>,
	);
};
