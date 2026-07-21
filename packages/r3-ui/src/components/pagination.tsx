/**
 * A navigation landmark for moving between pages of results, composing a
 * `<nav>` root, an `<ul>` list, and `<li>` items around two interactive
 * parts: {@link Pagination.Link} for page-number destinations and
 * {@link Pagination.Button} for previous/next controls. The active page reads
 * straight from the native `aria-current` attribute a consumer sets while
 * rendering the current page's link server-side, with no client-tracked
 * route state anywhere in this module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";
import {
	warnIfNoAccessibleLabel,
	warnIfNoAccessibleName,
} from "../utils/warn-if-no-accessible-name";

/**
 * Prop types for {@link Pagination} and its compound parts.
 */
export namespace Pagination {
	/**
	 * Every native `<nav>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface Props extends TagProps<"nav"> {}

	/**
	 * Every native `<ul>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ListProps extends TagProps<"ul"> {}

	/**
	 * Every native `<li>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ItemProps extends TagProps<"li"> {}

	/**
	 * Every native `<a>` attribute, plus the `mix` passthrough. A type alias
	 * rather than an interface, since the native anchor props resolve through
	 * a conditional type that an `interface extends` clause can't statically
	 * extend. Set `aria-current="page"` directly on the link representing the
	 * page the consumer is currently rendering — the emphasized, filled
	 * treatment reads straight from that attribute, with no separate boolean
	 * prop tracking it. Set `aria-disabled="true"` to mute a link that
	 * shouldn't be followed (an ellipsis placeholder, for instance).
	 */
	export type LinkProps = TagProps<"a">;

	/**
	 * Every native `<button>` attribute, unchanged, plus the `mix` passthrough.
	 * A previous/next control rendering only a directional icon needs an
	 * `aria-label` (e.g. `"Previous"`, `"Next"`) — the component ships no
	 * built-in copy, so a consumer's own localized string always drives what's
	 * announced.
	 */
	export interface ButtonProps extends TagProps<"button"> {}
}

/**
 * Renders the pagination's `<nav>` root, laying its single
 * {@link Pagination.List} child out as a centered row. In dev mode, a root
 * rendered without an `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no way to
 * distinguish this navigation landmark from any other on the page.
 *
 * @param handle Runtime handle carrying the host `<nav>`'s props.
 * @returns The render function producing the navigation landmark's markup.
 * @example
 * <Pagination aria-label={t("pagination.label")}>
 * 	<Pagination.List>
 * 		<Pagination.Item>
 * 			<Pagination.Link href="?page=1" aria-current="page">1</Pagination.Link>
 * 		</Pagination.Item>
 * 	</Pagination.List>
 * </Pagination>
 */
export function Pagination(handle: Handle<Pagination.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			'Pagination: needs an "aria-label" or "aria-labelledby" identifying which set of results it paginates for assistive technology.',
		);

		return (
			<nav
				{...rest}
				data-slot="pagination"
				mix={[
					css({
						display: "flex",
						alignItems: "center",
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the pagination's `<ul>` list, resetting native list markers and
 * spacing and laying {@link Pagination.Item} children out as a centered row
 * with a small gap between them.
 *
 * @param handle Runtime handle carrying the host `<ul>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <Pagination.List>
 * 	<Pagination.Item>
 * 		<Pagination.Link href="?page=1" aria-current="page">1</Pagination.Link>
 * 	</Pagination.Item>
 * 	<Pagination.Item>
 * 		<Pagination.Link href="?page=2">2</Pagination.Link>
 * 	</Pagination.Item>
 * </Pagination.List>
 */
Pagination.List = function PaginationList(handle: Handle<Pagination.ListProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<ul
				{...rest}
				data-slot="list"
				mix={[
					css({
						display: "flex",
						alignItems: "center",
						gap: "0.25rem",
						listStyle: "none",
						margin: "0",
						padding: "0",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a single `<li>` wrapping one {@link Pagination.Link} or
 * {@link Pagination.Button}, centering its content — this element carries no
 * visual styling of its own beyond the layout needed to hold its child.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the item's markup.
 * @example
 * <Pagination.Item>
 * 	<Pagination.Link href="?page=3">3</Pagination.Link>
 * </Pagination.Item>
 */
Pagination.Item = function PaginationItem(handle: Handle<Pagination.ItemProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<li
				{...rest}
				data-slot="item"
				mix={[
					css({
						display: "flex",
						alignItems: "center",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a page-number destination as a native `<a>`, sized as a small
 * square control and colored in the neutral foreground until hovered or
 * marked current. Setting `aria-current="page"` (server-rendered for
 * whichever page the consumer is currently showing) fills the link with the
 * primary solid background and its on-solid foreground, reading as the
 * active page with no client-side route tracking involved. Setting
 * `aria-disabled="true"` mutes the link's color, drops its underline
 * affordance, and blocks pointer interaction — useful for a non-interactive
 * ellipsis placeholder between distant page numbers. A keyboard
 * focus-visible ring reads in the primary color.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the link's markup.
 * @example
 * <Pagination.Link href="?page=4">4</Pagination.Link>
 * @example
 * <Pagination.Link href="?page=5" aria-current="page">5</Pagination.Link>
 * @example
 * <Pagination.Link aria-disabled="true">…</Pagination.Link>
 */
Pagination.Link = function PaginationLink(handle: Handle<Pagination.LinkProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<a
				{...rest}
				data-slot="link"
				mix={[
					interactiveTransition(),
					css({
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						blockSize: "var(--ui-pagination-control-size, 2.25rem)",
						minInlineSize: "var(--ui-pagination-control-size, 2.25rem)",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						paddingInline: "0.75rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						fontWeight: "500",
						textDecoration: "none",
						color: "var(--ui-neutral-fg)",

						"&:hover": {
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
							color: "var(--ui-neutral-fg-emphasis)",
						},
						'&[aria-current]:not([aria-current="false"])': {
							backgroundColor: "var(--ui-primary-bg-solid)",
							color: "var(--ui-primary-fg-on-solid)",
						},
						"&:focus-visible": {
							outlineWidth: "2px",
							outlineStyle: "solid",
							outlineOffset: "2px",
							outlineColor: "var(--ui-primary-ring)",
						},
						'&[aria-disabled="true"]': {
							cursor: "not-allowed",
							pointerEvents: "none",
							opacity: "0.5",
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a previous/next control as a native `<button>`, sized and shaped
 * to match {@link Pagination.Link} so page numbers and directional controls
 * line up in the same row. Hover and pressed states ride the native `:hover`
 * and `:active` pseudo-classes, a keyboard focus-visible ring reads in the
 * primary color, and the native `disabled` attribute mutes the control and
 * blocks pointer and keyboard activation alike.
 *
 * In dev mode, a control whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since a directional
 * icon alone gives assistive technology no accessible name to announce.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <Pagination.Button aria-label={t("pagination.previous")} disabled={!hasPreviousPage}>
 * 	<ChevronLeftIcon aria-hidden />
 * </Pagination.Button>
 * @example
 * <Pagination.Button aria-label={t("pagination.next")} disabled={!hasNextPage}>
 * 	<ChevronRightIcon aria-hidden />
 * </Pagination.Button>
 */
Pagination.Button = function PaginationButton(handle: Handle<Pagination.ButtonProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		warnIfNoAccessibleName(
			handle.props,
			children,
			'Pagination.Button: an icon-only control needs an "aria-label" describing what it does — assistive technology has no accessible text to announce otherwise.',
		);

		return (
			<button
				{...rest}
				data-slot="button"
				mix={[
					interactiveTransition(),
					css({
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						blockSize: "var(--ui-pagination-control-size, 2.25rem)",
						minInlineSize: "var(--ui-pagination-control-size, 2.25rem)",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						paddingInline: "0.75rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						fontWeight: "500",
						color: "var(--ui-neutral-fg)",

						"&:hover": {
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
							color: "var(--ui-neutral-fg-emphasis)",
						},
						"&:active": {
							backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
						},
						"&:focus-visible": {
							outlineWidth: "2px",
							outlineStyle: "solid",
							outlineOffset: "2px",
							outlineColor: "var(--ui-primary-ring)",
						},
						"&:disabled": {
							cursor: "not-allowed",
							opacity: "0.5",
						},
					}),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
};
