/**
 * A transient notification panel that floats above page content to report
 * the outcome of an action, colored by one of five semantic tones and
 * structured like an inline status panel: an optional leading icon or
 * loading graphic, a title/description block, and trailing actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { XIcon } from "@pkg/lucide-remix";
import { bg, border, colorMix, fg } from "@pkg/u/color";
import { backdropBlur, backdropSaturate, rounded, shadow, transition } from "@pkg/u/effects";
import { pointerEvents, raw } from "@pkg/u/general";
import {
	absolute,
	basis,
	fixed,
	flex,
	flexCol,
	gap,
	grow,
	inlineFlex,
	insBe,
	insBs,
	insIe,
	insIs,
	items,
	justify,
	relative,
	shrink,
} from "@pkg/u/layout";
import { media, supports } from "@pkg/u/responsive";
import { is, bs, maxIs, minIs, pb, pi, pie } from "@pkg/u/size";
import { active, data, hover, when } from "@pkg/u/state";
import { translateX } from "@pkg/u/transform";
import { fontSize, leading, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { graphicHostStyle } from "../styles/graphic-host";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/**
 * `role` applied to {@link Toast} through {@link attrs} unless a consumer
 * supplies its own, announcing the panel as a status update that assistive
 * technology reads after finishing whatever it is currently reading.
 */
const DEFAULT_ROLE = "status";

/**
 * Default {@link Toast.Props.color}, rendering a toast with the neutral tone
 * when a consumer names no semantic color.
 */
const DEFAULT_COLOR: Toast.Color = "neutral";

/**
 * Default {@link Toast.Props.live}, announcing a toast's content politely so
 * each toast waits its turn behind whatever assistive technology is
 * currently reading.
 */
const DEFAULT_LIVE: Toast.Live = "polite";

/**
 * `aria-atomic="true"` applied through {@link attrs} unless a consumer
 * overrides it, so assistive technology re-reads the whole toast whenever
 * any part of it updates.
 */
const DEFAULT_ARIA_ATOMIC = "true";

/**
 * `aria-hidden="true"` applied to {@link Toast.Icon} and {@link Toast.Loader}
 * through {@link attrs} unless a consumer overrides it, keeping a purely
 * decorative graphic out of the accessibility tree.
 */
const DEFAULT_GRAPHIC_ARIA_HIDDEN = "true";

/**
 * `type="button"` default applied to {@link Toast.Action} and
 * {@link Toast.Cancel}, matching the script-driven command most toast
 * actions run; pass `type="submit"` for a form control.
 */
const DEFAULT_BUTTON_TYPE: NonNullable<Toast.ActionProps["type"]> = "button";

/**
 * Corner {@link Toast.Region} renders in when `placement` is left unset.
 */
const DEFAULT_PLACEMENT: Toast.Placement = "bottom-end";

/**
 * `role` applied to {@link Toast.Region} through {@link attrs} unless a
 * consumer supplies its own, exposing the stack of toasts as a landmark
 * region.
 */
const DEFAULT_REGION_ROLE = "region";

/**
 * Prop types for {@link Toast} and its compound parts, including
 * {@link Toast.Region}.
 */
export namespace Toast {
	/**
	 * Semantic tone driving the host element's border, tint, and foreground
	 * color through the `--ui-*` variables for that color.
	 */
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * `aria-live` politeness applied to the host element. `"off"` omits the
	 * `aria-live` attribute entirely, leaving the element's implicit
	 * live-region behavior in place.
	 */
	export type Live = "polite" | "assertive" | "off";

	/**
	 * Corner of the viewport {@link Toast.Region} renders in. The block side
	 * (`top`/`bottom`) names a physical edge, while the inline edge
	 * (`start`/`end`) flips under `dir` to stay in the reading-trailing corner.
	 */
	export type Placement =
		| "top-start"
		| "top-center"
		| "top-end"
		| "bottom-start"
		| "bottom-center"
		| "bottom-end";

	/**
	 * Props accepted by {@link Toast}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Semantic tone of the toast. Default: `"neutral"`. */
		color?: Color;
		/** `aria-live` politeness for the toast's content. Default: `"polite"`. */
		live?: Live;
		/** The toast's compound parts: {@link Toast.Icon}, {@link Toast.Content}, {@link Toast.Action}, or any other content. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Toast.Icon}.
	 */
	export interface IconProps extends TagProps<"div"> {
		/** The icon graphic, typically a single SVG icon. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Toast.Loader}.
	 */
	export interface LoaderProps extends TagProps<"div"> {
		/** The loading graphic shown in place of {@link Toast.Icon} while the toast represents pending work. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Toast.Content}.
	 */
	export interface ContentProps extends TagProps<"div"> {
		/** The toast's title, description, or other body content. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Toast.Title}.
	 */
	export interface TitleProps extends TagProps<"h3"> {
		/** The toast's heading text. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Toast.Description}.
	 */
	export interface DescriptionProps extends TagProps<"p"> {
		/** The toast's supporting message text. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Toast.Action}.
	 */
	export interface ActionProps extends TagProps<"button"> {
		/** The action's label. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Toast.Cancel}.
	 */
	export interface CancelProps extends TagProps<"button"> {
		/** The cancel control's label. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Toast.Close}.
	 */
	export interface CloseProps extends TagProps<"button"> {
		/**
		 * Accessible label for the icon-only control — required, since the
		 * button carries no visible text for assistive technology to read.
		 */
		"aria-label": string;
	}

	/**
	 * Props accepted by {@link Toast.Region}.
	 */
	export interface RegionProps extends TagProps<"div"> {
		/** Corner of the viewport the stack renders in. Default: `"bottom-end"`. */
		placement?: Placement;
		/** Every currently queued {@link Toast}. */
		children: RemixNode;
	}
}

/**
 * Renders a single toast panel, tinted, bordered, and shadowed by
 * {@link Toast.Props.color}, with `role` and `aria-atomic` defaulted
 * (overridable); pair a `mix`-driven `enterExit()`, since it holds still.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the toast's markup.
 * @example
 * <Toast color="success">
 *   <Toast.Icon><CircleCheckIcon /></Toast.Icon>
 *   <Toast.Content>
 *     <Toast.Title>{t("toasts.saved.title")}</Toast.Title>
 *     <Toast.Description>{t("toasts.saved.description")}</Toast.Description>
 *   </Toast.Content>
 *   <Toast.Close aria-label={t("actions.dismiss")} />
 * </Toast>
 * @example
 * <Toast color="danger" live="assertive">
 *   <Toast.Content>
 *     <Toast.Title>{t("toasts.uploadFailed.title")}</Toast.Title>
 *   </Toast.Content>
 *   <Toast.Action>{t("actions.retry")}</Toast.Action>
 *   <Toast.Cancel>{t("actions.dismiss")}</Toast.Cancel>
 * </Toast>
 */
export function Toast(handle: Handle<Toast.Props>) {
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
				data-slot="toast"
				mix={[
					attrs({ role: DEFAULT_ROLE, "aria-atomic": DEFAULT_ARIA_ATOMIC }),
					relative(),
					flex(),
					is("full"),
					gap("0.75rem"),
					rounded("lg"),
					border("neutral"),
					fg("neutral.fg-emphasis"),
					pb("1rem"),
					pi("1rem"),
					when('&:has(> [data-slot="close"])', pie("2.5rem")),
					when('&[data-color="brand"]', [border("brand"), fg("brand.fg-emphasis")]),
					when('&[data-color="neutral"]', [border("neutral"), fg("neutral.fg-emphasis")]),
					when('&[data-color="success"]', [border("success"), fg("success.fg-emphasis")]),
					when('&[data-color="warning"]', [border("warning"), fg("warning.fg-emphasis")]),
					when('&[data-color="danger"]', [border("danger"), fg("danger.fg-emphasis")]),
					border({ width: 1 }),
					shadow("lg"),
					items("start"),
					pointerEvents("auto"),
					raw({
						"--ui-toast-bg": "var(--ui-neutral-bg-tint)",
						backgroundColor: "var(--ui-toast-bg)",
					}),
					data(
						"color",
						"brand",
						raw({
							"--ui-toast-bg": "var(--ui-brand-bg-tint)",
							backgroundColor: "var(--ui-toast-bg)",
						}),
					),
					data(
						"color",
						"neutral",
						raw({
							"--ui-toast-bg": "var(--ui-neutral-bg-tint)",
							backgroundColor: "var(--ui-toast-bg)",
						}),
					),
					data(
						"color",
						"success",
						raw({
							"--ui-toast-bg": "var(--ui-success-bg-tint)",
							backgroundColor: "var(--ui-toast-bg)",
						}),
					),
					data(
						"color",
						"warning",
						raw({
							"--ui-toast-bg": "var(--ui-warning-bg-tint)",
							backgroundColor: "var(--ui-toast-bg)",
						}),
					),
					data(
						"color",
						"danger",
						raw({
							"--ui-toast-bg": "var(--ui-danger-bg-tint)",
							backgroundColor: "var(--ui-toast-bg)",
						}),
					),
					supports(
						"(backdrop-filter: blur(0))",
						media("(prefers-reduced-transparency: no-preference)", [
							bg(colorMix("oklab", { color: "var(--ui-toast-bg)", weight: 85 }, "transparent")),
							backdropBlur("md"),
							backdropSaturate(1.4),
						]),
					),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders {@link Toast.IconProps.children} as the toast's leading icon,
 * hidden from assistive technology since the toast's color and text already
 * carry its meaning; swap in {@link Toast.Loader} while pending.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the icon's markup.
 */
Toast.Icon = function ToastIcon(handle: Handle<Toast.IconProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="icon"
				mix={[attrs({ "aria-hidden": DEFAULT_GRAPHIC_ARIA_HIDDEN }), graphicHostStyle(), mix]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Toast.LoaderProps.children} as the toast's loading graphic,
 * laid out identically to {@link Toast.Icon} so swapping between them keeps
 * the layout stable; pair a `spin()` `mix` factory for its rotating loop.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the loading graphic's markup.
 */
Toast.Loader = function ToastLoader(handle: Handle<Toast.LoaderProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="loader"
				mix={[attrs({ "aria-hidden": DEFAULT_GRAPHIC_ARIA_HIDDEN }), graphicHostStyle(), mix]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Toast.ContentProps.children} as the toast's body block: a
 * column flex container that shrinks to fit alongside a leading icon or
 * trailing action, holding {@link Toast.Title} and {@link Toast.Description}.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the content block's markup.
 */
Toast.Content = function ToastContent(handle: Handle<Toast.ContentProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="content"
				mix={[flex(), flexCol(), gap("0.25rem"), minIs(0), grow(), shrink(1), basis("0%"), mix]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Toast.TitleProps.children} as the toast's heading, in a
 * native `<h3>` sized and weighted as a small, single-line label above the
 * toast's description.
 *
 * @param handle Runtime handle carrying the host `<h3>`'s props.
 * @returns The render function producing the title's markup.
 */
Toast.Title = function ToastTitle(handle: Handle<Toast.TitleProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<h3 {...rest} data-slot="title" mix={[weight(500), leading(1), fontSize("sm"), mix]}>
				{children}
			</h3>
		);
	};
};

/**
 * Renders {@link Toast.DescriptionProps.children} as the toast's supporting
 * message, in a native `<p>` set slightly translucent against the toast's
 * foreground color so it reads as secondary to {@link Toast.Title}.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 */
Toast.Description = function ToastDescription(handle: Handle<Toast.DescriptionProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				data-slot="description"
				mix={[
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
 * Renders {@link Toast.ActionProps.children} as the toast's primary trailing
 * control; `type` defaults to `"button"`, ordered before the consumer's
 * attributes so `command`/`commandfor` still run; use `type="submit"` for a form.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the action control's markup.
 * @example
 * <Toast.Action>{t("actions.undo")}</Toast.Action>
 */
Toast.Action = function ToastAction(handle: Handle<Toast.ActionProps>) {
	return () => {
		let { type, children, mix, ...rest } = handle.props;
		let resolvedType = type ?? DEFAULT_BUTTON_TYPE;

		return (
			<button
				type={resolvedType}
				{...rest}
				data-slot="action"
				mix={[
					inlineFlex(),
					items("center"),
					justify("center"),
					rounded("md"),
					border({ width: 1 }),
					pi("0.75rem"),
					pb("0.25rem"),
					weight(500),
					shrink(),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
					),
					fg("currentcolor"),
					border(colorMix("oklab", { color: "currentcolor", weight: 30 }, "transparent")),
					fontSize("xs"),
					hover(bg(colorMix("oklab", { color: "currentcolor", weight: 10 }, "transparent"))),
					active(bg(colorMix("oklab", { color: "currentcolor", weight: 20 }, "transparent"))),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
};

/**
 * Renders {@link Toast.CancelProps.children} as a neutral-tinted, secondary
 * trailing control; `type` defaults to `"button"`, ordered before the
 * consumer's attributes so `command`/`commandfor` still run.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the cancel control's markup.
 * @example
 * <Toast.Cancel>{t("actions.dismiss")}</Toast.Cancel>
 */
Toast.Cancel = function ToastCancel(handle: Handle<Toast.CancelProps>) {
	return () => {
		let { type, children, mix, ...rest } = handle.props;
		let resolvedType = type ?? DEFAULT_BUTTON_TYPE;

		return (
			<button
				type={resolvedType}
				{...rest}
				data-slot="cancel"
				mix={[
					inlineFlex(),
					items("center"),
					justify("center"),
					rounded("md"),
					border({ color: "neutral", width: 1 }),
					pi("0.75rem"),
					pb("0.25rem"),
					weight(500),
					fg("neutral.fg"),
					hover([bg("neutral.bg-tint-hover"), fg("neutral.fg-emphasis")]),
					active(bg("neutral.bg-tint-pressed")),
					shrink(),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
					),
					fontSize("xs"),
					mix,
				]}
			>
				{children}
			</button>
		);
	};
};

/**
 * Renders a dismiss control for the ancestor {@link Toast}: an icon-only
 * `<button>` removable via a consumer's mixin or the `commandfor`/`command`
 * pair; `type="button"` precedes those attributes so the pairing still runs.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the dismiss control's markup.
 * @example
 * <Toast.Close aria-label={t("actions.dismiss")} />
 */
Toast.Close = function ToastClose(handle: Handle<Toast.CloseProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<button
				type="button"
				{...rest}
				data-slot="close"
				mix={[
					absolute(),
					inlineFlex(),
					items("center"),
					justify("center"),
					is("1.5rem"),
					bs("1.5rem"),
					rounded("md"),
					fg("neutral.fg-muted"),
					hover([bg("neutral.bg-tint-hover"), fg("neutral.fg-emphasis")]),
					transition(
						"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
					),
					insBs("0.5rem"),
					insIe("0.5rem"),
					mix,
				]}
			>
				<XIcon size={16} />
			</button>
		);
	};
};

/**
 * Renders the fixed viewport stacking every queued {@link Toast} at a corner
 * via {@link Toast.RegionProps.placement}; `pointer-events` stays `none` so
 * clicks pass through to content behind, restored per toast.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the viewport's markup.
 * @example
 * <Toast.Region aria-label={t("toasts.region")}>
 *   {toasts.map((toast) => (
 *     <Toast key={toast.id} color={toast.data.color}>
 *       <Toast.Content>
 *         <Toast.Title>{toast.data.title}</Toast.Title>
 *       </Toast.Content>
 *     </Toast>
 *   ))}
 * </Toast.Region>
 * @example
 * <Toast.Region aria-label={t("toasts.region")} placement="top-center">
 *   <Toast color="warning">
 *     <Toast.Content>
 *       <Toast.Title>{t("toasts.offline.title")}</Toast.Title>
 *     </Toast.Content>
 *   </Toast>
 * </Toast.Region>
 */
Toast.Region = function ToastRegion(handle: Handle<Toast.RegionProps>) {
	return () => {
		let { placement, children, mix, ...rest } = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_PLACEMENT;

		warnIfNoAccessibleLabel(
			handle.props,
			'Toast.Region: needs an "aria-label" or "aria-labelledby" identifying this landmark for assistive technology.',
		);

		return (
			<div
				{...rest}
				data-placement={resolvedPlacement}
				data-slot="region"
				mix={[
					attrs({ role: DEFAULT_REGION_ROLE }),
					fixed(),
					flex(),
					flexCol(),
					gap("0.75rem"),
					is("full"),
					maxIs("24rem"),
					pb("1rem"),
					pi("1rem"),
					pointerEvents(),
					raw({ zIndex: "var(--ui-toast-z, 50)" }),
					when('&[data-placement^="top"]', insBs("0")),
					when('&[data-placement^="bottom"]', insBe("0")),
					when('&[data-placement$="start"]', insIs("0")),
					when('&[data-placement$="end"]', insIe("0")),
					when('&[data-placement$="center"]', [insIs("50%"), translateX("-50%")]),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};
