import { createAction } from "@pkg/r3-ui-router";
import { isFailure } from "@pkg/result";

import { getPhoto } from "../data/jsonplaceholder";
import { routes } from "../routes";
import { PhotoPage } from "../views/photo";
import { StateMessage } from "../views/state-message";

/**
 * Renders only a single photo for direct photo route visits and reloads.
 *
 * @param ctx Current photo route context.
 * @returns Standalone photo UI or an error state.
 */
export const renderPhoto = createAction(routes.photo, async function renderPhoto(ctx) {
	let photo = await getPhoto(ctx.params.id, ctx.signal);

	if (isFailure(photo)) {
		return <StateMessage title="Could not load photo" message={photo.error.message} />;
	}

	return <PhotoPage photo={photo.data} />;
});
