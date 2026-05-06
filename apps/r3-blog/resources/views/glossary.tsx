import { css } from "remix/ui";

import { BlogLayout } from "~/resources/components/layout/blog";
import routes from "~/routes/web";

/**
 * Shared types for the glossary page view model.
 */
export namespace GlossaryView {
	/**
	 * Single glossary term rendered in the definition list.
	 */
	export interface Entry {
		id: string;
		slug: string;
		term: string;
		title?: string;
		definition: string;
	}

	/**
	 * Data required to render the glossary page.
	 */
	export interface Model {
		entries: Array<Entry>;
	}
}

/**
 * Builds the in-page URL path for a glossary term slug.
 *
 * @param slug Term identifier used in glossary links.
 * @returns Absolute glossary route for the provided slug.
 */
export function glossaryPathFromSlug(slug: string): string {
	return `/glossary/${slug}`;
}

/**
 * Creates a renderer for the glossary page.
 *
 * @returns View function that renders glossary entries from the model.
 */
export function GlossaryView() {
	return ({ model }: { model: GlossaryView.Model }) => (
		<BlogLayout
			title="Glossary"
			description="My definition of some terms."
			activePath={routes.glossary.href()}
		>
			<main mix={[css({ display: "grid", gap: "1rem" })]}>
				<h1 mix={[css({ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
					Glossary
				</h1>
				<p
					mix={[
						css({
							margin: 0,
							color: "var(--ui-neutral-fg)",
							maxWidth: "52ch",
							fontSize: "1.05rem",
							lineHeight: 1.35,
						}),
					]}
				>
					My definition of some terms.
				</p>
				<dl mix={[css({ margin: 0, display: "grid", gap: "1.1rem" })]}>
					{model.entries.map((item) => (
						<div
							key={item.id}
							id={item.slug}
							mix={[
								css({
									padding: "1rem",
									borderRadius: "0.65rem",
									border: "2px solid transparent",
									backgroundColor: "var(--ui-neutral-bg-tint)",
									transition:
										"background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
									":target": {
										borderColor: "var(--ui-accent-border-strong)",
										backgroundColor: "var(--ui-accent-bg-tint)",
										boxShadow: "0 0 0 3px var(--ui-accent-ring)",
									},
									":target dt": {
										color: "var(--ui-accent-fg-emphasis)",
									},
									":target dd": {
										color: "var(--ui-accent-fg)",
									},
									":target small": {
										color: "var(--ui-accent-fg-muted)",
									},
								}),
							]}
						>
							<dt
								mix={[
									css({
										margin: 0,
										fontSize: "1.5rem",
										fontWeight: 700,
										color: "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								<a href={`#${item.slug}`} mix={[css({ color: "inherit", textDecoration: "none" })]}>
									{item.term}
									{item.title && (
										<small
											mix={[
												css({
													marginLeft: "0.45rem",
													color: "var(--ui-neutral-fg-muted)",
													fontSize: "0.9rem",
												}),
											]}
										>
											(aka {item.title})
										</small>
									)}
								</a>
							</dt>
							<dd
								mix={[
									css({
										margin: "0.4rem 0 0",
										color: "var(--ui-neutral-fg-emphasis)",
										fontSize: "1.05rem",
										lineHeight: 1.5,
									}),
								]}
							>
								{item.definition}
							</dd>
						</div>
					))}
				</dl>
			</main>
		</BlogLayout>
	);
}
