/**
 * A bounded container that groups a header, body content, and footer
 * actions into one visually distinct panel — a border, a subtle shadow, and
 * a tinted surface set by a semantic color role. The role colors the panel's
 * border, background, and text together, and {@link Card.Title} and
 * {@link Card.Description} pick up that same text color through ordinary
 * CSS inheritance rather than reading the role themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { border } from "@pkg/u/color";
import { opacity, rounded } from "@pkg/u/effects";
import { flex, flexCol, items } from "@pkg/u/layout";
import { p, pbe, pi } from "@pkg/u/size";
import { tracking, weight } from "@pkg/u/typography";
import { css } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { semanticColorPanel } from "../styles/semantic-color-panel";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope";

/** Semantic color role {@link Card} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Card.Color = "neutral";

/**
 * Prop types for {@link Card} and its compound parts.
 */
export namespace Card {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` border,
	 * background, and foreground variables.
	 */
	export type Color = SemanticColor;

	/**
	 * Props accepted by {@link Card}.
	 */
	export interface Props extends TagProps<"section"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	}

	/**
	 * Props accepted by {@link Card.Header}.
	 */
	export interface HeaderProps extends TagProps<"header"> {}

	/**
	 * Props accepted by {@link Card.Title}. Every native heading-element
	 * attribute still applies, since the rendered tag depends on the nearest
	 * ambient heading level, falling back to `<h1>` where nothing supplies
	 * one.
	 */
	export interface TitleProps extends TagProps<"h1"> {}

	/**
	 * Props accepted by {@link Card.Description}.
	 */
	export interface DescriptionProps extends TagProps<"p"> {}

	/**
	 * Props accepted by {@link Card.Content}.
	 */
	export interface ContentProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link Card.Footer}.
	 */
	export interface FooterProps extends TagProps<"footer"> {}
}

/**
 * Renders the card panel: a rounded, bordered, softly shadowed `<section>`
 * tinted through the `data-color` attribute contract. Compose
 * {@link Card.Header}, {@link Card.Content}, and {@link Card.Footer} inside
 * it, with {@link Card.Title} and {@link Card.Description} nested in the
 * header.
 *
 * @param handle Runtime handle carrying the host `<section>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <Card>
 * 	<Card.Header>
 * 		<Card.Title>{t("plan.title")}</Card.Title>
 * 		<Card.Description>{t("plan.description")}</Card.Description>
 * 	</Card.Header>
 * 	<Card.Content>{t("plan.body")}</Card.Content>
 * 	<Card.Footer>
 * 		<Button>{t("plan.upgrade")}</Button>
 * 	</Card.Footer>
 * </Card>
 * @example
 * <Card color="danger">
 * 	<Card.Header>
 * 		<Card.Title>{t("errors.billing.title")}</Card.Title>
 * 	</Card.Header>
 * </Card>
 */
export function Card(handle: Handle<Card.Props>) {
	return () => {
		let { color, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;

		return (
			<section
				data-color={resolvedColor}
				{...rest}
				mix={[
					semanticColorPanel(),
					rounded("lg"),
					border({ width: 1 }),
					css({
						boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the card's header slot: a `<header>` stacking its children in a
 * column with a small gap, padded on every side. Nest {@link Card.Title} and
 * {@link Card.Description} inside it.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the header slot's markup.
 * @example
 * <Card.Header>
 * 	<Card.Title>{t("plan.title")}</Card.Title>
 * </Card.Header>
 */
Card.Header = function CardHeader(handle: Handle<Card.HeaderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<header
				{...rest}
				mix={[
					flex(),
					flexCol(),
					p(6, 6),
					css({
						gap: "0.375rem",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the card's heading inside the native heading element matching the
 * nearest ambient heading level — `<h1>` where nothing supplies one — sized
 * as the panel's most prominent line of text with its line height collapsed
 * to one and its letter-spacing tightened slightly. Its text color comes
 * from the card root's `color` value through ordinary CSS inheritance.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the heading's markup.
 * @example
 * <Card.Title>{t("plan.title")}</Card.Title>
 */
Card.Title = function CardTitle(handle: Handle<Card.TitleProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<Tag
				{...rest}
				data-heading-level={resolved}
				mix={[
					css({
						fontSize: "1.5rem",
						lineHeight: "1",
					}),
					weight("semibold"),
					tracking("tight"),
					mix,
				]}
			>
				{rest.children}
			</Tag>
		);
	};
};

/**
 * Renders the card's supporting copy inside a native `<p>`, muted to
 * seventy percent opacity so it reads as secondary to {@link Card.Title}.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 * @example
 * <Card.Description>{t("plan.description")}</Card.Description>
 */
Card.Description = function CardDescription(handle: Handle<Card.DescriptionProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				mix={[
					css({
						fontSize: "0.875rem",
					}),
					opacity(70),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the card's main body slot: a `<div>` padded on every side except
 * its block-start edge, which sits flush against {@link Card.Header} above
 * it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the body slot's markup.
 * @example
 * <Card.Content>{t("plan.body")}</Card.Content>
 */
Card.Content = function CardContent(handle: Handle<Card.ContentProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					css({
						paddingBlockStart: "0",
					}),
					pbe(6),
					pi(6),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the card's footer slot: a `<footer>` laying its children out in a
 * vertically centered row, padded on every side except its block-start edge,
 * which sits flush against the content above it.
 *
 * @param handle Runtime handle carrying the host `<footer>`'s props.
 * @returns The render function producing the footer slot's markup.
 * @example
 * <Card.Footer>
 * 	<Button>{t("plan.upgrade")}</Button>
 * </Card.Footer>
 */
Card.Footer = function CardFooter(handle: Handle<Card.FooterProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<footer
				{...rest}
				mix={[
					flex(),
					items("center"),
					css({
						paddingBlockStart: "0",
					}),
					pbe(6),
					pi(6),
					mix,
				]}
			/>
		);
	};
};
