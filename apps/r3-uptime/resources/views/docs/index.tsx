/**
 * Docs index view (`/docs`). Renders one card per section, listing every doc it
 * contains, so visitors can jump straight to any topic without a search widget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { DocSection } from "~/app/services/docs";

import { neutral, primary } from "~/resources/theme";

namespace DocsIndexView {
	export interface Props {
		sections: DocSection[];
	}
}

/** Renders one card per entry in `sections`, listing every doc within it. */
export default function DocsIndexView(handle: Handle<DocsIndexView.Props>) {
	return () => {
		let { sections } = handle.props;

		return (
			<>
				<h1>Documentation</h1>
				<p
					mix={[
						css({
							fontSize: "1.0625rem",
							color: "oklch(0.52 0.01 145)",
							margin: "8px 0 32px",
							"@media (prefers-color-scheme: dark)": { color: neutral[400] },
						}),
					]}
				>
					Guides for getting started, understanding each monitor type, the REST API, and team
					settings.
				</p>

				<div
					mix={[
						css({
							display: "grid",
							gap: 32,
							gridTemplateColumns: "1fr",
							"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
							"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
						}),
					]}
				>
					{sections.map((section) => (
						<div
							key={section.title}
							mix={[
								css({
									display: "block",
									padding: 24,
									borderRadius: 12,
									border: `1px solid ${neutral[200]}`,
									background: "#ffffff",
									color: "inherit",
									textDecoration: "none",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[800],
										background: neutral[900],
									},
								}),
							]}
						>
							<h3
								mix={[
									css({
										fontSize: "1.25rem",
										fontWeight: 600,
										lineHeight: "1.75rem",
										margin: "0 0 6px",
										color: neutral[900],
										"@media (prefers-color-scheme: dark)": { color: neutral[50] },
									}),
								]}
							>
								{section.title}
							</h3>
							{section.docs.map((doc) => (
								<a
									key={doc.path}
									href={doc.path}
									mix={[
										css({
											display: "block",
											fontSize: "0.875rem",
											color: "oklch(0.52 0.01 145)",
											textDecoration: "none",
											marginBottom: 8,
											"&:hover": { color: primary[600] },
											"@media (prefers-color-scheme: dark)": {
												color: neutral[400],
												"&:hover": { color: primary[400] },
											},
										}),
									]}
								>
									{doc.frontmatter.title}
								</a>
							))}
						</div>
					))}
				</div>
			</>
		);
	};
}
