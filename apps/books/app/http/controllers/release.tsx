/**
 * Release controller — the sales page. Reads both packages' live prices and
 * the applicable launch discount from Polar in parallel, formats them as
 * currency, and decides whether the purchasing-power-parity banner loads.
 * This is the page that converts: a failed campaign lookup degrades to list
 * prices and keeps the page live.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discount } from "@pkg/polar";

import { PolarClient } from "@pkg/polar";
import { isSuccess } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

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
 * The shape of a Polar product this page reads. Because this page takes
 * money, a price list that changed shape is caught here before it can render
 * a wrong number; an empty list is valid and reads as zero.
 */
const ProductPricesSchema = s.object({
	prices: s.array(s.object({ priceAmount: s.number() })),
});

/**
 * The shape of the discount this page reads. The amount is required, since
 * there is nothing to subtract without it; the end date is optional and
 * nullable, since a campaign with no closing date is a normal campaign.
 */
const DiscountSchema = s.object({
	amount: s.number(),
	endsAt: s.optional(s.nullable(s.instanceof_(Date))),
});

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
 * Reads the amount and end date off an applicable discount. Parsing stays
 * lenient here: an unrecognized shape falls back to the list price and the
 * page keeps selling, while price parsing stays strict to avoid a wrong price.
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

	let [essentials, complete, discountResult] = await Promise.all([
		polar.getProduct(Product.Essentials),
		polar.getProduct(Product.Complete),
		findApplicableDiscount(polar),
	]);

	if (!isSuccess(discountResult)) {
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

	/**
	 * Only Complete ever carries a discount: the launch campaigns are scoped
	 * to it by the discount-selection rules.
	 */
	let prices: ReleaseViewTypes.Props["prices"] = {
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
			head={ppp ? <script defer src="https://cdn.paritydeals.com/banner.js" /> : undefined}
		>
			<ReleaseView
				prices={prices}
				links={links}
				attribution={readAttribution(ctx.url.searchParams)}
			/>
		</DocumentLayout>,
	);
});
