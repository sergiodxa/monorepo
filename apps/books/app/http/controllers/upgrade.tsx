/**
 * A book's upgrade page at `/:book/upgrade`. Renders the form, then resolves the submitted
 * address against the billing platform: a reader who already bought the book's starting
 * package gets a discounted checkout for the one above it, and anyone else the ordinary
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";
import type { Log } from "@sdxc/logger";

import { toMetadata } from "@sdxc/attribution";
import { redirect } from "@sdxc/http/response";
import { Location } from "@sdxc/location";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { Book } from "~/config/books";
import type { Product } from "~/config/products";

import defaultHandler from "~/app/http/controllers/default-handler";
import { INVALID_EMAIL_MESSAGE, SubscribeSchema } from "~/app/http/validators/subscribe";
import { seo } from "~/app/initializers/seo";
import { findBook } from "~/config/books";
import { BOOK_COPY } from "~/resources/content/books";
import DocumentLayout from "~/resources/layouts/document";
import UpgradeView from "~/resources/views/book/upgrade";
import BookFooter from "~/resources/views/site/footer";
import BookHeader from "~/resources/views/site/header";
import routes from "~/routes/web";

/** The `:book` segment the page is addressed by. */
const PARAMS = s.object({ book: s.string() });

/** A book this page can serve: one the catalogue lists, with an upgrade path. */
type UpgradableBook = Book & { upgrade: NonNullable<Book["upgrade"]> };

/**
 * Resolves the request's `:book` to a book a reader can upgrade within.
 *
 * @param ctx - The request context, for its params.
 * @returns The book, or `undefined` when the slug is unknown or the book has no upgrade.
 */
function findUpgradableBook(ctx: AppContext): UpgradableBook | undefined {
	let book = findBook(s.parse(PARAMS, ctx.params).book);
	if (!book?.upgrade) return undefined;
	return { ...book, upgrade: book.upgrade };
}

/**
 * Pages the ownership check follows before it gives up. A page shorter than the
 * limit is not the last one, so the walk ends on a null cursor; the cap keeps a
 * reader with a long purchase history from holding the form open.
 */
const MAX_ORDER_PAGES = 5;

/**
 * @param ctx - The request context, for its URL and renderer.
 * @param options - `error` shows a validation failure under the email field, and `status` lets the form endpoint answer 400 while still returning the page.
 * @returns The rendered HTML response.
 */
function renderUpgrade(
	ctx: AppContext,
	book: UpgradableBook,
	options: { error?: string; status?: number } = {},
) {
	let copy = BOOK_COPY[book.slug];
	let from = copy.packages[book.upgrade.from];
	let to = copy.packages[book.upgrade.to];
	if (!from || !to) return defaultHandler(ctx);

	let slug = { book: book.slug };
	let landing = routes.book.href(slug);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`Upgrade to the ${to.name} — ${book.title}`}
			description={`Move from ${from.name} to the ${to.name} and pay only the difference.`}
			canonical={seo.canonical(ctx.url)}
		>
			<BookHeader landing={landing} title={copy.shortTitle} sample={Boolean(book.sample)} />
			<UpgradeView
				from={from}
				to={to}
				action={routes.upgrade.action.href(slug)}
				error={options.error}
			/>
			<BookFooter
				landing={landing}
				title={copy.shortTitle}
				tagline={book.description}
				sample={book.sample ? routes.sample.index.href(slug) : undefined}
				upgrade={routes.upgrade.index.href(slug)}
			/>
		</DocumentLayout>,
		options.status ? { status: options.status } : undefined,
	);
}

/**
 * Builds the full-price checkout URL of the package being upgraded to, used for anyone
 * who does not own the package it upgrades from. The address rides along so the hosted checkout
 * arrives pre-filled for the visitor.
 *
 * @param product - The package the upgrade leads to.
 * @param email - The address the reader submitted.
 * @returns The relative checkout URL to redirect to.
 */
function fullCheckoutUrl(product: Product, email: string): string {
	return String(
		new Location({
			pathname: routes.api.checkout.href({ type: product }),
			search: new URLSearchParams({ email }),
		}),
	);
}

/**
 * Answers whether a customer has ever paid for the package an upgrade starts from, which
 * is what the upgrade price is offered against. One order settles it, so the smallest page
 * that can hold a match is asked for and the walk stops at the first one.
 *
 * @param billing - The platform to read orders from.
 * @param product - The package the upgrade starts from.
 * @param customerId - The customer whose orders to look through.
 * @param log - The request's log, so an unreadable order list is traceable.
 * @returns Whether such an order exists; `false` when the list failed.
 */
async function ownsPackage(
	billing: Billing,
	product: Product,
	customerId: string,
	log: Log,
): Promise<boolean> {
	let cursor: string | undefined;

	for (let page = 0; page < MAX_ORDER_PAGES; page++) {
		let orders = await billing.orders.list({
			customer: { id: customerId },
			product,
			limit: 1,
			cursor,
		});

		if (isFailure(orders)) {
			log.warn("upgrade.order_lookup_failed", {
				code: orders.error.code,
				provider_code: orders.error.providerCode,
			});

			return false;
		}

		if (orders.data.items.length > 0) return true;
		if (orders.data.cursor === null) return false;

		cursor = orders.data.cursor;
	}

	return false;
}

/** GET /:book/upgrade — the form that resolves an existing reader's purchase. */
export const index = createAction(routes.upgrade.index, (ctx) => {
	let book = findUpgradableBook(ctx);
	if (!book) return defaultHandler(ctx);
	return renderUpgrade(ctx, book);
});

/** POST /:book/upgrade — resolves the reader's purchase and sends them to the right checkout. */
export const action = createAction(routes.upgrade.action, async (ctx) => {
	let book = findUpgradableBook(ctx);
	if (!book) return defaultHandler(ctx);

	let { discount, from, to } = book.upgrade;
	let log = ctx.log;
	let validation = await validate(ctx.formData, SubscribeSchema);

	if (isFailure(validation)) {
		log.note("upgrade.validation_failed");
		return renderUpgrade(ctx, book, { error: INVALID_EMAIL_MESSAGE, status: 400 });
	}

	let email = validation.data.email.address;
	let customer = await ctx.billing.customers.findByEmail(email);

	if (isFailure(customer)) {
		log.set({ upgrade: { eligible: false } });
		log.note("upgrade.customer_not_found", { code: customer.error.code });
		return redirect(fullCheckoutUrl(to, email), { status: redirect.Status.SeeOther });
	}

	if (!(await ownsPackage(ctx.billing, from, customer.data.id, log))) {
		log.set({ upgrade: { eligible: false } });
		log.note("upgrade.order_not_found");
		return redirect(fullCheckoutUrl(to, email), { status: redirect.Status.SeeOther });
	}

	log.set({
		upgrade: { eligible: true },
		checkout: { product: to },
		discount: { id: discount, applied: true },
	});

	let checkout = await ctx.billing.checkouts.create({
		product: to,
		customer: { id: customer.data.id },
		discount,
		/** The upgrade price is already a discount, so the hosted page collects no code on top. */
		allowDiscountCodes: false,
		metadata: toMetadata(ctx.attribution),
	});

	if (isFailure(checkout)) {
		log.fail(checkout.error, { billing: { provider_code: checkout.error.providerCode } });
		return redirect(fullCheckoutUrl(to, email), { status: redirect.Status.SeeOther });
	}

	log.set({ checkout: { id: checkout.data.id } });

	if (checkout.data.url === null) {
		log.warn("checkout.unpayable");
		return redirect(fullCheckoutUrl(to, email), { status: redirect.Status.SeeOther });
	}

	log.note("checkout.started");

	return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
});
