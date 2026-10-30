/**
 * `GET /frames/previews/…`, `/frames/u/…` and `/frames/guides/:guide/:demo` — a component's
 * live preview or example, a utility example, or a guide's demo, as an HTML fragment for a
 * `<Frame>` to load, or as a bare page when it is opened directly or framed in an iframe.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { is, maxIs, mi, p } from "@sdxc/u/size";
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
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The opening preview a component's reference page leads with. */
export default createAction(routes.frames.preview, async (ctx) => {
	let { component } = s.parse(s.object({ component: s.string() }), ctx.params);
	return await renderPreview(
		ctx,
		findPreview(component),
		component,
		routes.frames.preview.href({ component }),
	);
});

/** One live example; the page that embeds it names it, so the fragment stays the demo alone. */
export const frameExample = createAction(routes.frames.example, async (ctx) => {
	let { component, example } = s.parse(
		s.object({ component: s.string(), example: s.string() }),
		ctx.params,
	);
	return await renderPreview(
		ctx,
		findExample(component, example),
		`${component}/${example}`,
		routes.frames.example.href({ component, example }),
	);
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
		return renderFrame(
			ctx,
			<p>
				No example “{example}” for “{utility}”.
			</p>,
			{ status: 404 },
		);
	}

	if (isStandalone(ctx.request.headers)) return renderStandalone(ctx, module.render());

	return renderFrame(
		ctx,
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
		return renderFrame(
			ctx,
			<p>
				No demo “{demo}” for the “{guide}” guide.
			</p>,
			{ status: 404 },
		);
	}

	let node = module.render();
	if (isStandalone(ctx.request.headers)) return renderStandalone(ctx, node, module.viewports);

	return renderFrame(
		ctx,
		<ComponentPreview flush={module.flush || module.viewports}>
			{module.viewports ? (
				<ViewportDemo name={`${guide}-${demo}`} src={routes.frames.guide.href({ guide, demo })} />
			) : (
				node
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
	src: string,
): Promise<Response> {
	if (preview === null) {
		return renderFrame(ctx, <p>No preview for “{slug}”.</p>, { status: 404 });
	}

	let node = preview.render({ appleKeyboard: isApplePlatform(ctx) });
	if (isStandalone(ctx.request.headers)) return renderStandalone(ctx, node, preview.viewports);

	return renderFrame(
		ctx,
		<ComponentPreview code={preview.code} flush={preview.flush || preview.viewports}>
			{preview.viewports ? <ViewportDemo name={slug.replace("/", "-")} src={src} /> : node}
		</ComponentPreview>,
	);
}

/**
 * Answers a frame request with the fragment, and a standalone request with that fragment
 * inside the site document, so even a missing demo's message carries the site's styles.
 *
 * @param ctx The request context, read for its headers, assets and renderer.
 * @param node The fragment the frame draws.
 * @param init Status and headers for the response.
 * @returns The rendered response.
 */
function renderFrame(ctx: AppContext, node: RemixNode, init?: ResponseInit): Response {
	if (!isStandalone(ctx.request.headers)) return ctx.render(node, init);
	return renderStandalone(ctx, node, false, init);
}

/**
 * Draws the demo alone as a page: the site document's theme, fonts and stylesheets, with no
 * preview surround, source toggle or site footer, so the URL shows exactly what a stage frames.
 * A page-wide demo meets the viewport's edges; anything smaller sits centred with a margin.
 * The root carries `data-frame-root`, the element a stage's iframe measures its height from.
 *
 * @param ctx The request context, read for its assets and renderer.
 * @param node The demo itself.
 * @param pageWide Whether the demo is a landing band laid out against the whole viewport.
 * @param init Status and headers for the response.
 * @returns The rendered response.
 */
function renderStandalone(
	ctx: AppContext,
	node: RemixNode,
	pageWide = false,
	init?: ResponseInit,
): Response {
	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Live demo — sdxc"
			robots="noindex"
			siteFooter={false}
		>
			<main
				data-frame-root
				mix={pageWide ? [is("100%")] : [is("100%"), maxIs("80rem"), mi("auto"), p(4)]}
			>
				{node}
			</main>
		</DocumentLayout>,
		init,
	);
}

/**
 * Whether the URL was asked for as a page of its own: opened in a tab, or loaded into an
 * `<iframe>` by a viewport stage. A `<Frame>` load carries `X-Remix-Frame` and gets the fragment.
 */
function isStandalone(headers: Headers): boolean {
	if (headers.get("X-Remix-Frame") === "true") return false;
	let destination = headers.get("Sec-Fetch-Dest");
	return destination === "document" || destination === "iframe";
}
