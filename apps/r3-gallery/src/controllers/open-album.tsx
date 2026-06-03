import { createAction } from "@pkg/r3-ui-router";

import { routes } from "../routes";

/** Redirects form submissions to the requested album page. */
export const openAlbum = createAction(routes.openAlbum, async function openAlbum(ctx) {
	let formData = await ctx.request.formData();
	let albumId = String(formData.get("albumId") ?? "").trim();

	if (!albumId || !Number.isInteger(Number(albumId))) {
		return new Response(null, { status: 302, headers: { Location: routes.home.href() } });
	}

	return new Response(null, {
		status: 302,
		headers: { Location: routes.album.href({ id: albumId }) },
	});
});
