/**
 * The app's own billing policy: which subject a platform customer belongs to, what a team's
 * owner is sent back to after a hosted page, and what "cancel this account's billing" means
 * here. The platform calls themselves are one line each — what this module holds is the
 * decisions around them, so no controller has to re-make them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IdToken } from "@pkg/auth/id-token";
import type { Billing, BillingError, Customer as BillingCustomer } from "@pkg/billing";
import type { Result } from "@pkg/result";

import { BillingError as BillingFailure, supports } from "@pkg/billing";
import { failure, isFailure, success } from "@pkg/result";

import { MONITORING_PRODUCT } from "~/app/lib/billing";
import routes from "~/routes/web";

/** What a hosted page needs to know about the team it was opened for. */
export interface BillableTeam {
	slug: string;
	owner_id: string;
}

/** The states a subscription has to be in for cancelling it to mean anything. */
const CANCELLABLE_STATUSES = ["active", "trialing"] as const;

/** Subscriptions read per page while cancelling, which is far more than an owner ever holds. */
const CANCEL_PAGE_SIZE = 100;

/** Pages the cancellation walk follows before giving up, so no account can hang the sweep. */
const MAX_CANCEL_PAGES = 10;

export default class Customer {
	/**
	 * Resolves a signed-in subject to a platform customer, creating one when the platform holds
	 * none. An address that already has a customer is adopted rather than duplicated, since a
	 * second customer for the same person would split their billing history in two.
	 *
	 * @param billing - The configured platform.
	 * @param idToken - The claims of the subject that just signed in.
	 * @returns The customer the subject bills as.
	 */
	static async provision(
		billing: Billing,
		idToken: IdToken,
	): Promise<Result<BillingCustomer, BillingError>> {
		let linked = await billing.customers.find({ externalId: idToken.subject });
		if (!isFailure(linked)) return linked;
		if (linked.error.code !== "not_found") return linked;

		let email = idToken.email ?? "";
		let matched = await billing.customers.findByEmail(email);

		if (isFailure(matched)) {
			if (matched.error.code !== "not_found") return matched;

			return await billing.customers.create({
				email,
				externalId: idToken.subject,
				name: idToken.name ?? undefined,
			});
		}

		if (matched.data.externalId !== null) return matched;

		return await link(billing, matched.data, idToken.subject);
	}

	/**
	 * Opens the hosted checkout the team's owner subscribes through, returning them to the
	 * team's own dashboard, which is where a completed purchase is visible.
	 *
	 * @param billing - The configured platform.
	 * @param team - The team being subscribed, whose owner pays.
	 * @param url - The current request's URL, which the return address is resolved against.
	 * @returns The page to redirect the owner to.
	 */
	static async checkout(
		billing: Billing,
		team: BillableTeam,
		url: URL,
	): Promise<Result<string, BillingError>> {
		let opened = await billing.checkouts.create({
			product: MONITORING_PRODUCT,
			customer: { externalId: team.owner_id },
			returnTo: returnTo(team, url),
		});

		if (isFailure(opened)) return opened;
		if (opened.data.url === null) return unpayable(billing);

		return success(opened.data.url);
	}

	/**
	 * Opens the hosted portal the team's owner manages an existing subscription through —
	 * upgrades, payment methods and cancellation all live there, so proration stays the
	 * platform's.
	 *
	 * @param billing - The configured platform.
	 * @param team - The team whose billing is being managed.
	 * @param url - The current request's URL, which the return address is resolved against.
	 * @returns The page to redirect the owner to.
	 */
	static async portal(
		billing: Billing,
		team: BillableTeam,
		url: URL,
	): Promise<Result<string, BillingError>> {
		if (!supports(billing, "portal")) return noPortal(billing);

		let opened = await billing.portal.create({
			customer: { externalId: team.owner_id },
			returnTo: returnTo(team, url),
		});

		if (isFailure(opened)) return opened;

		return success(opened.data.url);
	}

	/**
	 * Ends every monitoring subscription the owner still holds, and reports how many. Listing
	 * only the states worth cancelling makes it idempotent: a second pass over an already
	 * cancelled account cancels nothing and succeeds with `0`.
	 *
	 * @param billing - The configured platform.
	 * @param ownerId - The OIDC subject whose billing ends.
	 * @returns How many subscriptions were cancelled.
	 */
	static async cancelSubscriptions(
		billing: Billing,
		ownerId: string,
	): Promise<Result<number, BillingError>> {
		let cursor: string | undefined;
		let cancelled = 0;

		for (let page = 0; page < MAX_CANCEL_PAGES; page++) {
			let listed = await billing.subscriptions.list({
				customer: { externalId: ownerId },
				product: MONITORING_PRODUCT,
				status: [...CANCELLABLE_STATUSES],
				limit: CANCEL_PAGE_SIZE,
				cursor,
			});

			if (isFailure(listed)) return listed;

			for (let subscription of listed.data.items) {
				let ended = await billing.subscriptions.cancel(subscription.id);
				if (isFailure(ended)) return ended;
				cancelled++;
			}

			if (listed.data.cursor === null) break;
			cursor = listed.data.cursor;
		}

		return success(cancelled);
	}
}

/** Where a hosted page sends the owner back to, which is the team they were billing for. */
function returnTo(team: BillableTeam, url: URL): string {
	return new URL(routes.app.team.dashboard.index.href({ team: team.slug }), url).toString();
}

/** A session the platform opened but will not take money through, which is nothing to show. */
function unpayable(billing: Billing): Result<never, BillingError> {
	return failure(
		new BillingFailure("the opened checkout carries no page to pay on", {
			code: "invalid_response",
			connection: billing.connection,
		}),
	);
}

/** A platform with nowhere for an existing subscriber to manage what they already bought. */
function noPortal(billing: Billing): Result<never, BillingError> {
	return failure(
		new BillingFailure("this platform hosts no billing portal", {
			code: "unsupported",
			connection: billing.connection,
		}),
	);
}

/** The one verb {@link link} needs, which a provider exposes as its own configured client. */
interface Linkable {
	patch(path: string, init: { headers: Record<string, string>; body: string }): Promise<Response>;
}

/**
 * Adopts a platform customer created before this subject signed in — by a hosted page that
 * collected only an address, say — so that customer's events arrive naming an owner.
 *
 * It goes through the provider's own client because the contract treats an external id as
 * immutable: `customers.update` has no field for one, which leaves an app no way to claim a
 * record it did not create.
 */
async function link(
	billing: Billing,
	customer: BillingCustomer,
	subject: string,
): Promise<Result<BillingCustomer, BillingError>> {
	let client = billing.native as Linkable;

	let response = await client.patch(`/v1/customers/${encodeURIComponent(customer.id)}`, {
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ external_id: subject }),
	});

	if (!response.ok) {
		return failure(
			new BillingFailure(`the platform refused to link customer ${customer.id}`, {
				code: "unknown",
				connection: billing.connection,
				providerCode: String(response.status),
			}),
		);
	}

	return await billing.customers.find({ externalId: subject });
}
