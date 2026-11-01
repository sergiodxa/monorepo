/**
 * Gathers what the account page shows a viewer: their teams with their role in each, their
 * saved preferences, what deleting the account would take with it, any queued deletion, and
 * whether the current team's billing needs attention, for the page and its refused forms alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UptimeModels } from "~/app/models";
import type { TeamWithRole } from "~/app/models/teams";
import type { AccountErasurePlan } from "~/app/services/account-erasure";
import type { SelectAccountDeletion, SelectUserPreferences } from "~/database/schema";

import { planAccountErasure } from "~/app/services/account-erasure";

/** Everything the account page renders for one viewer. */
export interface AccountOverview {
	memberships: TeamWithRole[];
	/** The viewer's saved preferences; `null` until they change one. */
	preferences: SelectUserPreferences | null;
	/** What deleting the account would remove or hand over, listed in the danger zone. */
	plan: AccountErasurePlan;
	/** The viewer's queued deletion request, which swaps the danger zone for a way to cancel it. */
	queuedDeletion: SelectAccountDeletion | null;
}

/**
 * Reads the account page contents for `subjectId`, shown inside `team`'s shell.
 *
 * @param models - The request's model registry.
 * @param subjectId - The signed-in viewer.
 */
export async function loadAccountOverview(
	models: UptimeModels,
	subjectId: string,
): Promise<AccountOverview> {
	let [memberships, preferences, plan, queuedDeletion] = await Promise.all([
		models.teams.listWithRoleForSubject(subjectId),
		models.userPreferences.findBy({ subject_id: subjectId }),
		planAccountErasure(models, subjectId),
		models.accountDeletions.findBy({ subject_id: subjectId }),
	]);

	return { memberships, preferences, plan, queuedDeletion };
}
