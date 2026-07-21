/**
 * A placeholder for a section that currently has nothing to show — a
 * dashed-bordered panel that composes an icon, a title, a description, and
 * an action into one empty-state layout. The compound parts let a consumer
 * include only the pieces a given empty state needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { attrs, css } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { semanticColorPanel } from "../styles/semantic-color-panel";
import { DEFAULT_ICON_ARIA_HIDDEN } from "../utils/decorative-icon";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope";

/**
 * Default {@link Empty.Props.color}, rendering the panel in the neutral
 * tone when a consumer names no semantic color.
 */
const DEFAULT_COLOR = "neutral";

/**
 * Prop types for {@link Empty} and its compound parts.
 */
export namespace Empty {
	/**
	 * Semantic tone driving the panel's border, tint, and foreground color
	 * through the `--ui-*` variables for that color. Every part below the
	 * root reads its own color from the inherited `currentcolor` this sets.
	 */
	export type Color = SemanticColor;

	/**
	 * Props accepted by {@link Empty}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Semantic tone of the panel. Default: `"neutral"`. */
		color?: Color;
		/** The panel's compound parts: {@link Empty.Icon}, {@link Empty.Title}, {@link Empty.Description}, {@link Empty.Action}, or any other content. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Empty.Icon}.
	 */
	export interface IconProps extends TagProps<"div"> {
		/** Icon graphic rendered inside the icon well. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Empty.Title}. Every native heading-element
	 * attribute still applies, since the rendered tag depends on the nearest
	 * ambient heading level, falling back to `<h1>` where nothing supplies
	 * one.
	 */
	export interface TitleProps extends TagProps<"h1"> {
		/** Heading copy for the empty state. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Empty.Description}.
	 */
	export interface DescriptionProps extends TagProps<"p"> {
		/** Supporting copy elaborating on the empty state. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Empty.Action}.
	 */
	export interface ActionProps extends TagProps<"div"> {
		/** Call-to-action content, typically a button or link. */
		children: RemixNode;
	}
}

/**
 * Renders the empty-state panel: a full-width, dashed-bordered, centered
 * column that tints its border, background, and text to the color role in
 * {@link Empty.Props.color}. Compose {@link Empty.Icon}, {@link Empty.Title},
 * {@link Empty.Description}, and {@link Empty.Action} inside it — each part
 * inherits the panel's color through `currentcolor` rather than reading the
 * color role itself.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <Empty>
 * 	<Empty.Icon><InboxIcon /></Empty.Icon>
 * 	<Empty.Title>{t("inbox.empty.title")}</Empty.Title>
 * 	<Empty.Description>{t("inbox.empty.description")}</Empty.Description>
 * 	<Empty.Action>
 * 		<Button>{t("inbox.empty.action")}</Button>
 * 	</Empty.Action>
 * </Empty>
 * @example
 * <Empty color="danger">
 * 	<Empty.Title>{t("errors.notFound.title")}</Empty.Title>
 * </Empty>
 */
export function Empty(handle: Handle<Empty.Props>) {
	return () => {
		let { color = DEFAULT_COLOR, children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-color={color}
				data-slot="empty"
				mix={[
					semanticColorPanel(),
					css({
						display: "flex",
						inlineSize: "100%",
						flexDirection: "column",
						alignItems: "center",
						gap: "0.75rem",
						borderRadius: "var(--ui-radius-xl, 0.75rem)",
						borderWidth: "1px",
						borderStyle: "dashed",
						padding: "2rem",
						textAlign: "center",
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders {@link Empty.IconProps.children} as the icon well: a fully
 * rounded badge, tinted from the current text color, that frames an icon
 * graphic. Hidden from assistive technology by default since the icon is
 * decorative alongside {@link Empty.Title}'s text; pass `aria-hidden={false}`
 * when the icon carries meaning its siblings don't already convey.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the icon well's markup.
 */
Empty.Icon = function EmptyIcon(handle: Handle<Empty.IconProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="icon"
				mix={[
					attrs({ "aria-hidden": DEFAULT_ICON_ARIA_HIDDEN }),
					css({
						display: "flex",
						blockSize: "3rem",
						inlineSize: "3rem",
						alignItems: "center",
						justifyContent: "center",
						borderRadius: "var(--ui-radius-full, 9999px)",
						borderWidth: "1px",
						borderStyle: "solid",
						borderColor: "color-mix(in oklab, currentcolor 20%, transparent)",
						backgroundColor: "color-mix(in oklab, currentcolor 10%, transparent)",
						color: "currentcolor",
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Empty.TitleProps.children} as the empty state's heading, in
 * the native heading element matching its ambient depth — the nearest
 * ancestor `HeadingScope`'s depth, or `<h1>` where no scope wraps it at all
 * — sized and weighted as the panel's primary line of text regardless of
 * which level it renders.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the heading's markup.
 */
Empty.Title = function EmptyTitle(handle: Handle<Empty.TitleProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		let level = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[level];

		return (
			<Tag
				{...rest}
				data-slot="title"
				mix={[
					css({
						fontSize: "1rem",
						lineHeight: "1.375",
						fontWeight: "600",
						letterSpacing: "-0.025em",
					}),
					mix,
				]}
			>
				{children}
			</Tag>
		);
	};
};

/**
 * Renders {@link Empty.DescriptionProps.children} as the empty state's
 * supporting copy, in a native `<p>` set to seventy percent of the panel's
 * current text color so it reads as secondary to {@link Empty.Title}.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 */
Empty.Description = function EmptyDescription(handle: Handle<Empty.DescriptionProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				data-slot="description"
				mix={[
					css({
						fontSize: "0.875rem",
						lineHeight: "1.625",
						color: "color-mix(in oklab, currentcolor 70%, transparent)",
					}),
					mix,
				]}
			>
				{children}
			</p>
		);
	};
};

/**
 * Renders {@link Empty.ActionProps.children} as the empty state's
 * call-to-action slot, spaced a touch below the text above it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action slot's markup.
 */
Empty.Action = function EmptyAction(handle: Handle<Empty.ActionProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="action"
				mix={[
					css({
						marginBlockStart: "0.25rem",
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};
