/**
 * Billing entitlements as a fact root: `includes(ctx.billing.features,
 * "reports")` answers `false` for a free account and never fails, so a plan
 * gate is a guard whose reason tells `onDenied` which upgrade to offer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntitlementSnapshot } from "@sdxc/billing/middleware";
import type { RequestContext } from "remix/router";

import { readEntitlements } from "@sdxc/billing/middleware";
import { failure, isFailure, success } from "@sdxc/result";

import type { FactLoader } from "../facts.js";

import { factLoader } from "../facts.js";

/** What a billing fact holds: the products held, and the features granted as a list. */
export interface BillingFacts {
	products: string[];
	/** Every feature the snapshot grants as `true`. */
	features: string[];
}

/** Reads a snapshot off the request, `null` for a subject with nothing billable. */
export type EntitlementLoader = (
	// oxlint-disable-next-line typescript/no-explicit-any -- any route's context
	ctx: RequestContext<any, any>,
) => EntitlementSnapshot | null | Promise<EntitlementSnapshot | null>;

/**
 * Binds entitlements as a fact root. Without a loader it reads through the
 * billing middleware's reader, sharing that request's one read; a `null`
 * snapshot binds two empty lists.
 *
 * @param load Any loader answering a snapshot, in place of the billing middleware's.
 * @example fromEntitlements((ctx) => snapshotOf(ctx.db, ctx.team.id))
 */
export function fromEntitlements(load?: EntitlementLoader): FactLoader<BillingFacts> {
	return factLoader(async ({ context }) => {
		if (context === undefined) {
			return failure(new Error("fromEntitlements() reads a request: bind it through access()"));
		}
		// oxlint-disable-next-line typescript/no-explicit-any -- the access adapter binds the request's own context
		let ctx = context as RequestContext<any, any>;

		let snapshot: EntitlementSnapshot | null;
		if (load === undefined) {
			let read = await readEntitlements(ctx);
			if (isFailure(read)) return read;
			snapshot = read.data;
		} else {
			try {
				snapshot = await load(ctx);
			} catch (error) {
				return failure(error instanceof Error ? error : new Error(String(error)));
			}
		}

		if (snapshot === null) return success({ products: [], features: [] });
		return success({
			products: [...snapshot.products],
			features: Object.entries(snapshot.features)
				.filter(([, granted]) => granted === true)
				.map(([feature]) => feature),
		});
	});
}
