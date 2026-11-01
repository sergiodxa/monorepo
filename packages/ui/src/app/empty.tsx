/**
 * A placeholder for a product section that has nothing to show, typed by why:
 * first run, no results, all cleared, no permission, or an error. The `kind`
 * picks the icon, tone and frame; every word stays a prop, and a compact size
 * fits inside a card or a table body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import {
	CheckCheckIcon,
	CircleAlertIcon,
	InboxIcon,
	LockKeyholeIcon,
	SearchXIcon,
} from "@sdxc/icons";
import { bg, border, colorMix, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw, userSelect } from "@sdxc/u/general";
import { flex, flexCol, flexWrap, gap, items, justify } from "@sdxc/u/layout";
import { is, mbs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import {
	balance,
	font,
	fontSize,
	leading,
	overflowWrap,
	pretty,
	textAlign,
	tracking,
	weight,
} from "@sdxc/u/typography";
import { attrs } from "remix/component";

import type { SemanticColor } from "../utils/semantic-color.js";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";
import { semanticColorPanel } from "../styles/semantic-color-panel.js";
import { DEFAULT_ICON_ARIA_HIDDEN } from "../utils/decorative-icon.js";

/**
 * Default {@link Empty.Props.color}, rendering the panel in the neutral
 * tone when a consumer names no semantic color.
 */
const DEFAULT_COLOR = "neutral";

/**
 * Tone each {@link Empty.Kind} takes unless `color` says otherwise: a cleared
 * queue reads as done, an error as a failure, the rest stay quiet.
 */
const COLOR_BY_KIND: Record<Empty.Kind, Empty.Color> = {
	"first-run": "neutral",
	"no-results": "neutral",
	cleared: "success",
	permission: "neutral",
	error: "danger",
};

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
	 * Why the section is empty: `first-run` (welcome, one create action), `no-results`
	 * (quote the query, offer Clear filters), `cleared` ("All caught up"), `permission`
	 * (name who grants access), `error` (Retry and the request id).
	 */
	export type Kind = "first-run" | "no-results" | "cleared" | "permission" | "error";

	/** `"compact"` tightens the panel to sit inside a card or a table body. */
	export type Size = "default" | "compact";

	/**
	 * Props accepted by {@link Empty}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Semantic tone of the panel. Default: the kind's tone, else `"neutral"`. */
		color?: Color;
		/** Why it is empty; draws that cause's icon, tone and frame. */
		kind?: Kind;
		/**
		 * Icon a `kind` draws in place of its default, or `null` for none. Leave
		 * it unset and pass {@link Empty.Icon} yourself when `kind` is unset.
		 */
		icon?: RemixNode;
		/** Default: `"default"`. */
		size?: Size;
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
	 * Props accepted by {@link Empty.Title}. The rendered tag depends on the
	 * nearest ambient heading level, falling back to `<h1>` where nothing
	 * supplies one; every native heading-element attribute still applies.
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

	/**
	 * Props accepted by {@link Empty.Query}.
	 */
	export interface QueryProps extends TagProps<"q"> {
		/** The search text or filter the reader typed, verbatim. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Empty.RequestId}.
	 */
	export interface RequestIdProps extends TagProps<"p"> {
		/** Visible label before the id, such as "Request ID". */
		label: string;
		/** The id support needs to find the failed request. */
		children: RemixNode;
	}
}

/**
 * Renders the empty-state panel, a column tinted to its color role. A `kind`
 * leads with its own icon and frame: a dashed outline for a first run, no
 * frame for no results or a cleared list, a solid one for permission or error.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <Empty kind="first-run">
 * 	<Empty.Title>{t("monitors.empty.title")}</Empty.Title>
 * 	<Empty.Description>{t("monitors.empty.description")}</Empty.Description>
 * 	<Empty.Action><Button>{t("monitors.empty.create")}</Button></Empty.Action>
 * </Empty>
 * @example
 * <Empty kind="no-results" size="compact">
 * 	<Empty.Title>{t("search.none")}</Empty.Title>
 * 	<Empty.Description>{t("search.noMatch")} <Empty.Query>{query}</Empty.Query></Empty.Description>
 * 	<Empty.Action><Button href="?">{t("filters.clear")}</Button></Empty.Action>
 * </Empty>
 * @example
 * <Empty kind="error">
 * 	<Empty.Title>{t("errors.load")}</Empty.Title>
 * 	<Empty.RequestId label={t("errors.requestId")}>{requestId}</Empty.RequestId>
 * </Empty>
 */
export function Empty(handle: Handle<Empty.Props>) {
	return () => {
		let { color, kind, icon, size = "default", children, mix, ...rest } = handle.props;
		let resolvedColor = color ?? (kind ? COLOR_BY_KIND[kind] : DEFAULT_COLOR);
		let leading = kind && icon !== null ? (icon ?? <EmptyKindIcon kind={kind} />) : null;

		return (
			<div
				{...rest}
				data-color={resolvedColor}
				data-kind={kind}
				data-size={size}
				data-slot="empty"
				mix={mergeMix(
					[
						semanticColorPanel(),
						flex(),
						flexCol(),
						is("full"),
						items("center"),
						gap(3),
						rounded("xl"),
						border({ width: "1px", style: "dashed" }),
						p(8),
						textAlign("center"),
						when(
							'&[data-kind="no-results"], &[data-kind="cleared"]',
							raw({ borderColor: "transparent", backgroundColor: "transparent" }),
						),
						when('&[data-kind="permission"], &[data-kind="error"]', raw({ borderStyle: "solid" })),
						when('&[data-size="compact"]', [
							p(4),
							gap(2),
							rounded("lg"),
							raw({
								"--ui-empty-icon-size": "2rem",
								"--ui-empty-title-size": "var(--ui-text-sm, 0.875rem)",
							}),
						]),
					],
					mix,
				)}
			>
				{leading ? <Empty.Icon>{leading}</Empty.Icon> : null}
				{children}
			</div>
		);
	};
}

/**
 * Draws the icon that names an {@link Empty.Kind} at a glance, so the cause
 * reads before the title does.
 *
 * @param handle Runtime handle carrying the kind.
 * @returns The render function producing the icon.
 */
function EmptyKindIcon(handle: Handle<{ kind: Empty.Kind }>) {
	return () => {
		let { kind } = handle.props;
		if (kind === "no-results") return <SearchXIcon size={20} />;
		if (kind === "cleared") return <CheckCheckIcon size={20} />;
		if (kind === "permission") return <LockKeyholeIcon size={20} />;
		if (kind === "error") return <CircleAlertIcon size={20} />;
		return <InboxIcon size={20} />;
	};
}

/**
 * Renders {@link Empty.IconProps.children} as the icon well: a fully
 * rounded, tinted badge framing an icon graphic hidden from assistive
 * technology, since {@link Empty.Title}'s text already names the state.
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
				mix={mergeMix(
					[
						attrs({ "aria-hidden": DEFAULT_ICON_ARIA_HIDDEN }),
						flex(),
						raw({
							blockSize: "var(--ui-empty-icon-size, 3rem)",
							inlineSize: "var(--ui-empty-icon-size, 3rem)",
						}),
						items("center"),
						justify("center"),
						rounded("full"),
						border({ width: "1px", style: "solid" }),
						fg("currentcolor"),
						border(colorMix("oklab", { color: "currentcolor", weight: 20 }, "transparent")),
						bg(colorMix("oklab", { color: "currentcolor", weight: 10 }, "transparent")),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Empty.TitleProps.children} as the empty state's heading,
 * in the native heading element matching its ambient `HeadingScope` depth
 * (or `<h1>` unscoped), sized as the panel's primary text regardless of level.
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
				mix={mergeMix(
					[
						weight("semibold"),
						tracking("tight"),
						raw({ fontSize: "var(--ui-empty-title-size, var(--ui-text-base, 1rem))" }),
						leading("snug"),
						balance(),
					],
					mix,
				)}
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
				mix={mergeMix(
					[
						fontSize("sm"),
						leading("relaxed"),
						pretty(),
						fg(colorMix("oklab", { color: "currentcolor", weight: 70 }, "transparent")),
					],
					mix,
				)}
			>
				{children}
			</p>
		);
	};
};

/**
 * Renders {@link Empty.ActionProps.children} as the empty state's
 * call-to-action slot: a centered, wrapping row spaced a touch below the
 * text above it, so a state offering more than one action lays them out
 * rather than running them together.
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
				mix={mergeMix(
					[
						/**
						 * The slot lays out however many actions the state offers as a centered row that
						 * wraps, since two buttons side by side outgrow a narrow panel.
						 */
						flex(),
						flexWrap(),
						items("center"),
						justify("center"),
						gap(2),
						mbs(1),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders the reader's query inside a `no-results` description as a native
 * `<q>`, so the browser adds the locale's own quotation marks around it and
 * the reader sees exactly what to change.
 *
 * @param handle Runtime handle carrying the host `<q>`'s props.
 * @returns The render function producing the quotation's markup.
 * @example
 * <Empty.Description>No monitors match <Empty.Query>{query}</Empty.Query>.</Empty.Description>
 */
Empty.Query = function EmptyQuery(handle: Handle<Empty.QueryProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<q
				{...rest}
				data-slot="query"
				mix={mergeMix([weight("medium"), fg("currentcolor"), overflowWrap("anywhere")], mix)}
			>
				{children}
			</q>
		);
	};
};

/**
 * Renders an `error` state's request id under a label, in monospace that
 * selects whole on one click, so the reader can copy it into a support
 * message without a script.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the request id's markup.
 * @example
 * <Empty.RequestId label={t("errors.requestId")}>{requestId}</Empty.RequestId>
 */
Empty.RequestId = function EmptyRequestId(handle: Handle<Empty.RequestIdProps>) {
	return () => {
		let { label, children, mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				data-slot="request-id"
				mix={mergeMix(
					[
						fontSize("xs"),
						fg(colorMix("oklab", { color: "currentcolor", weight: 70 }, "transparent")),
						overflowWrap("anywhere"),
					],
					mix,
				)}
			>
				{label}{" "}
				<code
					mix={[
						font("mono"),
						userSelect("all"),
						rounded("sm"),
						raw({ paddingInline: "0.25rem" }),
						bg(colorMix("oklab", { color: "currentcolor", weight: 10 }, "transparent")),
					]}
				>
					{children}
				</code>
			</p>
		);
	};
};
