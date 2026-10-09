/**
 * `GET /frames/previews/:component` and `/frames/previews/:component/:example` — a
 * component's live preview, or one of its live examples, as an HTML fragment for a
 * `<Frame>` to load. Reference pages and guides embed the same fragment, so a demo is
 * written once and its islands hydrate wherever it appears.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { isApplePlatform } from "@sdxc/user-agent/helpers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ComponentPreview as Preview } from "~/resources/components/ui-previews.server";

import ComponentPreview from "~/resources/components/component-preview";
import { findExample, findPreview } from "~/resources/components/preview-registry.server";
import routes from "~/routes/web";

/** The opening preview a component's reference page leads with. */
export default createAction(routes.frames.preview, async (ctx) => {
	let { component } = s.parse(s.object({ component: s.string() }), ctx.params);
	return await renderPreview(ctx, findPreview(component), component);
});

/** One live example; the page that embeds it names it, so the fragment stays the demo alone. */
export const frameExample = createAction(routes.frames.example, async (ctx) => {
	let { component, example } = s.parse(
		s.object({ component: s.string(), example: s.string() }),
		ctx.params,
	);
	return await renderPreview(ctx, findExample(component, example), `${component}/${example}`);
});

/**
 * Draws a preview with its source behind a toggle, answering with the renderer's own
 * stream: a page inlines only the first chunk of a blocking frame's body, and that stream
 * holds the whole fragment in it. A slug with no preview answers with a `404` fragment.
 */
async function renderPreview(
	ctx: RequestContext,
	preview: Preview | null,
	slug: string,
): Promise<Response> {
	if (preview === null) {
		return await ctx.render(<p>No preview for “{slug}”.</p>, { status: 404 });
	}

	return await ctx.render(
		<ComponentPreview code={preview.code} flush={preview.flush}>
			{preview.render({ appleKeyboard: isApplePlatform(ctx) })}
		</ComponentPreview>,
	);
}
