/**
 * Billing page shown to non-owner team members: only the team owner can manage
 * billing, so there's nothing to redirect them to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";

export default function CheckoutView(_handle: Handle<Record<string, never>>) {
	return () => (
		<div mix={[s.emptyState]}>
			<h1>Billing</h1>
			<p mix={[s.mutedSmall]}>Only the team owner can view and manage billing for this team.</p>
		</div>
	);
}
