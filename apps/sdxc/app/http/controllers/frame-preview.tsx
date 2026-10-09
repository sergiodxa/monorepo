/**
 * `GET /frames/previews/:component` — one component's live preview as an HTML fragment,
 * for a `<frame>` in a guide's markdown to load. The fragment is the reference page's
 * own preview, so its islands hydrate inside the guide the way they do on that page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isApplePlatform } from "@sdxc/user-agent/helpers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import ComponentPreview from "~/resources/components/component-preview";
import { findPreview } from "~/resources/components/preview-registry.server";
import routes from "~/routes/web";

/**
 * Answers a slug with no preview with a `404` fragment naming it, which the frame draws in
 * place, so a mistyped `src` shows on the page that holds it.
 */
export default createAction(routes.frames.preview, async (ctx) => {
	let { component } = s.parse(s.object({ component: s.string() }), ctx.params);
	let preview = findPreview(component);

	if (preview === null) {
		return await ctx.render(<p>No preview for “{component}”.</p>, { status: 404 });
	}

	let response = await ctx.render(
		<ComponentPreview code={preview.code} flush={preview.flush}>
			{preview.render({ appleKeyboard: isApplePlatform(ctx) })}
		</ComponentPreview>,
	);

	return await withBundleCache(ctx.request, response);
});
