import { createAction } from "@pkg/r3-ui-router";
import { isFailure } from "@pkg/result";

import { getAlbum, getAlbumPhotos, getPhoto } from "../data/jsonplaceholder";
import { getLikes } from "../middleware/likes";
import { routes } from "../routes";
import { AlbumPage } from "../views/album";
import { StateMessage } from "../views/state-message";

/**
 * Renders an album and optionally a selected photo overlay.
 *
 * @param ctx Current album route context.
 * @returns Album route UI or an error state.
 */
export const renderAlbum = createAction(routes.album, async function renderAlbum(ctx) {
	let photoId = ctx.url.searchParams.get("photoId");
	let [album, photos, selectedPhoto] = await Promise.all([
		getAlbum(ctx.params.id, ctx.signal),
		getAlbumPhotos(ctx.params.id, ctx.signal),
		photoId ? getPhoto(photoId, ctx.signal) : Promise.resolve(null),
	]);

	if (isFailure(album)) {
		return <StateMessage title="Could not load album" message={album.error.message} />;
	}

	if (isFailure(photos)) {
		return <StateMessage title="Could not load photos" message={photos.error.message} />;
	}

	if (selectedPhoto && isFailure(selectedPhoto)) {
		return (
			<StateMessage title="Could not load selected photo" message={selectedPhoto.error.message} />
		);
	}

	return (
		<AlbumPage
			album={album.data}
			photos={photos.data}
			selectedPhoto={selectedPhoto?.data}
			likedPhotoIds={getLikes(ctx).list(ctx.params.id)}
		/>
	);
});
