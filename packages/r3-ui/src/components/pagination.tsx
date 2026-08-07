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

import { bg, fg, outline } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { cursor, listStyle, pointerEvents } from "@pkg/u/general";
import { flex, gap, inlineFlex, items, justify } from "@pkg/u/layout";
import { bs, m, minIs, p, pi } from "@pkg/u/size";
import { active, hover, when } from "@pkg/u/state";
import { text, textDecoration, weight } from "@pkg/u/typography";

import { interactiveTransition } from "../styles/interactive-transition";
import {
	warnIfNoAccessibleLabel,
	warnIfNoAccessibleName,
} from "../utils/warn-if-no-accessible-name";

/**
 * `type` given to a {@link Pagination.Button} carrying an Invoker Command, for
 * which the platform accepts no other value.
 */
const INVOKER_TYPE = "button";

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
	 * announced. `type` is defaulted only for a control carrying an Invoker
	 * Command, which cannot be a submit button; left off otherwise, so a control
	 * inside a `<form>` keeps the native submit default.
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

		return <nav {...rest} data-slot="pagination" mix={[flex(), items("center"), mix]} />;
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
				mix={[flex(), items("center"), gap("0.25rem"), m("0"), p("0"), listStyle(), mix]}
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

		return <li {...rest} data-slot="item" mix={[flex(), items("center"), mix]} />;
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
					inlineFlex(),
					items("center"),
					justify("center"),
					bs("var(--ui-pagination-control-size, 2.25rem)"),
					minIs("var(--ui-pagination-control-size, 2.25rem)"),
					rounded("md"),
					pi("0.75rem"),
					weight(500),
					fg("neutral"),
					hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
					when('&[aria-current]:not([aria-current="false"])', [
						bg("brand.solid"),
						fg("brand.onSolid"),
					]),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					when('&[aria-disabled="true"]', opacity(50)),
					text("sm"),
					textDecoration("none"),
					when('&[aria-disabled="true"]', [cursor("not-allowed"), pointerEvents()]),
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
 * A control carrying `command` or `commandfor` renders `type="button"` unless
 * it's given a `type` of its own, and renders it before the consumer's own
 * attributes: inside a `<form>` an untyped button would default to `"submit"`,
 * and the platform then refuses to run its command at all, calling the pairing
 * ambiguous — the control would look wired up and do nothing. It judges that
 * while it parses the command attributes, so a `type` written after them is
 * refused the same way. A control with no command is left untyped, which keeps a
 * previous/next control that a consumer wired to a real form submitting it, the
 * way it always has.
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
		let { type, children, mix, ...rest } = handle.props;
		let isInvoker = rest.command !== undefined || rest.commandfor !== undefined;
		let resolvedType = type ?? (isInvoker ? INVOKER_TYPE : undefined);

		warnIfNoAccessibleName(
			handle.props,
			children,
			'Pagination.Button: an icon-only control needs an "aria-label" describing what it does — assistive technology has no accessible text to announce otherwise.',
		);

		return (
			// `type` is written before the spread on purpose. The rendered attribute order
			// is the JSX order, and the platform decides whether an invoker is ambiguous
			// while parsing `command`/`commandfor` — a `type` that arrives after them has
			// not been seen yet, so the button still counts as a submit button and the
			// command is refused even though the attribute is right there in the markup.
			<button
				type={resolvedType}
				{...rest}
				data-slot="button"
				mix={[
					interactiveTransition(),
					inlineFlex(),
					items("center"),
					justify("center"),
					bs("var(--ui-pagination-control-size, 2.25rem)"),
					minIs("var(--ui-pagination-control-size, 2.25rem)"),
					rounded("md"),
					pi("0.75rem"),
					weight(500),
					fg("neutral"),
					hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
					active(bg("neutral.bg-tint-pressed")),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					when("&:disabled", opacity(50)),
					text("sm"),
					when("&:disabled", cursor("not-allowed")),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
};
