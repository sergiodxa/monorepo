import { css } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";

import action from "../../shared/lib/action";
import { PRISM_CSS } from "../prism-css";

/** Static assets self-served by the engine (currently just prism syntax CSS). */
const ASSETS: Record<string, { contentType: "css"; body: string }> = {
	"prism.css": { contentType: "css", body: PRISM_CSS },
};

/** Serves `/assets/:file` with immutable caching. */
export default action<"GET", "/assets/:file">(async ({ params }) => {
	let asset = ASSETS[params.file];
	if (!asset) return notFound("Not found");
	return css(asset.body, {
		headers: { "cache-control": "public, max-age=31536000, immutable" },
	});
});
