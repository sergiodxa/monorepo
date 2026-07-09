/**
 * Auth failure view. Renders a short error message when the OAuth callback cannot
 * complete (provider error, expired transaction, invalid token). It exists so a
 * failed sign-in attempt gets a readable page instead of an unhandled error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import routes from "~/routes/web";

namespace AuthErrorView {
	export interface Props {
		message: string;
	}
}

export default function AuthErrorView(handle: Handle<AuthErrorView.Props>) {
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
				<h1>Sign-in failed</h1>
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
					{handle.props.message}
				</p>
				<a
					href={routes.home.href()}
					mix={[
						css({
							color: "oklch(0.6 0.16 142)",
							textDecoration: "none",
							"&:hover": { textDecoration: "underline" },
							"@media (prefers-color-scheme: dark)": {
								color: "oklch(0.78 0.16 142)",
							},
						}),
					]}
				>
					Back home
				</a>
			</div>
		</main>
	);
}
