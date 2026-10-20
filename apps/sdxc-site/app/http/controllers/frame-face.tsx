/**
 * `GET /frames/faces/:component` — the schematic PNG a `@sdxc/ui` explorer tile shows.
 * Drawing is cheap enough to do per miss; the response is immutable so the edge and the
 * browser keep it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { readComponent } from "~/app/services/components";
import { renderComponentFace } from "~/app/services/ui-component-face";
import routes from "~/routes/web";

/** Serves one component's explorer face as a PNG. */
export default createAction(routes.frames.face, async (ctx) => {
	let { component } = s.parse(s.object({ component: s.string() }), ctx.params);
	if ((await readComponent(component)) === null) {
		return new Response(null, { status: 404 });
	}

	let bytes = await renderComponentFace(component);
	let face = new File([bytes.slice()], `${component}.png`, { type: "image/png" });
	return new Response(face.stream(), {
		headers: {
			"content-type": "image/png",
			"content-length": String(face.size),
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
});
