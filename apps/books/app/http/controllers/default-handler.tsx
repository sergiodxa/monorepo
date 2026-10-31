/**
 * Default request handler. Renders the 404 document for any request that matches no route,
 * or names a book the catalogue does not list, with the way to the featured book.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type { RequestContext } from "remix/router";

import { seo } from "~/app/initializers/seo";
import { FEATURED_BOOK } from "~/config/books";
import { BOOK_COPY } from "~/resources/content/books";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";
import BookFooter from "~/resources/views/site/footer";
import BookHeader from "~/resources/views/site/header";
import routes from "~/routes/web";

/**
 * Renders the 404 document for unmatched routes. Takes only the members it reads, since the
 * router infers its context from the very options this handler is passed in.
 */
export default function defaultHandler(
	ctx: Pick<RequestContext, "assets" | "url"> & { render: Renderer<RemixNode> },
) {
	let description = "The requested page could not be found.";
	let book = FEATURED_BOOK;
	let copy = BOOK_COPY[book.slug];
	let slug = { book: book.slug };
	let landing = routes.book.href(slug);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title="Page not found"
			description={description}
			canonical={seo.canonical(ctx.url)}
			robots={seo.robotsTag({ index: false, follow: true })}
		>
			<BookHeader landing={landing} title={copy.shortTitle} sample={Boolean(book.sample)} />
			<NotFoundView landing={landing} copy={copy} home={routes.home.href()} />
			<BookFooter
				landing={landing}
				title={copy.shortTitle}
				tagline={book.description}
				sample={book.sample ? routes.sample.index.href(slug) : undefined}
				upgrade={book.upgrade ? routes.upgrade.index.href(slug) : undefined}
			/>
		</DocumentLayout>,
		{ status: 404 },
	);
}
