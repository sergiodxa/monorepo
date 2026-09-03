/**
 * A bounded container grouping a header, body content, and footer actions
 * into one bordered, softly shadowed panel tinted by a semantic color role.
 * The role colors border, background, and text together, so {@link Card.Title}
 * and {@link Card.Description} inherit their text color from the root through
 * ordinary CSS inheritance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { border } from "@sdxc/u/color";
import { opacity, rounded, shadow } from "@sdxc/u/effects";
import { flex, flexCol, gap, items } from "@sdxc/u/layout";
import { p, pbe, pbs, pi } from "@sdxc/u/size";
import { fontSize, leading, tracking, weight } from "@sdxc/u/typography";

import type { SemanticColor } from "../utils/semantic-color.js";

import { semanticColorPanel } from "../styles/semantic-color-panel.js";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope.js";

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
	 * Every native `<section>` attribute, unchanged, plus the `color` role that
	 * tints the panel.
	 */
	export interface Props extends TagProps<"section"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	}

	/** Every native `<header>` attribute, unchanged, plus the `mix` passthrough. */
	export interface HeaderProps extends TagProps<"header"> {}

	/**
	 * Every native heading-element attribute, unchanged: the rendered tag
	 * follows the nearest ambient heading level, falling back to `<h1>` where
	 * nothing supplies one.
	 */
	export interface TitleProps extends TagProps<"h1"> {}

	/** Every native `<p>` attribute, unchanged, plus the `mix` passthrough. */
	export interface DescriptionProps extends TagProps<"p"> {}

	/** Every native `<div>` attribute, unchanged, plus the `mix` passthrough. */
	export interface ContentProps extends TagProps<"div"> {}

	/** Every native `<footer>` attribute, unchanged, plus the `mix` passthrough. */
	export interface FooterProps extends TagProps<"footer"> {}
}

/**
 * The card panel: a rounded, bordered, softly shadowed `<section>` tinted
 * through the `data-color` attribute contract. Compose {@link Card.Header},
 * {@link Card.Content}, and {@link Card.Footer} inside it.
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
				mix={[semanticColorPanel(), rounded("lg"), border({ width: 1 }), shadow("base"), mix]}
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

		return <header {...rest} mix={[flex(), flexCol(), p(6, 6), gap("0.375rem"), mix]} />;
	};
};

/**
 * The card's heading, in the native heading element matching the nearest
 * ambient heading level — `<h1>` where nothing supplies one. Its text color
 * inherits from the card root's `color` value.
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
				mix={[fontSize("2xl"), leading(1), weight("semibold"), tracking("tight"), mix]}
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

		return <p {...rest} mix={[fontSize("sm"), opacity(70), mix]} />;
	};
};

/**
 * The card's main body slot: a `<div>` padded on its inline and block-end
 * edges, leaving its block-start edge flush against {@link Card.Header}.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the body slot's markup.
 * @example
 * <Card.Content>{t("plan.body")}</Card.Content>
 */
Card.Content = function CardContent(handle: Handle<Card.ContentProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} mix={[pbs(0), pbe(6), pi(6), mix]} />;
	};
};

/**
 * The card's footer slot: a `<footer>` laying its children out in a
 * vertically centered row, padded on its inline and block-end edges so it
 * sits flush against the content above.
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

		return <footer {...rest} mix={[flex(), items("center"), pbs(0), pbe(6), pi(6), mix]} />;
	};
};
