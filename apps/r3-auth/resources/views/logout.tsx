/**
 * The logout confirmation page: the interactive way out of the identity provider,
 * shown when a browser reaches `/oidc/logout` without a usable RP-initiated logout
 * request. It is a single form posting back to the same URL, so signing out is a
 * deliberate `POST` rather than something a link on another site can trigger.
 *
 * The page is a whole document rather than a fragment, so it carries no client runtime:
 * nothing on it needs script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import { DOCUMENT, THEME } from "~/resources/styles";
import routes from "~/routes/web";

namespace LogoutView {
	export interface Setup {
		/** Document title, translated by the caller. */
		documentTitle: string;
		/** The question above the button. */
		title: string;
		/** Label of the button that performs the sign-out. */
		cta: string;
	}
}

/** Renders the sign-out confirmation form. */
export default function LogoutView(handle: Handle<LogoutView.Setup>) {
	return () => {
		let { documentTitle, title, cta } = handle.props;

		return (
			<html lang="en" mix={[THEME, DOCUMENT]}>
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{documentTitle}</title>
				</head>
				<body>
					<main
						mix={css({
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "2.5rem",
							margin: "0 auto",
							maxWidth: "40rem",
							padding: "2.5rem 1rem",
							color: "var(--ui-color-neutral-900)",
							"@media (prefers-color-scheme: dark)": {
								color: "var(--ui-color-neutral-50)",
							},
						})}
					>
						<h1 mix={css({ fontSize: "1.875rem", fontWeight: "700", textAlign: "center" })}>
							{title}
						</h1>

						<form method="post" action={routes.oidc.logout.action.href()}>
							<button
								type="submit"
								mix={css({
									backgroundColor: "var(--ui-color-danger-600)",
									border: "none",
									borderRadius: "0.375rem",
									color: "#fff",
									cursor: "pointer",
									fontSize: "1rem",
									fontWeight: "600",
									padding: "0.625rem 1.25rem",
								})}
							>
								{cta}
							</button>
						</form>
					</main>
				</body>
			</html>
		);
	};
}
