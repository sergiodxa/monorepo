/**
 * Open-album action controller for the gallery. It reads the submitted album id from
 * the shortcut form, validates that it is an integer, and issues a 302 redirect to the
 * matching album page (or back home when invalid), turning the form post into
 * navigation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "@sdxc/ui-router";

import { routes } from "../routes";

/** Redirects form submissions to the requested album page. */
export const openAlbum = createAction(routes.openAlbum, async function openAlbum(ctx) {
	let formData = await ctx.request.formData();
	let submitted = formData.get("albumId");
	let albumId = typeof submitted === "string" ? submitted.trim() : "";

	if (!albumId || !Number.isInteger(Number(albumId))) {
		return new Response(null, { status: 302, headers: { Location: routes.home.href() } });
	}

	return new Response(null, {
		status: 302,
		headers: { Location: routes.album.href({ id: albumId }) },
	});
});
