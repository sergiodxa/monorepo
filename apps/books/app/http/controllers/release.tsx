/**
 * Release controller — the sales page. Reads both packages' live prices and the applicable
 * launch discount from Polar in parallel, formats them as currency, and decides whether the
 * purchasing-power-parity banner loads. This is the page that converts, so a failed
 * campaign lookup degrades to list prices rather than taking the page down.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discount } from "@pkg/polar";

import { PolarClient } from "@pkg/polar";
import { isSuccess } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import type { PriceView, ReleaseView as ReleaseViewTypes } from "~/resources/views/release";

import { Discounts, Product } from "~/app/data/product";
import { readAttribution } from "~/app/lib/attribution";
import { OG_IMAGE_URL, seo } from "~/app/lib/seo";
import { findApplicableDiscount } from "~/app/services/discount";
import DocumentLayout from "~/resources/layouts/document";
import ReleaseView from "~/resources/views/release";
import routes from "~/routes/web";

/** The page's title and description, which are the book's own. */
const TITLE = "React Router OAuth2 Handbook";
const DESCRIPTION =
	"A practical guide to implementing secure OAuth2 authentication in React Router and Remix applications.";

/** The book's length and format, as the packages describe them. */
const PAGE_COUNT = 47;

/**
 * Prices come from Polar as whole cents, and are shown without cents: the two packages are
 * priced in round dollars, so a fraction on the page would only ever be noise.
 */
const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

/**
 * The shape of a Polar product this page reads. Polar is an external API, so the response is
 * validated rather than trusted: a product whose price list changed shape should fail
 * loudly here instead of rendering a wrong number on a page taking money.
 *
 * An *empty* price list is tolerated and read as zero, which is what the page has always
 * done — a product with no price is a Polar configuration problem, not a malformed response.
 */
const ProductPricesSchema = s.object({
	prices: s.array(s.object({ priceAmount: s.number() })),
});

/**
 * The shape of the discount this page reads, in the same spirit. The amount is required —
 * without it there is nothing to subtract — while the end date is optional and nullable,
 * because a campaign with no closing date is a normal campaign and demanding one would drop
 * a live discount on the floor.
 */
const DiscountSchema = s.object({
	amount: s.number(),
	endsAt: s.optional(s.nullable(s.instanceof_(Date))),
});

/** A cents amount as it reads on the page. */
function formatCents(cents: number): string {
	return PRICE_FORMATTER.format(cents / 100);
}

/**
 * Derives what the page shows for one package: its list price, and the discounted price
 * when a launch campaign applies to it.
 *
 * @param cents - The package's list price, in cents, as Polar reports it.
 * @param discount - The applicable discount, when one applies to this package.
 * @returns The formatted price, and the formatted discounted price when there is one.
 */
function toPriceView(cents: number, discount?: { amount: number }): PriceView {
	if (!discount) return { price: formatCents(cents) };
	return {
		price: formatCents(cents),
		discounted: formatCents(cents - discount.amount),
	};
}

/**
 * Reads a product's list price in cents.
 *
 * @param product - The product as Polar returned it.
 * @returns The first price's amount in cents, or 0 when the product has no price.
 */
function readPriceCents(product: unknown): number {
	let parsed = s.parse(ProductPricesSchema, product);
	return parsed.prices[0]?.priceAmount ?? 0;
}

/**
 * Reads the amount and end date off an applicable discount.
 *
 * Parsed safely, unlike a price: a campaign whose shape this page does not understand — a
 * percentage discount, say, which carries basis points instead of an amount — falls back to
 * the list price, and the page still sells. A price it does not understand is the opposite
 * case, since the only alternative to failing is charging the wrong number.
 *
 * @param discount - The applicable discount, or `undefined` when none applies.
 * @returns The validated amount and end date, or `undefined` when there is none to show.
 */
function readDiscount(discount: Discount | undefined) {
	if (!discount) return undefined;
	let parsed = s.parseSafe(DiscountSchema, discount);
	return parsed.success ? parsed.value : undefined;
}

/** GET /release — the sales page. */
export default createAction(routes.release, async (ctx) => {
	let log = ctx.logger;
	let polar = getServiceContainer().get(PolarClient);

	/* All three reads at once: this is the slowest page in the funnel and the one that
	converts, so the two product lookups and the campaign lookup overlap rather than queue. */
	let [essentials, complete, discountResult] = await Promise.all([
		polar.getProduct(Product.Essentials),
		polar.getProduct(Product.Complete),
		findApplicableDiscount(polar),
	]);

	if (!isSuccess(discountResult)) {
		// List prices are a worse offer, not a broken page, so the failure is logged and the
		// page renders on: a campaign lookup must never cost a sale.
		log.info("discount_lookup_failed", { error: discountResult.error.message });
	}

	let activeDiscount = isSuccess(discountResult) ? discountResult.data : undefined;
	let discount = readDiscount(activeDiscount);

	/**
	 * Purchasing-power-parity pricing is offered except during the early-access campaign,
	 * whose discount is already the deepest the Complete package will ever carry. The flag's
	 * polarity is the whole decision: inverted, parity pricing silently disappears.
	 */
	let ppp = activeDiscount?.id !== Discounts.EARLY;

	let essentialsCents = readPriceCents(essentials);
	let completeCents = readPriceCents(complete);

	let prices: ReleaseViewTypes.Props["prices"] = {
		// Only the Complete package is ever discounted: the launch campaigns are scoped to it,
		// which is exactly what the discount-selection rules enforce.
		complete: toPriceView(completeCents, discount),
		essentials: toPriceView(essentialsCents),
	};

	let links: ReleaseViewTypes.Links = {
		sample: routes.sample.action.href(),
		upgrade: routes.upgrade.index.href(),
		checkout: {
			complete: routes.api.checkout.href({ type: "complete" }),
			essentials: routes.api.checkout.href({ type: "essentials" }),
		},
	};

	let canonical = seo.canonical(ctx.url);

	return ctx.render(
		<DocumentLayout
			title={TITLE}
			description={DESCRIPTION}
			canonical={canonical}
			schema={seo.schema.book({
				name: TITLE,
				author: { name: "Sergio Xalambrí", url: "https://sergiodxa.com" },
				description: DESCRIPTION,
				url: canonical,
				image: OG_IMAGE_URL,
				bookFormat: "https://schema.org/EBook",
				inLanguage: "en",
				numberOfPages: PAGE_COUNT,
				/* One node with an offer per package, not one node per package: the two packages
				are two ways to buy the same book, and a second `Book` node would advertise a
				second book. */
				offers: [
					{
						price: String(completeCents / 100),
						priceCurrency: "USD",
						description: "Complete Package",
						url: links.checkout.complete,
					},
					{
						price: String(essentialsCents / 100),
						priceCurrency: "USD",
						description: "The Book",
						url: links.checkout.essentials,
					},
				],
			})}
			head={
				/* Loaded only when parity pricing is on offer. `defer` because this is the one
				script on the page's critical path and the banner it injects is not: a blocking
				head script would delay the first paint of the page that converts. */
				ppp ? <script defer src="https://cdn.paritydeals.com/banner.js" /> : undefined
			}
		>
			<ReleaseView
				prices={prices}
				links={links}
				attribution={readAttribution(ctx.url.searchParams)}
			/>
		</DocumentLayout>,
	);
});
