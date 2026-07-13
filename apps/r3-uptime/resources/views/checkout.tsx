/**
 * Billing page shown to non-owner team members: only the team owner can manage
 * billing, so there's nothing to redirect them to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

/** Renders the "owner only" notice shown to non-owner team members who reach the billing page; takes no props. */
export default function CheckoutView(_handle: Handle<Record<string, never>>) {
	return () => (
		<div
			mix={[
				css({
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					textAlign: "center",
					gap: 12,
					padding: "64px 32px",
					border: "1px dashed oklch(0.83 0.01 145)",
					borderRadius: 12,
					"@media (prefers-color-scheme: dark)": {
						borderColor: "oklch(0.42 0.008 145)",
					},
				}),
			]}
		>
			<p
				mix={[
					css({
						fontSize: "0.8125rem",
						color: "oklch(0.62 0.01 145)",
						"@media (prefers-color-scheme: dark)": {
							color: "oklch(0.73 0.01 145)",
						},
					}),
				]}
			>
				Only the team owner can view and manage billing for this team.
			</p>
		</div>
	);
}
