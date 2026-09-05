/**
 * Discount selection use case. Reads the organization's campaigns and decides
 * which — if any — currently applies to the Complete package, filtering by
 * campaign allow-list, date window, redemption limit, and product scope. It
 * decides what a customer is charged, so the rules are exhaustive and tested.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, BillingError, Discount } from "@sdxc/billing";
import type { Result } from "@sdxc/result";

import { supports } from "@sdxc/billing";
import { currentLog } from "@sdxc/logger";
import { isFailure, success } from "@sdxc/result";

import { Discounts, Product } from "~/app/data/product";

/** How many campaigns to read; the organization runs far fewer than this. */
const PAGE_SIZE = 12;

/** The campaigns that may apply on their own, without a reader being handed one. */
const LAUNCH_CAMPAIGNS: string[] = [Discounts.EARLY, Discounts.FIRST_WEEK, Discounts.SECOND_WEEK];

/**
 * Picks the campaign that currently applies to the Complete package, checking
 * the launch-window campaigns against date window, redemption cap, and product
 * scope, since each guard blocks a different way a stale campaign could apply.
 *
 * @param discounts - The campaigns to choose from, in the order they were read.
 * @returns The first campaign that applies, or `undefined` when none does.
 */
export function selectDiscount(discounts: readonly Discount[]): Discount | undefined {
	let now = new Date();

	return discounts
		.filter((item) => LAUNCH_CAMPAIGNS.includes(item.id))
		.find((item) => {
			if (item.startsAt && item.startsAt > now) return false;
			if (item.endsAt && item.endsAt < now) return false;

			if (item.maxRedemptions && item.redemptions >= item.maxRedemptions) return false;

			if (item.productSlugs.length === 0) return false;

			if (item.productSlugs.some((slug) => slug !== Product.Complete)) return false;

			return true;
		});
}

/**
 * Reads the organization's campaigns and applies {@link selectDiscount} to them.
 * A platform that exposes no campaigns sells at the list price rather than
 * failing the sale, so the pricing page and the checkout both stay live.
 *
 * @param billing - The platform to read campaigns from.
 * @returns `success` with the applicable campaign, or `undefined` when none
 * applies; `failure` only when the campaigns could not be read.
 */
export async function findApplicableDiscount(
	billing: Billing,
): Promise<Result<Discount | undefined, BillingError>> {
	let log = currentLog();

	if (!supports(billing, "discounts")) {
		log?.set({ discount: { applied: false } });
		log?.note("discount.unsupported", { connection: billing.connection });
		return success(undefined);
	}

	let listed = await billing.discounts.list({ limit: PAGE_SIZE });

	if (isFailure(listed)) {
		log?.warn("discount.list_failed", {
			code: listed.error.code,
			provider_code: listed.error.providerCode,
		});

		return listed;
	}

	let discount = selectDiscount(listed.data.items);

	log?.set({
		discount: {
			count: listed.data.items.length,
			applied: discount !== undefined,
			id: discount?.id,
			name: discount?.name,
		},
	});

	return success(discount);
}
