/**
 * A transient notification panel reporting the outcome of an action, in one of
 * five semantic tones, plus the region that stacks them and the `Toasts` island
 * that draws one queue for server flash toasts and client toasts alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import {
	CircleAlertIcon,
	CircleCheckIcon,
	InfoIcon,
	LoaderCircleIcon,
	TriangleAlertIcon,
	XIcon,
} from "@sdxc/icons";
import { bg, border, colorMix, fg } from "@sdxc/u/color";
import { backdropBlur, backdropSaturate, rounded, shadow, transition } from "@sdxc/u/effects";
import { pointerEvents, raw, mergeMix } from "@sdxc/u/general";
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
} from "@sdxc/u/layout";
import { media, supports } from "@sdxc/u/responsive";
import { is, bs, maxIs, minIs, pb, pi, pie } from "@sdxc/u/size";
import { active, data, hover, when } from "@sdxc/u/state";
import { translateX } from "@sdxc/u/transform";
import { balance, fontSize, leading, pretty, weight } from "@sdxc/u/typography";
import { attrs, clientEntry, on } from "remix/component";

import { spin } from "../animations/keyframes.js";
import { hitArea } from "../styles/hit-area.js";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name.js";

import { Toaster } from "./behaviors/toaster.js";
import { toastStack } from "./mixins/toast-stack.js";
import { graphicHostStyle } from "./styles/graphic-host.js";
import { toastStackStyle } from "./styles/toast-stack.js";

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

/** Default {@link Toast.RegionProps.max}: three toasts show, the rest wait. */
const DEFAULT_MAX = 3;

/** Default {@link Toast.RegionProps.stack}: older toasts fold behind the newest. */
const DEFAULT_STACK: Toast.Stack = "peek";

/**
 * How long a toast offering Undo stays, in milliseconds: long enough to read
 * the outcome and reach the button, short enough that the change settles soon.
 *
 * @example
 * pageToaster().add({ title: "Monitor deleted", action: { label: "Undo", onAction: restore } }, { duration: TOAST_UNDO_DURATION });
 */
export const TOAST_UNDO_DURATION = 8000;

/** One queue per document, so every island on a page raises toasts into the same stack. */
const PAGE_TOASTERS = new WeakMap<Document, Toaster<Toast.Message>>();

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
		/**
		 * Most toasts shown at once; older ones wait out of sight until a newer
		 * one leaves. Default: `3`.
		 */
		max?: number;
		/**
		 * `"peek"` folds older toasts behind the newest, scaled to 0.95 and 0.9,
		 * and fans them out while the pointer or focus is on the stack; `"list"`
		 * always shows them one under another. Default: `"peek"`.
		 */
		stack?: Stack;
		/** Every currently queued {@link Toast}. */
		children?: RemixNode;
	}

	/** How {@link Toast.Region} lays out more than one toast. */
	export type Stack = "peek" | "list";

	/**
	 * One toast as data, the shape {@link Toasts} draws and {@link pageToaster}
	 * queues. Copy reads as an outcome: "Monitor deleted", six words at most,
	 * and an error ends with its recovery step ("Couldn't save. Try again.").
	 */
	export interface Message {
		/** Semantic tone. Default: `"neutral"`. */
		color?: Color;
		/** The outcome, as a noun and a past participle. */
		title: string;
		/** A second line, only when it adds something the title cannot. */
		description?: string;
		/** Draws a spinner in place of the icon while the work is still running. */
		loading?: boolean;
		/** One action: Undo for a reversible destructive change, Retry for a failure. */
		action?: MessageAction;
	}

	/**
	 * The single action a {@link Message} offers. `form` posts from server
	 * HTML with or without JavaScript; `onAction` runs in the browser, after
	 * which the toast leaves.
	 */
	export interface MessageAction {
		/** Visible label, a verb: "Undo", "Retry", "View". */
		label: string;
		/** Runs on click in the browser; a function survives only a client-side {@link Toaster.add}. */
		onAction?: () => void;
		/** Submits a form, so the action works from a server-rendered flash toast. */
		form?: MessageForm;
	}

	/** The form a {@link MessageAction} submits. */
	export interface MessageForm {
		/** URL the form submits to. */
		action: string;
		/** Default: `"post"`. */
		method?: "get" | "post";
		/** Hidden fields sent with it, such as the id of the record to restore. */
		fields?: Record<string, string>;
	}

	/**
	 * A toast the server rendered from a session flash. The `id` keys the
	 * element the browser adopts on hydration, so it must be stable within
	 * the response and safe inside an HTML id.
	 */
	export interface Flash extends Omit<Message, "action"> {
		/** A form-backed action, the kind that survives the trip from the server. */
		action?: FlashAction;
		/** Stable id, such as a `generateUUID()` minted when the flash was set. */
		id: string;
		/** Milliseconds it stays once hydrated, or `null` to wait for the close button. */
		duration?: number | null;
	}

	/** The action a {@link Flash} offers: a labelled form, such as Undo posting the record id back. */
	export interface FlashAction {
		/** Visible label, a verb: "Undo", "Retry", "View". */
		label: string;
		/** The form the action submits. */
		form: MessageForm;
	}

	/** Strings {@link Toasts} announces. */
	export interface Labels {
		/** Accessible name of the region landmark, such as "Notifications". */
		region: string;
		/** Accessible name of each toast's close button, such as "Dismiss". */
		dismiss: string;
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
				mix={mergeMix(
					[
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
					],
					mix,
				)}
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
				mix={mergeMix(
					[attrs({ "aria-hidden": DEFAULT_GRAPHIC_ARIA_HIDDEN }), graphicHostStyle()],
					mix,
				)}
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
				mix={mergeMix(
					[attrs({ "aria-hidden": DEFAULT_GRAPHIC_ARIA_HIDDEN }), graphicHostStyle()],
					mix,
				)}
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
				mix={mergeMix(
					[flex(), flexCol(), gap("0.25rem"), minIs(0), grow(), shrink(1), basis("0%")],
					mix,
				)}
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
			<h3
				{...rest}
				data-slot="title"
				mix={mergeMix([weight(500), leading(1), fontSize("sm"), balance()], mix)}
			>
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
				mix={mergeMix(
					[
						fontSize("sm"),
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
				mix={mergeMix(
					[
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
					],
					mix,
				)}
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
				mix={mergeMix(
					[
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
					],
					mix,
				)}
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
				mix={mergeMix(
					[
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
						hitArea(),
					],
					mix,
				)}
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
		let {
			placement,
			max = DEFAULT_MAX,
			stack = DEFAULT_STACK,
			children,
			mix,
			...rest
		} = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_PLACEMENT;

		warnIfNoAccessibleLabel(
			handle.props,
			'Toast.Region: needs an "aria-label" or "aria-labelledby" identifying this landmark for assistive technology.',
		);

		return (
			<div
				{...rest}
				data-placement={resolvedPlacement}
				data-stack={stack}
				data-slot="region"
				mix={mergeMix(
					[
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
						toastStackStyle(max),
						toastStack(),
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
 * The page's toast queue, shared by every island in the document so a toast
 * raised anywhere lands in the one {@link Toasts} stack. On the server each
 * call returns a fresh queue, keeping one request's toasts out of another's.
 *
 * @returns The queue {@link Toasts} draws.
 * @example
 * pageToaster().add({ color: "success", title: "Monitor saved" });
 * @example
 * pageToaster().promise(save(), { loading: { title: "Saving monitor", loading: true }, success: { title: "Monitor saved", color: "success" }, error: { title: "Couldn't save monitor. Try again.", color: "danger" } });
 */
export function pageToaster(): Toaster<Toast.Message> {
	if (typeof document === "undefined") return new Toaster<Toast.Message>();

	let toaster = PAGE_TOASTERS.get(document);
	if (!toaster) {
		toaster = new Toaster<Toast.Message>();
		PAGE_TOASTERS.set(document, toaster);
	}
	return toaster;
}

/** Prop types for {@link Toasts}. */
export namespace Toasts {
	/** Props accepted by {@link Toasts}. */
	export interface Props {
		/** Strings the region and its close buttons announce. */
		labels: Toast.Labels;
		/** Toasts the server rendered from a session flash; hydration adopts each element and starts its timer. */
		initial?: Toast.Flash[];
		/** Corner of the viewport. Default: `"bottom-end"`. */
		placement?: Toast.Placement;
		/** Most toasts shown at once. Default: `3`. */
		max?: number;
		/** Peek stack or plain list. Default: `"peek"`. */
		stack?: Toast.Stack;
	}

	/** Props of one drawn toast inside {@link Toasts}. */
	export interface ItemProps {
		/** Queue id, also the base of the element id the close button targets. */
		id: string;
		/** What the toast says and offers. */
		message: Toast.Message;
		/** Strings the close button announces. */
		labels: Toast.Labels;
		/** Removes the toast from the queue once the user closes it or acts on it. */
		onDismiss: () => void;
	}
}

/**
 * The app's one toast stack: server flash toasts and {@link pageToaster} toasts share a
 * region, timing, pause on hover or focus, and close; a flash toast shows and closes
 * without JavaScript. Reach for it last, after an inline message or a banner.
 *
 * @example
 * <Toasts labels={{ region: t("toasts.region"), dismiss: t("toasts.dismiss") }} initial={flash ? [flash] : []} />
 */
export const Toasts: EntryComponent<Toasts.Props> = clientEntry(
	"@sdxc/ui/app/toast#Toasts",
	function Toasts(handle: Handle<Toasts.Props>) {
		let toaster = pageToaster();
		let adopted = false;
		let pointerInside = false;
		let focusInside = false;

		/** Holds every timer while the pointer or focus is on the stack, so a fanned-out list stays readable. */
		function hold(): void {
			if (pointerInside || focusInside) toaster.pause();
			else toaster.resume();
		}

		handle.queueTask(() => {
			toaster.addEventListener("change", () => void handle.update(), { signal: handle.signal });

			for (let flash of handle.props.initial ?? []) {
				if (toaster.get(flash.id)) continue;
				toaster.add(flash, { id: flash.id, duration: flash.duration });
			}

			adopted = true;
			void handle.update();
		});

		return () => {
			let { labels, initial = [], placement, max, stack } = handle.props;
			let items = adopted
				? toaster.toasts.map((toast) => ({ id: toast.id, message: toast.data }))
				: initial.map((flash) => ({ id: flash.id, message: flash as Toast.Message }));

			return (
				<Toast.Region
					aria-label={labels.region}
					placement={placement}
					max={max}
					stack={stack}
					mix={[
						on<HTMLDivElement, "pointerenter">("pointerenter", () => {
							pointerInside = true;
							hold();
						}),
						on<HTMLDivElement, "pointerleave">("pointerleave", () => {
							pointerInside = false;
							hold();
						}),
						on<HTMLDivElement, "focusin">("focusin", () => {
							focusInside = true;
							hold();
						}),
						on<HTMLDivElement, "focusout">("focusout", (event) => {
							let next = event.relatedTarget;
							focusInside = next instanceof Node && event.currentTarget.contains(next);
							hold();
						}),
					]}
				>
					{items.map((item) => (
						<ToastItem
							key={item.id}
							id={item.id}
							message={item.message}
							labels={labels}
							onDismiss={() => void toaster.dismiss(item.id)}
						/>
					))}
				</Toast.Region>
			);
		};
	},
);

/**
 * Draws one queued {@link Toast.Message} inside an open, non-modal `<dialog>`,
 * whose close button uses the native `close` command, so a server-rendered
 * toast closes without JavaScript and the queue hears the same `close` event.
 *
 * @param handle Runtime handle carrying {@link Toasts.ItemProps}.
 * @returns The render function producing the toast's markup.
 */
function ToastItem(handle: Handle<Toasts.ItemProps>) {
	return () => {
		let { id, message, labels, onDismiss } = handle.props;
		let domId = `toast-${id}`;
		let color = message.color ?? DEFAULT_COLOR;

		return (
			<dialog
				open
				id={domId}
				aria-labelledby={`${domId}-title`}
				data-slot="toast-item"
				mix={[
					on<HTMLDialogElement, "close">("close", onDismiss),
					raw({
						position: "relative",
						inset: "auto",
						inlineSize: "100%",
						margin: "0",
						padding: "0",
						border: "0",
						background: "transparent",
						color: "inherit",
					}),
				]}
			>
				<Toast
					color={color}
					live={color === "danger" ? "assertive" : "polite"}
					aria-busy={message.loading ? "true" : undefined}
				>
					{message.loading ? (
						<Toast.Loader mix={[spin()]}>
							<LoaderCircleIcon size={16} />
						</Toast.Loader>
					) : (
						<Toast.Icon>
							<ToastColorIcon color={color} />
						</Toast.Icon>
					)}
					<Toast.Content>
						<Toast.Title id={`${domId}-title`}>{message.title}</Toast.Title>
						{message.description ? (
							<Toast.Description>{message.description}</Toast.Description>
						) : null}
					</Toast.Content>
					{message.action ? (
						<ToastItemAction action={message.action} onDismiss={onDismiss} />
					) : null}
					<Toast.Close aria-label={labels.dismiss} commandfor={domId} command="close" />
				</Toast>
			</dialog>
		);
	};
}

/**
 * Picks the icon a tone carries, so a success, warning and failure read apart
 * at a glance before the title is read.
 *
 * @param handle Runtime handle carrying the toast's tone.
 * @returns The render function producing the icon.
 */
function ToastColorIcon(handle: Handle<{ color: Toast.Color }>) {
	return () => {
		let { color } = handle.props;
		if (color === "success") return <CircleCheckIcon size={16} />;
		if (color === "danger") return <CircleAlertIcon size={16} />;
		if (color === "warning") return <TriangleAlertIcon size={16} />;
		return <InfoIcon size={16} />;
	};
}

/**
 * Draws a {@link Toast.MessageAction}: a submit button inside its form when it
 * names one, so it works from server HTML, otherwise a button that runs
 * `onAction` and takes the toast away.
 *
 * @param handle Runtime handle carrying the action and the dismiss callback.
 * @returns The render function producing the action's markup.
 */
function ToastItemAction(handle: Handle<{ action: Toast.MessageAction; onDismiss: () => void }>) {
	return () => {
		let { action, onDismiss } = handle.props;
		let form = action.form;

		if (form) {
			return (
				<form
					method={form.method ?? "post"}
					action={form.action}
					mix={[raw({ display: "contents" })]}
				>
					{Object.entries(form.fields ?? {}).map(([name, value]) => (
						<input key={name} type="hidden" name={name} value={value} />
					))}
					<Toast.Action
						type="submit"
						mix={[on<HTMLButtonElement, "click">("click", () => action.onAction?.())]}
					>
						{action.label}
					</Toast.Action>
				</form>
			);
		}

		return (
			<Toast.Action
				mix={[
					on<HTMLButtonElement, "click">("click", () => {
						action.onAction?.();
						onDismiss();
					}),
				]}
			>
				{action.label}
			</Toast.Action>
		);
	};
}
