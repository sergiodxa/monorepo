/**
 * Controller for `/assets/:file`, serving the engine's small set of self-hosted
 * static assets (currently just the highlighting stylesheet) with immutable caching,
 * so hosts need no build-pipeline cooperation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { css } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { createAction } from "remix/router";

import routes from "../../routes";
import { HIGHLIGHT_CSS } from "../highlight-css";

const ASSETS: Record<string, string> = {
	"highlight.css": HIGHLIGHT_CSS,
};

/** Serves `/assets/:file` with immutable caching. */
export default createAction(routes.assets, async ({ params }) => {
	let asset = ASSETS[params.file];
	if (!asset) return notFound("Not found");
	return css(asset, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
});
