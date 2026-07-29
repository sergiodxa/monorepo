/**
 * View for the 404 not-found page. Renders the title, description, and emoji
 * supplied by the route model as a centered empty-state panel inside the shared
 * BlogLayout. Exists to give missing routes a friendly, on-brand fallback screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Empty } from "@pkg/r3-ui";
import { maxIs, pbs } from "@pkg/u/size";
import { text } from "@pkg/u/typography";

import { BlogLayout } from "~/resources/components/layout/blog";

/**
 * Type contracts used by the not-found page renderer.
 */
export namespace NotFoundView {
	/**
	 * Content used to render the not-found page.
	 */
	export interface Model {
		title: string;
		description: string;
		emoji: string;
	}
}

/**
 * Creates the not-found page renderer with blog layout styling.
 *
 * @returns A view function that renders the page from a `model` payload.
 */
export function NotFoundView() {
	return ({ model }: { model: NotFoundView.Model }) => (
		<BlogLayout title={model.title} description={model.description}>
			<main mix={[pbs(12)]}>
				{/* The panel supplies the centered column, the emoji well, and the brand
				tint; only the type sizes are pushed up from the panel's compact defaults,
				since a 404 is the whole page rather than a slot inside one. Empty.Title
				still renders an <h1> here because no HeadingScope wraps the layout. */}
				<Empty color="brand">
					<Empty.Icon mix={[text("4xl")]}>{model.emoji}</Empty.Icon>
					<Empty.Title mix={[text("5xl")]}>{model.title}</Empty.Title>
					<Empty.Description mix={[maxIs("56ch"), text("2xl")]}>
						{model.description}
					</Empty.Description>
				</Empty>
			</main>
		</BlogLayout>
	);
}
