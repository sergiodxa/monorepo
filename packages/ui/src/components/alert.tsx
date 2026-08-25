/**
 * An inline status message rendered as a bordered, tinted panel, colored by
 * one of five semantic tones and announced to assistive technology through
 * `role="alert"` plus a configurable `aria-live` politeness. Compound parts
 * cover an optional leading icon, a title/description content block, and a
 * trailing action, so a page composes only the parts a given message needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { border, colorMix, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { absolute, basis, gap, grow, inset, relative, self, shrink, vstack } from "@pkg/u/layout";
import { bs, is, mbe, minIs, p, pis } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { fontSize, leading, tracking, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import type { SemanticColor } from "../utils/semantic-color";

import { semanticColorPanel } from "../styles/semantic-color-panel";
import { DEFAULT_ICON_ARIA_HIDDEN } from "../utils/decorative-icon";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope";

/**
 * `role="alert"` applied through {@link attrs} unless a consumer supplies
 * its own `role`, keeping the panel announced as an ARIA alert by default.
 */
const DEFAULT_ROLE = "alert";

/**
 * Default {@link Alert.Props.color}, rendering an alert with the neutral
 * tone when a consumer names no semantic color.
 */
const DEFAULT_COLOR = "neutral";

/**
 * Default {@link Alert.Props.live}, announcing an alert's content politely so
 * assistive technology finishes its current utterance first.
 */
const DEFAULT_LIVE = "polite";

/**
 * `aria-atomic="true"` applied through {@link attrs} unless a consumer
 * overrides it, so assistive technology re-reads the whole alert on update.
 */
const DEFAULT_ARIA_ATOMIC = "true";

/**
 * Prop types for {@link Alert} and its compound parts.
 */
export namespace Alert {
	/**
	 * Semantic tone driving the host element's border, tint, and foreground
	 * color through the `--ui-*` variables for that color.
	 */
	export type Color = SemanticColor;

	/**
	 * `aria-live` politeness applied to the host element. `"off"` omits the
	 * `aria-live` attribute, leaving the element's implicit live-region
	 * behavior in place.
	 */
	export type Live = "polite" | "assertive" | "off";

	/**
	 * Props accepted by {@link Alert}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Semantic tone of the alert. Default: `"neutral"`. */
		color?: Color;
		/** `aria-live` politeness for dynamic alerts. Default: `"polite"`. */
		live?: Live;
		/** The alert's compound parts: {@link Alert.Icon}, {@link Alert.Content}, {@link Alert.Action}, or any other content. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Alert.Icon}.
	 */
	export interface IconProps extends TagProps<"div"> {
		/** The icon graphic, typically a single SVG icon. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Alert.Content}.
	 */
	export interface ContentProps extends TagProps<"div"> {
		/** The alert's title, description, or other body content. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Alert.Title}. Every native heading-element
	 * attribute applies, since the rendered tag follows the nearest ambient
	 * heading level, falling back to `<h1>`.
	 */
	export interface TitleProps extends TagProps<"h1"> {
		/** The alert's heading text. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Alert.Description}.
	 */
	export interface DescriptionProps extends TagProps<"p"> {
		/** The alert's supporting message text. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Alert.Action}.
	 */
	export interface ActionProps extends TagProps<"div"> {
		/** A button, link, or other control the alert offers, e.g. "Retry" or "Dismiss". */
		children: RemixNode;
	}
}

/**
 * Renders an inline status panel tinted by {@link Alert.Props.color}, gaining
 * inline-start padding through `:has()` when a direct {@link Alert.Icon}
 * needs the room. `role`, `aria-atomic`, and `aria-live` stay overridable.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the alert's markup.
 * @example
 * <Alert color="danger">
 *   <Alert.Icon><CircleAlertIcon /></Alert.Icon>
 *   <Alert.Content>
 *     <Alert.Title>{t("alerts.paymentFailed.title")}</Alert.Title>
 *     <Alert.Description>{t("alerts.paymentFailed.description")}</Alert.Description>
 *   </Alert.Content>
 *   <Alert.Action>
 *     <Button size="sm">{t("alerts.paymentFailed.retry")}</Button>
 *   </Alert.Action>
 * </Alert>
 * @example
 * <Alert color="success" live="assertive">
 *   <Alert.Content>
 *     <Alert.Title>{t("alerts.saved.title")}</Alert.Title>
 *   </Alert.Content>
 * </Alert>
 */
export function Alert(handle: Handle<Alert.Props>) {
	return () => {
		let {
			color = DEFAULT_COLOR,
			live = DEFAULT_LIVE,
			"aria-live": ariaLiveProp,
			children,
			mix,
			...rest
		} = handle.props;
		let ariaLive = ariaLiveProp ?? (live === "off" ? undefined : live);

		return (
			<div
				{...rest}
				aria-live={ariaLive}
				data-color={color}
				data-slot="alert"
				mix={[
					attrs({ role: DEFAULT_ROLE, "aria-atomic": DEFAULT_ARIA_ATOMIC }),
					semanticColorPanel(),
					relative(),
					vstack({ align: "start" }),
					is("full"),
					gap(3),
					rounded("lg"),
					border({ width: 1 }),
					p(4),
					when('&:has(> [data-slot="icon"])', pis(10)),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders {@link Alert.IconProps.children} as the alert's leading icon,
 * absolutely positioned at the panel's inline/block-start corner with any
 * direct SVG sized to `1rem`. Decorative, since the text carries the meaning.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the icon's markup.
 */
Alert.Icon = function AlertIcon(handle: Handle<Alert.IconProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="icon"
				mix={[
					attrs({ "aria-hidden": DEFAULT_ICON_ARIA_HIDDEN }),
					absolute(),
					inset(4, "auto", "auto", 4),
					when("& > svg", [is(4), bs(4)]),
					fg("currentcolor"),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Alert.ContentProps.children} as the alert's body block: a
 * column flex container that shrinks to fit alongside a leading icon or
 * trailing action, holding {@link Alert.Title} and {@link Alert.Description}.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the content block's markup.
 */
Alert.Content = function AlertContent(handle: Handle<Alert.ContentProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="content"
				mix={[vstack({ gap: 1 }), minIs(0), grow(), shrink(1), basis("0%"), mix]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Alert.TitleProps.children} as the alert's heading, inside
 * the native heading element matching the nearest ancestor `HeadingScope`'s
 * depth — or `<h1>` where no scope wraps it — styled as a small, tight label.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the title's markup.
 */
Alert.Title = function AlertTitle(handle: Handle<Alert.TitleProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<Tag
				{...rest}
				data-heading-level={resolved}
				data-slot="title"
				mix={[mbe(1), weight("medium"), leading(1), tracking("tight"), fontSize("sm"), mix]}
			>
				{children}
			</Tag>
		);
	};
};

/**
 * Renders {@link Alert.DescriptionProps.children} as the alert's supporting
 * message, slightly translucent against the alert's foreground color so it
 * reads as secondary to the title. Any nested `<p>` keeps its line height.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 */
Alert.Description = function AlertDescription(handle: Handle<Alert.DescriptionProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				data-slot="description"
				mix={[
					leading("relaxed"),
					when("& p", leading("relaxed")),
					fontSize("sm"),
					fg(colorMix("oklab", { color: "currentcolor", weight: 70 }, "transparent")),
					mix,
				]}
			>
				{children}
			</p>
		);
	};
};

/**
 * Renders {@link Alert.ActionProps.children} as the alert's trailing
 * control — a button, link, or dismiss affordance — pinned to the panel's
 * block-start edge at its own natural size.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action's markup.
 */
Alert.Action = function AlertAction(handle: Handle<Alert.ActionProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div {...rest} data-slot="action" mix={[shrink(), self("start"), mix]}>
				{children}
			</div>
		);
	};
};
