/**
 * Shapes a consent grant for the account area's authorized-apps list: the client's own
 * identity as it registered it, the date consent was given already formatted for the
 * request's language, and whether the grant is the one that cannot be withdrawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { GrantWithClient } from "~/app/data/grant";

/** One row of the authorized-apps list, ready to render. */
export interface GrantRow {
	/** The client the consent was given to, which is what a revoke form posts back. */
	clientId: string;
	/** The client's registered name, falling back to its id when the registration is gone. */
	clientName: string;
	/** The client's own description of itself, when it registered one. */
	clientDescription: string | null;
	/** The client's logo, or `null` so the view can render initials instead. */
	clientLogoUrl: string | null;
	/** When consent was given, formatted for the request's language. */
	authorizedOn: string;
	/**
	 * Whether this grant is this server's own registration.
	 *
	 * Withdrawing it would delete the session the person is reading the page with, so
	 * the row offers no revoke control and the action refuses it server-side too.
	 */
	isAuthServer: boolean;
}

/**
 * Maps a stored grant onto its row.
 *
 * A grant whose client row has disappeared still renders: the consent exists and is
 * worth being able to withdraw, so the client id stands in for the missing name rather
 * than the row being dropped.
 *
 * @param authServerClientId - This server's own client registration.
 * @param locale - Language the consent date is formatted for.
 */
export function toGrantRow(
	grant: GrantWithClient,
	authServerClientId: string,
	locale: string,
): GrantRow {
	return {
		clientId: grant.client_id,
		clientName: grant.client?.name ?? grant.client_id,
		clientDescription: grant.client?.description ?? null,
		clientLogoUrl: grant.client?.logo_url ?? null,
		authorizedOn: new Intl.DateTimeFormat(locale, {
			year: "numeric",
			month: "short",
			day: "numeric",
		}).format(new Date(grant.created_at)),
		isAuthServer: grant.client_id === authServerClientId,
	};
}
