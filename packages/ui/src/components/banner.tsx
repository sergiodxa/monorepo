/**
 * A full-width strip above a page or the whole app for state that outlives one
 * action: an overdue invoice, a failing integration, a maintenance window. It
 * sits in the flow and pushes the frame down, so it never covers what it warns about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, XIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { flex, flexWrap, gap, grow, inlineFlex, items, justify, shrink } from "@sdxc/u/layout";
import { bs, is, minIs, pb, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { fontSize, leading, overflowWrap, pretty, weight } from "@sdxc/u/typography";

import type { SemanticColor } from "../utils/semantic-color.js";

import { semanticColorPanel } from "../styles/semantic-color-panel.js";

/** Default {@link Banner.Props.color}: an informational strip. */
const DEFAULT_COLOR: Banner.Color = "brand";

/** Prop types for {@link Banner}. */
export namespace Banner {
	/** Semantic tone of the strip: warning for billing, danger for a failing integration. */
	export type Color = SemanticColor;

	/** Props accepted by {@link Banner}. */
	export interface Props extends Omit<TagProps<"section">, "children"> {
		/** Accessible name of the strip's region landmark, such as "Billing". */
		label: string;
		/** Default: `"brand"`. */
		color?: Color;
		/** Leading icon in place of the tone's own, or `null` for none. */
		icon?: RemixNode;
		/** The one fixing action, such as an "Update Payment Method" button or link. */
		action?: RemixNode;
		/**
		 * Lets the reader close the strip through a form, so the server records it
		 * and stops rendering the banner. Leave it out for state that needs resolving.
		 */
		dismiss?: Dismiss;
		/** The message: what is wrong and what fixing it changes, in a sentence or two. */
		children: RemixNode;
	}

	/** How a dismissible {@link Banner} closes. */
	export interface Dismiss {
		/** Accessible name of the close button, such as "Dismiss". */
		label: string;
		/** URL the dismissal submits to. */
		action: string;
		/** Default: `"post"`. */
		method?: "get" | "post";
		/** Hidden fields sent with it, such as the banner's id. */
		fields?: Record<string, string>;
	}
}

/**
 * Renders the strip as a named region: tone icon, message, one action, and a
 * close form only when `dismiss` is given. One banner at a time; it wraps on a
 * phone and flows above the app frame, pushing it down.
 *
 * @param handle Runtime handle carrying the host `<section>`'s props.
 * @returns The render function producing the strip's markup.
 * @example
 * <Banner color="warning" label={t("billing.region")} action={<Button href="/billing">{t("billing.update")}</Button>}>
 * 	{t("billing.declined")}
 * </Banner>
 * @example
 * <Banner label={t("maintenance.region")} dismiss={{ label: t("actions.dismiss"), action: "/banners/dismiss", fields: { id: "maintenance" } }}>
 * 	{t("maintenance.message")}
 * </Banner>
 */
export function Banner(handle: Handle<Banner.Props>) {
	return () => {
		let {
			label,
			color = DEFAULT_COLOR,
			icon,
			action,
			dismiss,
			children,
			mix,
			...rest
		} = handle.props;
		let toneIcon = icon === null ? null : (icon ?? <BannerToneIcon color={color} />);

		return (
			<section
				aria-label={label}
				{...rest}
				data-color={color}
				data-slot="banner"
				mix={mergeMix(
					[
						semanticColorPanel(),
						flex(),
						flexWrap(),
						items("center"),
						gap(3),
						is("full"),
						minIs(0),
						pb("0.5rem"),
						pi("1rem"),
						raw({ borderWidth: "0 0 1px", borderStyle: "solid" }),
						fontSize("sm"),
					],
					mix,
				)}
			>
				{toneIcon ? (
					<span
						aria-hidden="true"
						data-slot="banner-icon"
						mix={[inlineFlex(), shrink(0), fg("currentcolor")]}
					>
						{toneIcon}
					</span>
				) : null}
				<p
					data-slot="banner-message"
					mix={[
						grow(),
						raw({ flexBasis: "16rem" }),
						minIs(0),
						leading("snug"),
						weight("medium"),
						pretty(),
						overflowWrap("anywhere"),
					]}
				>
					{children}
				</p>
				{action ? (
					<div data-slot="banner-action" mix={[flex(), items("center"), shrink(0)]}>
						{action}
					</div>
				) : null}
				{dismiss ? <BannerDismiss dismiss={dismiss} /> : null}
			</section>
		);
	};
}

/**
 * Picks the icon a tone carries, so a warning and a failure read apart before
 * the message does.
 *
 * @param handle Runtime handle carrying the banner's tone.
 * @returns The render function producing the icon.
 */
function BannerToneIcon(handle: Handle<{ color: Banner.Color }>) {
	return () => {
		let { color } = handle.props;
		if (color === "success") return <CircleCheckIcon size={16} />;
		if (color === "danger") return <CircleAlertIcon size={16} />;
		if (color === "warning") return <TriangleAlertIcon size={16} />;
		return <InfoIcon size={16} />;
	};
}

/**
 * The close control of a dismissible {@link Banner}: an icon button that
 * submits its form, so the dismissal reaches the server with or without
 * JavaScript and the banner stays gone on the next page.
 *
 * @param handle Runtime handle carrying the dismissal form.
 * @returns The render function producing the form's markup.
 */
function BannerDismiss(handle: Handle<{ dismiss: Banner.Dismiss }>) {
	return () => {
		let { dismiss } = handle.props;

		return (
			<form
				method={dismiss.method ?? "post"}
				action={dismiss.action}
				data-slot="banner-dismiss"
				mix={[flex(), shrink(0), raw({ marginInlineStart: "auto" })]}
			>
				{Object.entries(dismiss.fields ?? {}).map(([name, value]) => (
					<input key={name} type="hidden" name={name} value={value} />
				))}
				<button
					type="submit"
					aria-label={dismiss.label}
					title={dismiss.label}
					mix={[
						inlineFlex(),
						items("center"),
						justify("center"),
						is("2rem"),
						bs("2rem"),
						rounded("md"),
						border({ width: 0 }),
						bg("transparent"),
						fg("currentcolor"),
						transition("background-color"),
						hover(bg("neutral.bg-tint-hover")),
						when("&:focus-visible", outline({ color: "brand.ring", width: 2 })),
					]}
				>
					<XIcon size={16} />
				</button>
			</form>
		);
	};
}
