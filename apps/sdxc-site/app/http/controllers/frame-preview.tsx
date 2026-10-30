/**
 * `GET /frames/previews/…`, `/frames/u/…` and `/frames/guides/:guide/:demo` — a component's
 * live preview or example, a utility example, or a guide's demo, as an HTML fragment for a
 * `<Frame>` to load.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isApplePlatform } from "@sdxc/user-agent/helpers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { ComponentPreview as Preview } from "~/resources/components/ui-previews.server";

import { listUtilityExamples } from "~/app/services/utility-examples";
import ComponentPreview from "~/resources/components/component-preview";
import { findGuideDemo } from "~/resources/components/guide-demo-registry.server";
import { findExample, findPreview } from "~/resources/components/preview-registry.server";
import UtilityExample from "~/resources/components/utility-example";
import { findUtilityExample } from "~/resources/components/utility-example-registry.server";
import ViewportDemo from "~/resources/components/viewport-demo";
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
 * One `@sdxc/u` example, drawn above the code its page prints. The code is read from the
 * example's source rather than the module, so the page and the frame print the same text.
 */
export const frameUtilityExample = createAction(routes.frames.utility, async (ctx) => {
	let { utility, example } = s.parse(
		s.object({ utility: s.string(), example: s.string() }),
		ctx.params,
	);

	let module = await findUtilityExample(utility, example);
	let source = (await listUtilityExamples(utility)).find((it) => it.slug === example);
	if (module === null || source === undefined) {
		return ctx.render(
			<p>
				No example “{example}” for “{utility}”.
			</p>,
			{ status: 404 },
		);
	}

	return ctx.render(
		<UtilityExample code={source.code} align={module.align}>
			{module.render()}
		</UtilityExample>,
	);
});

/**
 * One demo a guide frames. The guide prints the demo's source beside the frame, so the
 * fragment is the demo alone, and an unknown guide or demo answers with a `404` fragment.
 */
export const frameGuideDemo = createAction(routes.frames.guide, async (ctx) => {
	let { guide, demo } = s.parse(s.object({ guide: s.string(), demo: s.string() }), ctx.params);
	let module = findGuideDemo(guide, demo);
	if (module === null) {
		return ctx.render(
			<p>
				No demo “{demo}” for the “{guide}” guide.
			</p>,
			{ status: 404 },
		);
	}

	return ctx.render(
		<ComponentPreview flush={module.flush || module.viewports}>
			{module.viewports ? (
				<ViewportDemo name={`${guide}-${demo}`}>{module.render()}</ViewportDemo>
			) : (
				module.render()
			)}
		</ComponentPreview>,
	);
});

/**
 * Draws a preview with its source behind a toggle, answering with the renderer's own
 * stream: a page inlines only the first chunk of a blocking frame's body, and that stream
 * holds the whole fragment in it. A slug with no preview answers with a `404` fragment.
 */
async function renderPreview(
	ctx: AppContext,
	preview: Preview | null,
	slug: string,
): Promise<Response> {
	if (preview === null) {
		return ctx.render(<p>No preview for “{slug}”.</p>, { status: 404 });
	}

	let node = preview.render({ appleKeyboard: isApplePlatform(ctx) });

	return ctx.render(
		<ComponentPreview code={preview.code} flush={preview.flush || preview.viewports}>
			{preview.viewports ? <ViewportDemo name={slug.replace("/", "-")}>{node}</ViewportDemo> : node}
		</ComponentPreview>,
	);
}
