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

/**
 * Stylesheet text {@link SharedElement} renders into a `<style>` element
 * alongside its host, rather than through a `css()` declaration on the host
 * itself. A `@view-transition` at-rule holds only descriptors (`navigation`,
 * `types`) and, unlike `@media`, can never wrap a per-instance selector —
 * `css()` would otherwise nest the host's generated class inside it, which
 * the at-rule's grammar doesn't accept and the browser would simply drop.
 * `::view-transition-group(*)` has the same constraint for a different
 * reason: it selects from the browser's own transition pseudo-element tree,
 * which isn't reachable through any selector rooted at this host's class.
 *
 * `navigation: auto` opts the whole document into cross-document view
 * transitions on same-origin navigation the moment a single instance
 * renders — the declaration is document-wide by nature, not scoped to one
 * element, so every instance repeating it is redundant but harmless. The
 * paired `prefers-reduced-motion` block collapses the morph between an
 * element's old and new position/size down to the plain cross-fade every
 * transitioning element still receives, rather than turning transitions off
 * outright.
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
	 * plus the `mix` passthrough. `id` doubles as the element's view
	 * transition identity — render the same `id` on the corresponding element
	 * in the document navigated to or from, and the browser morphs one into
	 * the other instead of replacing it outright.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * Renders a plain `<div>` host whose `view-transition-name` comes straight
 * from its own `id`, so a same-origin, cross-document navigation recognizes
 * it as the same shared element on both sides and morphs it between its old
 * and new position, size, and appearance instead of popping between them.
 * Rendering even one instance also ships a `<style>` element declaring
 * `@view-transition { navigation: auto; }`, since that opt-in applies to the
 * whole document rather than to any single element. In dev mode, a host
 * rendered without an `id` logs a `console.warn`, since the browser then has
 * nothing to match it against on the other side of the navigation.
 *
 * Cross-document view transitions are a browser-level opt-in this component
 * only prepares the ground for. Pair it with the `viewTransition()` mixin
 * from the mixin layer to also wrap a same-document content swap — a Frame
 * reload — in a view transition of its own.
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

		let resolvedStyle =
			typeof style === "string"
				? `${style};view-transition-name:${id}`
				: { ...style, viewTransitionName: id };

		return (
			<>
				<style>{CROSS_DOCUMENT_TRANSITION_STYLESHEET}</style>
				<div {...rest} id={id} style={resolvedStyle} mix={[block(), mix]} />
			</>
		);
	};
}
