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

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { flex, gap, items } from "@sdxc/u/layout";
import { m, mi, p } from "@sdxc/u/size";
import { data, hover, when } from "@sdxc/u/state";
import { fontSize, textDecoration, weight } from "@sdxc/u/typography";

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
	 * Every prop {@link Link.Props} accepts, unchanged. A type alias rather than
	 * an interface, since {@link Link.Props} resolves through a conditional type
	 * that an `interface extends` clause can't statically extend.
	 */
	export type LinkProps = Link.Props;
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
 * Renders one trail segment as a restyled {@link Link}: sized to `0.875rem`
 * with its underline dropped, defaulting to a quiet neutral color role that
 * brightens on hover and bolds when `aria-current="page"` is set.
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
