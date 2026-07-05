import { css } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { createAction } from "remix/fetch-router";

import routes from "../../routes";
import { PRISM_CSS } from "../prism-css";

/** Static assets self-served by the engine (currently just prism syntax CSS). */
const ASSETS: Record<string, string> = {
	"prism.css": PRISM_CSS,
};

/** Serves `/assets/:file` with immutable caching. */
export default createAction(routes.assets, async ({ params }) => {
	let asset = ASSETS[params.file];
	if (!asset) return notFound("Not found");
	return css(asset, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
});
