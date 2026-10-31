/**
 * A book's landing at `/:book`. Looks the slug up in the catalogue, reads every package's
 * live price and the applicable launch discount in parallel, formats them as currency, and
 * decides whether the purchasing-power-parity banner loads. An unknown slug is a 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BillingError, Product as CatalogProduct } from "@sdxc/billing";
import type { Log } from "@sdxc/logger";

import { ServiceUnavailable } from "@sdxc/http/status-code";
import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { Product } from "~/config/products";
import type { BookLanding as BookLandingTypes, PriceView } from "~/resources/views/book/landing";

import defaultHandler from "~/app/http/controllers/default-handler";
import { seo } from "~/app/initializers/seo";
import { findApplicableDiscount } from "~/app/services/discount";
import { findBook } from "~/config/books";
import { OG_IMAGE_URL } from "~/config/constants";
import { Discounts } from "~/config/products";
import { BOOK_COPY } from "~/resources/content/books";
import DocumentLayout from "~/resources/layouts/document";
import BookLanding from "~/resources/views/book/landing";
import BookFooter from "~/resources/views/site/footer";
import BookHeader from "~/resources/views/site/header";
import routes from "~/routes/web";

/**
 * Prices arrive as whole cents and are shown without cents: the packages are priced in
 * round dollars, so a fraction on the page would only ever be noise.
 */
const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

/** The `:book` segment every book page is addressed by. */
const PARAMS = s.object({ book: s.string() });

function formatCents(cents: number): string {
	return PRICE_FORMATTER.format(cents / 100);
}

/**
 * Derives what the page shows for one package: its list price, and the discounted price
 * when a launch campaign takes an amount off it.
 *
 * @param cents - The package's list price, in cents.
 * @param off - Cents the applicable campaign takes off, or 0 when none applies.
 * @returns The formatted price, and the formatted discounted price when there is one.
 */
function toPriceView(cents: number, off = 0): PriceView {
	if (off <= 0) return { price: formatCents(cents) };
	return { price: formatCents(cents), discounted: formatCents(cents - off) };
}

/**
 * Answers a request whose prices could not be read. It is the one thing this page cannot
 * degrade around: rendering a price as `$0` would sell the book for nothing, so the page is
 * withheld until the platform answers again.
 *
 * @param log - The request's log, which the outage fails.
 * @param error - Why the catalog could not be read.
 * @returns A 503 the visitor can retry.
 */
function priceUnavailable(log: Log, error: BillingError): Response {
	log.fail(error, { billing: { provider_code: error.providerCode } });
	return new Response(null, ServiceUnavailable);
}

/**
 * Reads a package's list price in cents.
 *
 * @param product - The product as the catalog reports it.
 * @returns The first price's amount in cents, or 0 when the product has no price.
 */
function readPriceCents(product: CatalogProduct): number {
	return product.prices.at(0)?.amount?.amount ?? 0;
}

/** GET /:book — the book's landing. */
export default createAction(routes.book, async (ctx) => {
	let book = findBook(s.parse(PARAMS, ctx.params).book);
	if (!book) return defaultHandler(ctx);

	let copy = BOOK_COPY[book.slug];

	let [discountResult, ...catalog] = await Promise.all([
		findApplicableDiscount(ctx.billing),
		...book.packages.map((product) => ctx.billing.catalog.find(product)),
	]);

	let cents = new Map<Product, number>();
	for (let [index, product] of book.packages.entries()) {
		let found = catalog[index];
		if (!found) continue;
		if (isFailure(found)) return priceUnavailable(ctx.log, found.error);
		cents.set(product, readPriceCents(found.data));
	}

	let activeDiscount = isSuccess(discountResult) ? discountResult.data : undefined;

	/**
	 * Purchasing-power-parity pricing is offered except during the early-access campaign,
	 * whose discount is already the deepest the flagship package will ever carry. The flag's
	 * polarity is the whole decision: inverted, parity pricing silently disappears.
	 */
	let ppp = activeDiscount?.id !== Discounts.EARLY;

	/** A launch campaign takes its amount only off the packages it is scoped to. */
	let prices: BookLandingTypes.Props["prices"] = {};
	let payable: number[] = [];
	for (let [product, listCents] of cents) {
		let off = activeDiscount?.productSlugs.includes(product)
			? (activeDiscount.amount?.amount ?? 0)
			: 0;
		prices[product] = toPriceView(listCents, off);
		payable.push(listCents - Math.max(off, 0));
	}

	let slug = { book: book.slug };
	let landing = routes.book.href(slug);
	let links: BookLandingTypes.Links = {
		sample: book.sample ? routes.sample.action.href(slug) : undefined,
		upgrade: book.upgrade ? routes.upgrade.index.href(slug) : undefined,
		checkout: Object.fromEntries(
			book.packages.map((product) => [product, routes.api.checkout.href({ type: product })]),
		),
	};

	let canonical = seo.canonical(ctx.url);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={book.title}
			description={book.description}
			canonical={canonical}
			schema={seo.schema.book({
				name: book.title,
				author: { name: "Sergio Xalambrí", url: "https://sergiodxa.com" },
				description: book.description,
				url: canonical,
				image: OG_IMAGE_URL,
				bookFormat: "https://schema.org/EBook",
				inLanguage: "en",
				numberOfPages: book.pages,
				offers: book.packages.flatMap((product) => {
					let listCents = cents.get(product);
					let pkg = copy.packages[product];
					if (listCents === undefined || !pkg) return [];
					return [
						{
							price: String(listCents / 100),
							priceCurrency: "USD",
							description: pkg.name,
							url: routes.api.checkout.href({ type: product }),
						},
					];
				}),
			})}
			head={ppp ? <script defer src="https://cdn.paritydeals.com/banner.js" /> : undefined}
		>
			<BookHeader landing={landing} title={copy.shortTitle} sample={Boolean(book.sample)} />
			<BookLanding
				book={book}
				copy={copy}
				prices={prices}
				from={formatCents(Math.min(...payable))}
				links={links}
			/>
			<BookFooter
				landing={landing}
				title={copy.shortTitle}
				tagline={book.description}
				sample={book.sample ? routes.sample.index.href(slug) : undefined}
				upgrade={links.upgrade}
			/>
		</DocumentLayout>,
	);
});
