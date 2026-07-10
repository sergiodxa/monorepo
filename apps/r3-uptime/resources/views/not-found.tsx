/**
 * Not-found view component for the r3-uptime app. Renders the 404 page body — a
 * title, a short description, and a link back to the homepage — using the title
 * and description the not-found view model supplies through its handle props. It
 * exists as the presentational piece the default handler and every "unknown slug"
 * marketing/docs controller composes into the document layout when a request
 * doesn't resolve to real content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { NotFoundViewModel } from "~/app/http/view-models/not-found";

import routes from "~/routes/web";

namespace NotFoundView {
	export interface Setup extends NotFoundViewModel.DefaultOutput {}
}

export default function NotFoundView(handle: Handle<NotFoundView.Setup>) {
	return () => {
		let { title, description } = handle.props;

		return (
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
					<h1 mix={[css({ margin: 0 })]}>{title}</h1>
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
						{description}
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
						Go back home
					</a>
				</div>
			</main>
		);
	};
}
