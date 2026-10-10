/**
 * The registry entries for teams, memberships, invites, team domains, API keys, user preferences,
 * account deletions and subscriptions. Each domain lists its own models here, so adding one
 * touches only its domain's file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** This domain's models, keyed by the name `ctx.models` binds each under. */
export const ACCOUNT_MODELS = {
	teamDomains: () => import("../team-domains"),
};
