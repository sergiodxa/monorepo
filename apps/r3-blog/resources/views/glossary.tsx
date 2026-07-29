/**
 * View for the public glossary page. Renders each term as a definition-list
 * entry with an anchor id, optional alias, and definition, and highlights the
 * entry matching the current URL fragment via `:target` styles. Exports a helper
 * to build a term's in-page href. Exists to publish the author's term glossary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Heading } from "@pkg/r3-ui";
import { bg, border, fg } from "@pkg/u/color";
import { ringShadow, rounded, transition } from "@pkg/u/effects";
import { gap, grid } from "@pkg/u/layout";
import { m, maxIs, mbs, mis, p } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { text, textDecoration, weight } from "@pkg/u/typography";

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
			<main mix={[grid(), gap(4)]}>
				<Heading level={1} mix={[text("3xl")]}>
					Glossary
				</Heading>
				<p mix={[m(0), maxIs("52ch"), text("lg"), fg("neutral")]}>My definition of some terms.</p>
				<dl mix={[m(0), grid(), gap(3)]}>
					{model.entries.map((item) => (
						/* The same list-row treatment the other public index pages use — a
						tinted, hairline-bordered card on the `lg` radius with one padding step
						on all sides. The border is a real hairline rather than the transparent
						2px placeholder it used to be, so the `:target` highlight recolors an
						existing edge instead of growing one and shifting the row. */
						<div
							key={item.id}
							id={item.slug}
							mix={[
								p(4),
								rounded("lg"),
								bg("neutral.tint"),
								border({ width: 1, color: "neutral" }),
								transition("background-color, border-color, box-shadow", { duration: 120 }),
								when("&:target", [
									bg("brand.tint"),
									border("brand.strong"),
									ringShadow("brand.ring", 3),
								]),
								when("&:target dt", fg("brand.emphasis")),
								when("&:target dd", fg("brand")),
								/* `fg`, not the `muted` weight this line would otherwise take: muted
								is the tone's 500 step and lands under AA on the tint behind it, which
								small print can least afford. */
								when("&:target small", fg("brand")),
							]}
						>
							<dt mix={[m(0), text("xl"), weight("bold"), fg("neutral.emphasis")]}>
								<a href={`#${item.slug}`} mix={[fg("inherit"), textDecoration("none")]}>
									{item.term}
									{item.title && (
										<small mix={[mis(2), text("sm"), fg("neutral.muted")]}>
											(aka {item.title})
										</small>
									)}
								</a>
							</dt>
							<dd mix={[m(0), mbs(2), text("lg"), fg("neutral.emphasis")]}>{item.definition}</dd>
						</div>
					))}
				</dl>
			</main>
		</BlogLayout>
	);
}
