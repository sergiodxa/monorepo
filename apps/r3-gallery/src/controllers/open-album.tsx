/**
 * Open-album action controller for the gallery. It reads the submitted album id from
 * the shortcut form, validates that it is an integer, and redirects to the matching
 * album page, or home when the submitted value is invalid, turning the form post into
 * navigation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Action } from "remix/router";

import { redirect } from "remix/response/redirect";

import type { AppContext } from "../router";

import { routes } from "../routes";

/** Redirects form submissions to the requested album page. */
export const openAlbum: Action<typeof routes.openAlbum, AppContext> = async function openAlbum(
	ctx,
) {
	let formData = await ctx.request.formData();
	let submitted = formData.get("albumId");
	let albumId = typeof submitted === "string" ? submitted.trim() : "";

	if (!albumId || !Number.isInteger(Number(albumId))) return redirect(routes.home.href());

	return redirect(routes.album.href({ id: albumId }));
};
