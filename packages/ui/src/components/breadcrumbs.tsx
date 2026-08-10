/**
 * A trail of links marking the page's position within a hierarchy of parent
 * sections, composing a `<nav>` root, an `<ol>` list, and `<li>` items around
 * {@link Breadcrumbs.Link}, a restyled {@link Link}. Every item but the last
 * draws its separator through a CSS `::after` pseudo-element, so the divider
 * between segments needs no markup of its own, and the trail's current
 * segment reads straight from the native `aria-current` attribute a consumer
 * sets while rendering the page it currently occupies, with no client-tracked
 * route state anywhere in this module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { listStyle, raw } from "@pkg/u/general";
import { flex, gap, items } from "@pkg/u/layout";
import { m, mi, p } from "@pkg/u/size";
import { data, hover, when } from "@pkg/u/state";
import { fontSize, textDecoration, weight } from "@pkg/u/typography";

import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

import { Link } from "./link";

/** Semantic color role {@link Breadcrumbs.Link} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Link.Color = "neutral";

/**
 * Prop types for {@link Breadcrumbs} and its compound parts.
 */
export namespace Breadcrumbs {
	/**
	 * Every native `<nav>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface Props extends TagProps<"nav"> {}

	/**
	 * Every native `<ol>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ListProps extends TagProps<"ol"> {}

	/**
	 * Every native `<li>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ItemProps extends TagProps<"li"> {}

	/**
	 * Every prop {@link Link.Props} accepts, unchanged. A type alias rather
	 * than an interface, since {@link Link.Props} itself resolves through a
	 * conditional type that an `interface extends` clause can't statically
	 * extend. Set `aria-current="page"` on the segment representing the page
	 * currently rendered, and `aria-disabled="true"` to mute a segment that
	 * shouldn't be followed — both states ride straight through to the
	 * underlying {@link Link}.
	 */
	export type LinkProps = Link.Props;
}

/**
 * Renders the trail's `<nav>` root, laying its single {@link Breadcrumbs.List}
 * child out as a row. In dev mode, a root rendered without an `aria-label` or
 * `aria-labelledby` logs a `console.warn`, since assistive technology
 * otherwise has no way to distinguish this navigation landmark from any other
 * on the page.
 *
 * @param handle Runtime handle carrying the host `<nav>`'s props.
 * @returns The render function producing the trail's markup.
 * @example
 * <Breadcrumbs aria-label={t("breadcrumbs.label")}>
 * 	<Breadcrumbs.List>
 * 		<Breadcrumbs.Item>
 * 			<Breadcrumbs.Link href="/">{t("nav.home")}</Breadcrumbs.Link>
 * 		</Breadcrumbs.Item>
 * 		<Breadcrumbs.Item>
 * 			<Breadcrumbs.Link href="/projects" aria-current="page">
 * 				{t("nav.projects")}
 * 			</Breadcrumbs.Link>
 * 		</Breadcrumbs.Item>
 * 	</Breadcrumbs.List>
 * </Breadcrumbs>
 */
export function Breadcrumbs(handle: Handle<Breadcrumbs.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			'Breadcrumbs: needs an "aria-label" or "aria-labelledby" identifying this navigation landmark for assistive technology.',
		);

		return <nav {...rest} data-slot="breadcrumbs" mix={[flex(), items("center"), mix]} />;
	};
}

/**
 * Renders the trail's `<ol>` list, resetting native list markers and spacing
 * and laying {@link Breadcrumbs.Item} children out as a wrapped row with a
 * small gap between them.
 *
 * @param handle Runtime handle carrying the host `<ol>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <Breadcrumbs.List>
 * 	<Breadcrumbs.Item>
 * 		<Breadcrumbs.Link href="/">{t("nav.home")}</Breadcrumbs.Link>
 * 	</Breadcrumbs.Item>
 * </Breadcrumbs.List>
 */
Breadcrumbs.List = function BreadcrumbsList(handle: Handle<Breadcrumbs.ListProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<ol
				{...rest}
				data-slot="list"
				mix={[flex(), items("center"), gap(1), m(0), p(0), listStyle(), mix]}
			/>
		);
	};
};

/**
 * Renders a single `<li>` wrapping one {@link Breadcrumbs.Link}. Every item
 * but the last draws a `›` separator glyph after itself through a CSS
 * `::after` pseudo-element, so the visual divider between segments never
 * needs its own markup or its own entry in the accessibility tree.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the item's markup.
 * @example
 * <Breadcrumbs.Item>
 * 	<Breadcrumbs.Link href="/projects">{t("nav.projects")}</Breadcrumbs.Link>
 * </Breadcrumbs.Item>
 */
Breadcrumbs.Item = function BreadcrumbsItem(handle: Handle<Breadcrumbs.ItemProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<li
				{...rest}
				data-slot="item"
				mix={[
					flex(),
					items("center"),
					gap(1),
					when("&:not(:last-child)::after", [
						mi(1),
						fg("neutral.muted"),
						fontSize("sm"),
						raw({ content: '"›"' }),
					]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders one trail segment as a restyled {@link Link}: sized down to
 * `0.875rem`, its underline dropped entirely so the trail reads as compact
 * labels rather than inline prose, and defaulting to the neutral color role
 * rather than {@link Link}'s own primary default so an ordinary trail stays
 * quiet supporting navigation instead of a set of prominent calls to action.
 * The neutral role starts muted and brightens to the full neutral foreground
 * on hover. Setting `aria-current="page"` (server-rendered for whichever
 * segment the consumer is currently showing) reads through to bold,
 * emphasized text, with no client-side route tracking involved.
 * {@link Link}'s own focus-visible ring and `aria-disabled="true"` handling
 * carry over unchanged.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the segment's markup.
 * @example
 * <Breadcrumbs.Link href="/settings">{t("nav.settings")}</Breadcrumbs.Link>
 * @example
 * <Breadcrumbs.Link href="/settings/profile" aria-current="page">
 * 	{t("nav.profile")}
 * </Breadcrumbs.Link>
 * @example
 * <Breadcrumbs.Link aria-disabled="true">{t("nav.archived")}</Breadcrumbs.Link>
 */
Breadcrumbs.Link = function BreadcrumbsLink(handle: Handle<Breadcrumbs.LinkProps>) {
	return () => {
		let { color, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		return (
			<Link
				color={resolvedColor}
				{...rest}
				data-slot="link"
				mix={[
					fontSize("sm"),
					textDecoration("none"),
					hover(textDecoration("none")),
					data("color", "neutral", [fg("neutral.muted"), hover(fg("neutral"))]),
					when('&[aria-current]:not([aria-current="false"])', [
						weight("medium"),
						fg("neutral.emphasis"),
					]),
					mix,
				]}
			/>
		);
	};
};
