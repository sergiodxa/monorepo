/**
 * Logout confirmation view. Renders a form posting to the logout action so signing
 * out is an explicit, confirmed action rather than a one-click link. It exists as the
 * page shown when a signed-in visitor navigates to `/logout`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import routes from "~/routes/web";

export default function LogoutView(_handle: Handle) {
	return () => (
		<main mix={[css({ display: "flex", flexDirection: "column", minHeight: "100vh" })]}>
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
				<h1 mix={[css({ margin: 0 })]}>Sign out?</h1>
				<form method="post" action={routes.logout.action.href()}>
					<button
						type="submit"
						mix={[
							css({
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "8px 16px",
								borderRadius: 6,
								border: "1px solid transparent",
								background: "oklch(0.24 0.005 145)",
								color: "#ffffff",
								fontFamily: "inherit",
								fontSize: "0.875rem",
								fontWeight: 500,
								cursor: "pointer",
								textDecoration: "none",
								"&:hover": { background: "oklch(0.32 0.006 145)" },
							}),
						]}
					>
						Sign out
					</button>
				</form>
			</div>
		</main>
	);
}
