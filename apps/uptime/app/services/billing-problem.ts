/**
 * Whether a team owner's monitoring subscription needs their attention: a payment that
 * failed and left the subscription past due (a paused subscription reads the same), with no
 * other subscription still granting monitoring. The signed-in shell answers it with a banner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UptimeModels } from "~/app/models";

import { isEntitlingStatus } from "~/app/models/subscriptions";

/** The stored status a failed or paused payment leaves a subscription in. */
const PAST_DUE_STATUS = "past_due";

/**
 * Reads the owner's recorded subscriptions once. A revoked row is history and an entitling
 * one means monitoring still runs, so only a live past-due row with nothing entitling beside
 * it counts as a problem.
 *
 * @param models - The request's model registry.
 * @param ownerId - The team owner's subject id, which is the billing customer's external id.
 * @returns `true` when the owner has a payment to fix.
 * @example
 * let banner = (await hasBillingProblem(ctx.models, ctx.team.owner_id)) ? <Banner …/> : null;
 */
export async function hasBillingProblem(models: UptimeModels, ownerId: string): Promise<boolean> {
	let rows = await models.subscriptions.query().where({ external_customer_id: ownerId }).all();
	let live = rows.filter((row) => row.revoked_at === null);
	if (live.some((row) => isEntitlingStatus(row.status))) return false;
	return live.some((row) => row.status === PAST_DUE_STATUS);
}
