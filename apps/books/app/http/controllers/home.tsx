/**
 * Homepage controller. Renders the featured book's pitch and the subscribe form. Also exports
 * the render itself, because a failed subscribe reuses it to re-render this page with the
 * error shown inline, keeping the failure response an HTML page with a 400 status.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";

import { seo } from "~/app/initializers/seo";
import { FEATURED_BOOK } from "~/config/books";
import { BOOK_COPY } from "~/resources/content/books";
import DocumentLayout from "~/resources/layouts/document";
import HomeView from "~/resources/views/home";
import routes from "~/routes/web";

/**
 * Renders the homepage document.
 *
 * @param ctx - The request context, for its URL and renderer.
 * @param options - `error` shows a subscribe failure under the email field, and `status` lets the subscribe endpoint answer 400 while still returning the page. `confirmEmail` is the address a typo suggestion was shown for, prefilled so resubmitting it keeps it.
 * @returns The rendered HTML response.
 */
export function renderHome(
	ctx: AppContext,
	options: { error?: string; status?: number; confirmEmail?: string } = {},
) {
	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={FEATURED_BOOK.title}
			description={seo.site.description}
			canonical={seo.canonical(ctx.url)}
			schema={[seo.schema.website(), seo.schema.organization({ name: "Sergio Xalambrí" })]}
		>
			<HomeView
				title={FEATURED_BOOK.title}
				copy={BOOK_COPY[FEATURED_BOOK.slug]}
				subscribeAction={routes.api.subscribe.href()}
				error={options.error}
				confirmEmail={options.confirmEmail}
			/>
		</DocumentLayout>,
		options.status ? { status: options.status } : undefined,
	);
}

/** GET / — the newsletter sign-up, which sends a new subscriber on to the featured book. */
export default createAction(routes.home, (ctx) => renderHome(ctx));
