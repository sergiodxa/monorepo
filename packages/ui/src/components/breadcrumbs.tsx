/**
 * A trail of links marking the page's position within a hierarchy of parent
 * sections, composing a `<nav>` root, an `<ol>` list, and `<li>` items around
 * {@link Breadcrumbs.Link}, a restyled {@link Link}. Every item but the last
 * draws its separator through a CSS `::after` pseudo-element, keeping it
 * purely presentational, and the trail's current segment reads straight from
 * the native `aria-current` attribute a consumer sets while rendering the
 * page it currently occupies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { fg } from "@sdxc/u/color";
import { listStyle, pseudoContent } from "@sdxc/u/general";
import { flex, items } from "@sdxc/u/layout";
import { m, mb, mis, p, pb, pi } from "@sdxc/u/size";
import { data, hover, when } from "@sdxc/u/state";
import { fontSize, textDecoration, weight } from "@sdxc/u/typography";

import type { LinkPrefetch } from "../utils/link-prefetch.js";

import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name.js";

import { Link } from "./link.js";

/** Semantic color role {@link Breadcrumbs.Link} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Link.Color = "neutral";

/** Prefetch mode {@link Breadcrumbs.Link} falls back to when `prefetch` is omitted. */
const DEFAULT_PREFETCH: Breadcrumbs.Prefetch = "none";

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
	 * When a segment's destination starts loading: on intent, once in the
	 * viewport, on render through a `<link rel="prefetch">` that also serves
	 * full-document navigations, or only on navigation (`"none"`).
	 */
	export type Prefetch = LinkPrefetch;

	/**
	 * Every prop {@link Link.Props} accepts. A type alias rather than an
	 * interface, since {@link Link.Props} resolves through a conditional type
	 * that an `interface extends` clause can't statically extend.
	 */
	export type LinkProps = Link.Props & {
		/**
		 * Prefetch mode, for segments whose GET is safe to repeat. `"render"` suits
		 * multi-page navigations; a long trail keeps it to its nearest parents, since
		 * each hint is a request on page load. Defaults to {@link DEFAULT_PREFETCH}.
		 */
		prefetch?: Prefetch;
	};
}

/**
 * Renders the trail's `<nav>` root, laying {@link Breadcrumbs.List} as a row.
 * A root missing `aria-label` or `aria-labelledby` logs a dev-mode
 * `console.warn`, since assistive technology needs one to identify this landmark.
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
 * and laying {@link Breadcrumbs.Item} children out in a row whose spacing
 * comes from each {@link Breadcrumbs.Link}'s padding, so the gaps stay clickable.
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
				mix={[flex(), items("center"), m(0), p(0), listStyle(), mix]}
			/>
		);
	};
};

/**
 * Renders a single `<li>` wrapping one {@link Breadcrumbs.Link}. Every item
 * but the last draws a `›` separator glyph via a CSS `::after`
 * pseudo-element, keeping the divider purely presentational.
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
					when("&:not(:last-child)::after", [
						fg("neutral.muted"),
						fontSize("sm"),
						pseudoContent('"›"'),
					]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders one trail segment as a restyled {@link Link}: sized to `0.875rem`
 * with its underline dropped, defaulting to a quiet neutral color role that
 * brightens on hover and bolds when `aria-current="page"` is set.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the segment's markup.
 * @example
 * <Breadcrumbs.Link href="/settings" prefetch="render">{t("nav.settings")}</Breadcrumbs.Link>
 * @example
 * <Breadcrumbs.Link href="/settings/profile" aria-current="page">
 * 	{t("nav.profile")}
 * </Breadcrumbs.Link>
 * @example
 * <Breadcrumbs.Link aria-disabled="true">{t("nav.archived")}</Breadcrumbs.Link>
 */
Breadcrumbs.Link = function BreadcrumbsLink(handle: Handle<Breadcrumbs.LinkProps>) {
	return () => {
		let { color, prefetch, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		return (
			<Link
				color={resolvedColor}
				prefetch={prefetch ?? DEFAULT_PREFETCH}
				{...rest}
				data-slot="link"
				mix={[
					fontSize("sm"),
					/**
					 * The space around each separator lives in the link's own padding, so the
					 * whole gap is clickable; the block padding reaches a 24px target and its
					 * negative margin keeps the row at the text's height. The trail's first link
					 * pulls back by its padding so the trail stays flush with its container.
					 */
					pi(2),
					pb(0.5),
					mb(-0.5),
					when('[data-slot="item"]:first-child > &', mis(-2)),
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
