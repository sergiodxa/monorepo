/**
 * The registry entries for teams, memberships, invites, team domains, API keys, user
 * preferences, account deletions, subscriptions and billing deliveries. Each domain lists its
 * own models here, so adding one touches only its domain's file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** This domain's models, keyed by the name `ctx.models` binds each under. */
export const ACCOUNT_MODELS = {
	accountDeletions: () => import("../account-deletions"),
	apiKeys: () => import("../api-keys"),
	billingWebhookDeliveries: () => import("../billing-webhook-deliveries"),
	invites: () => import("../invites"),
	memberships: () => import("../memberships"),
	subscriptions: () => import("../subscriptions"),
	teamDomains: () => import("../team-domains"),
	teams: () => import("../teams"),
	userPreferences: () => import("../user-preferences"),
};
