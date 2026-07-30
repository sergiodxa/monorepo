/**
 * Homepage controller. Renders the pitch and the early-access subscribe form, carrying
 * the request's UTM parameters into the form as hidden fields. Also exports the render
 * itself, because a failed subscribe re-renders this page with the error inline instead
 * of answering with a bare JSON 400.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { createAction } from "remix/fetch-router";

import { readAttribution } from "~/app/lib/attribution";
import { seo } from "~/app/lib/seo";
import DocumentLayout from "~/resources/layouts/document";
import HomeView from "~/resources/views/home";
import routes from "~/routes/web";

/** The homepage's title, which is also the site's name. */
const TITLE = "React Router OAuth2 Handbook";

/**
 * Renders the homepage document.
 *
 * @param ctx - The request context, for its URL and renderer.
 * @param options - `error` shows a subscribe failure under the email field, and `status`
 * lets the subscribe endpoint answer 400 while still returning the page.
 * @returns The rendered HTML response.
 */
export function renderHome(ctx: RequestContext, options: { error?: string; status?: number } = {}) {
	return ctx.render(
		<DocumentLayout
			title={TITLE}
			description={seo.site.description}
			canonical={seo.canonical(ctx.url)}
			schema={[seo.schema.website(), seo.schema.organization({ name: "Sergio Xalambrí" })]}
		>
			<HomeView
				subscribeAction={routes.api.subscribe.href()}
				attribution={readAttribution(ctx.url.searchParams)}
				error={options.error}
			/>
		</DocumentLayout>,
		options.status ? { status: options.status } : undefined,
	);
}

/** GET / — the handbook's landing page. */
export default createAction(routes.home, (ctx) => renderHome(ctx));
