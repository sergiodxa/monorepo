/**
 * Release controller — the sales page. Reads both packages' live prices and
 * the applicable launch discount in parallel, formats them as currency, and
 * decides whether the purchasing-power-parity banner loads. This is the page
 * that converts: a failed campaign lookup degrades to list prices and keeps the
 * page live.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BillingError, Product as CatalogProduct } from "@sdxc/billing";
import type { Log } from "@sdxc/logger";

import { ServiceUnavailable } from "@sdxc/http/status-code";
import { isFailure, isSuccess } from "@sdxc/result";
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
 * Prices arrive as whole cents and are shown without cents: the two packages are
 * priced in round dollars, so a fraction on the page would only ever be noise.
 */
const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

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
 * Answers a request whose prices could not be read. It is the one thing this
 * page cannot degrade around: rendering a price as `$0` would sell the book for
 * nothing, so the page is withheld until the platform answers again.
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

/** GET /release — the sales page. */
export default createAction(routes.release, async (ctx) => {
	let [essentials, complete, discountResult] = await Promise.all([
		ctx.billing.catalog.find(Product.Essentials),
		ctx.billing.catalog.find(Product.Complete),
		findApplicableDiscount(ctx.billing),
	]);

	if (isFailure(essentials)) return priceUnavailable(ctx.log, essentials.error);
	if (isFailure(complete)) return priceUnavailable(ctx.log, complete.error);

	let activeDiscount = isSuccess(discountResult) ? discountResult.data : undefined;

	/**
	 * Purchasing-power-parity pricing is offered except during the early-access campaign,
	 * whose discount is already the deepest the Complete package will ever carry. The flag's
	 * polarity is the whole decision: inverted, parity pricing silently disappears.
	 */
	let ppp = activeDiscount?.id !== Discounts.EARLY;

	let essentialsCents = readPriceCents(essentials.data);
	let completeCents = readPriceCents(complete.data);

	/**
	 * Only Complete ever carries a discount: the launch campaigns are scoped
	 * to it by the discount-selection rules.
	 */
	let prices: ReleaseViewTypes.Props["prices"] = {
		complete: toPriceView(completeCents, activeDiscount?.amount?.amount),
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
