/**
 * A plain host that carries a stable view-transition identity across
 * separate page loads, so a same-origin, cross-document navigation morphs it
 * from its old position, size, and appearance into its new one instead of
 * replacing it outright. Its identity comes straight from its own `id`,
 * matched against the same `id` on the corresponding element in the document
 * being navigated to or from — no script, snapshotting, or scope wrapper
 * required for this baseline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { block } from "@pkg/u/layout";

import { mergeStyle } from "../utils/merge-style";

/**
 * Written as plain CSS text inside a `<style>` element: `@view-transition`
 * accepts only descriptors, and `::view-transition-group(*)` selects from
 * the browser's own transition tree, both needing selectors written directly in CSS.
 */
const CROSS_DOCUMENT_TRANSITION_STYLESHEET = `
@view-transition {
	navigation: auto;
}

@media (prefers-reduced-motion: reduce) {
	::view-transition-group(*) {
		animation: none;
	}
}
`;

/**
 * Prop types for {@link SharedElement}.
 */
export namespace SharedElement {
	/**
	 * Props accepted by {@link SharedElement}: every native `<div>` attribute
	 * plus the `mix` passthrough. `id` doubles as the view transition identity,
	 * matched against the same `id` in the document navigated to or from.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * Renders a plain `<div>` host whose `view-transition-name` comes from its
 * own `id`, so a same-origin, cross-document navigation matching that `id`
 * on the other side morphs the element instead of replacing it outright.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the host's markup.
 * @example
 * // On the listing page
 * <SharedElement id={`cover-${book.slug}`}>
 * 	<img src={book.coverUrl} alt={book.title} />
 * </SharedElement>
 * @example
 * // On the book's own page — the matching `id` lets the browser morph
 * // between the two instead of swapping the image outright.
 * <SharedElement id={`cover-${book.slug}`}>
 * 	<img src={book.coverUrl} alt={book.title} />
 * </SharedElement>
 */
export function SharedElement(handle: Handle<SharedElement.Props>) {
	return () => {
		let { id, mix, style, ...rest } = handle.props;

		if (import.meta.env.DEV && !id) {
			console.warn(
				'SharedElement rendered without an "id" — the browser has nothing to match it against on the other side of a cross-document view transition.',
			);
		}

		let resolvedStyle = mergeStyle(style, { "view-transition-name": id });

		return (
			<>
				<style>{CROSS_DOCUMENT_TRANSITION_STYLESHEET}</style>
				<div {...rest} id={id} style={resolvedStyle} mix={[block(), mix]} />
			</>
		);
	};
}
