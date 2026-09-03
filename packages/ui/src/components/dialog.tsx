/**
 * A modal surface built on the native `<dialog>` element, opened and closed
 * declaratively through Invoker Commands (`commandfor`/`command`) instead of
 * a JavaScript-tracked open state. Compound parts cover a header, title,
 * description, footer, and a dismiss control, so a page composes only the
 * pieces a given dialog needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { XIcon } from "@sdxc/icons";
import { bg, fg, outline } from "@sdxc/u/color";
import {
	backdropBlur,
	backdropSaturate,
	opacity,
	rounded,
	transition,
	transitionBehavior,
} from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import {
	absolute,
	container,
	flex,
	flexCol,
	flexColReverse,
	flexRow,
	gap,
	inset,
	justify,
	relative,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { at, media, startingStyle, supports } from "@sdxc/u/responsive";
import { is, maxBs, maxIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { fontSize, leading, textAlign, tracking, weight } from "@sdxc/u/typography";

import { durations, easings } from "../animations/tokens.js";

import { Button } from "./button.js";
import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope.js";

/**
 * Named container {@link Dialog} declares on its own host, so
 * {@link Dialog.Header} and {@link Dialog.Footer} can query the panel's own
 * width instead of the page's.
 */
const CONTAINER_NAME = "ui-dialog";

/**
 * Invoker Commands verb {@link Dialog.CloseProps.command} falls back to when
 * omitted, dismissing the ancestor Dialog named by `commandfor`.
 */
const DEFAULT_CLOSE_COMMAND = "close";

/**
 * Prop types for {@link Dialog} and its compound parts.
 */
export namespace Dialog {
	/**
	 * Every native `<dialog>` attribute, plus the `mix` passthrough. `role`
	 * stays the platform's implicit `"dialog"` unless set to `"alertdialog"`,
	 * and `open`/`closedby` stay the platform's own native state and light-dismiss controls.
	 */
	export interface Props extends TagProps<"dialog"> {
		/** The panel's compound parts: {@link Dialog.Header}, {@link Dialog.Footer}, {@link Dialog.Close}, or any other content. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Dialog.Header}.
	 */
	export interface HeaderProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link Dialog.Title}. Every native heading-element
	 * attribute still applies, since the rendered tag depends on the nearest
	 * ambient heading level, falling back to `<h1>` where none is set.
	 */
	export interface TitleProps extends TagProps<"h1"> {}

	/**
	 * Props accepted by {@link Dialog.Description}.
	 */
	export interface DescriptionProps extends TagProps<"p"> {}

	/**
	 * Props accepted by {@link Dialog.Footer}.
	 */
	export interface FooterProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link Dialog.Close}: every {@link Button.Props} field
	 * except the ones this component fixes on the consumer's behalf.
	 */
	export interface CloseProps extends Omit<
		Button.Props,
		"children" | "variant" | "color" | "size" | "aria-label" | "commandfor" | "command"
	> {
		/** `id` of the ancestor {@link Dialog} this button dismisses. */
		commandfor: string;
		/** Invoker Commands verb dispatched to the target Dialog. Defaults to `"close"`. */
		command?: "close";
		/**
		 * Accessible label for the icon-only control — required, since the
		 * button carries no visible text for assistive technology to read.
		 */
		"aria-label": string;
	}
}

/**
 * Renders the dialog panel as a native `<dialog>` host, its `::backdrop`
 * tinted and, where supported, blurred to dim the page behind it. The panel
 * declares the `ui-dialog` named container so {@link Dialog.Header} and {@link Dialog.Footer} can size against the panel's own width; Invoker Commands open and close it declaratively — a trigger elsewhere points `commandfor` at this element's `id` with `command="show-modal"`, and any control inside, including {@link Dialog.Close}, points `commandfor` at that same `id` with `command="close"`.
 *
 * @param handle Runtime handle carrying the host `<dialog>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <Button commandfor="confirm-delete" command="show-modal">{t("project.delete")}</Button>
 * <Dialog id="confirm-delete" aria-labelledby="confirm-delete-title">
 * 	<Dialog.Header>
 * 		<Dialog.Title id="confirm-delete-title">{t("project.deleteTitle")}</Dialog.Title>
 * 		<Dialog.Description>{t("project.deleteDescription")}</Dialog.Description>
 * 	</Dialog.Header>
 * 	<Dialog.Footer>
 * 		<Button commandfor="confirm-delete" command="close" color="danger">{t("actions.delete")}</Button>
 * 	</Dialog.Footer>
 * 	<Dialog.Close commandfor="confirm-delete" aria-label={t("actions.close")} />
 * </Dialog>
 * @example
 * <Dialog id="welcome" mix={zoom({ duration: durations.normal })}>
 * 	<Dialog.Header>
 * 		<Dialog.Title>{t("welcome.title")}</Dialog.Title>
 * 	</Dialog.Header>
 * </Dialog>
 */
export function Dialog(handle: Handle<Dialog.Props>) {
	return () => {
		let { id, children, mix, ...rest } = handle.props;

		if (import.meta.env.DEV && !id) {
			console.warn(
				'Dialog rendered without an "id" — "commandfor" on a trigger or close control has nothing to target.',
			);
		}

		return (
			<dialog
				{...rest}
				id={id}
				data-slot="dialog"
				mix={[
					relative(),
					bg("neutral.tint"),
					fg("neutral.emphasis"),
					rounded("lg"),
					is("full"),
					maxIs("28rem"),
					maxBs("90vh"),
					gap(6),
					p(6),
					overflow("auto"),
					/** Gated on `[open]` so the UA's own `dialog:not([open])` hiding still applies. */
					when("&[open]", flex()),
					flexCol(),
					container(CONTAINER_NAME, "inline-size"),
					when("&::backdrop", [
						bg("rgb(0 0 0 / 0.5)"),
						transitionBehavior("allow-discrete"),
						opacity(0),
						transition("opacity, display, overlay", {
							duration: durations.normal,
							easing: easings.standard,
						}),
					]),
					when("&[open]::backdrop", opacity(100)),
					supports(
						"(backdrop-filter: blur(0))",
						media(
							"(prefers-reduced-transparency: no-preference)",
							when("&::backdrop", [backdropBlur("md"), backdropSaturate(1.4)]),
						),
					),
					startingStyle(when("&[open]::backdrop", opacity(0))),
					outline("none"),
					/** `overscrollBehavior` has no matching utility; this shadow value doesn't match the `shadow()` scale (`sm`/`base`/`md`/`lg`). */
					raw({
						overscrollBehavior: "contain",
						boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
					}),
					mix,
				]}
			>
				{children}
			</dialog>
		);
	};
}

/**
 * Renders {@link Dialog.HeaderProps.children} as the panel's header slot: a
 * column stacking {@link Dialog.Title} and {@link Dialog.Description},
 * centered while narrow and start-aligned (flipping under `dir="rtl"`) once the panel's own `ui-dialog` container grows past `40rem`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the header slot's markup.
 * @example
 * <Dialog.Header>
 * 	<Dialog.Title>{t("project.deleteTitle")}</Dialog.Title>
 * 	<Dialog.Description>{t("project.deleteDescription")}</Dialog.Description>
 * </Dialog.Header>
 */
Dialog.Header = function DialogHeader(handle: Handle<Dialog.HeaderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="header"
				mix={[
					flex(),
					flexCol(),
					gap(1.5),
					textAlign("center"),
					at("40rem", CONTAINER_NAME, textAlign("start")),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link Dialog.TitleProps.children} as the panel's heading, inside
 * the native heading element matching the nearest ambient heading level —
 * `<h1>` by default — sized and weighted as the panel's most prominent line of text at every level.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the heading's markup.
 * @example
 * <Dialog.Title>{t("project.deleteTitle")}</Dialog.Title>
 */
Dialog.Title = function DialogTitle(handle: Handle<Dialog.TitleProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<Tag
				{...rest}
				data-slot="title"
				mix={[
					fg("neutral.emphasis"),
					weight("semibold"),
					tracking("tight"),
					fontSize("lg"),
					leading(1),
					mix,
				]}
			>
				{rest.children}
			</Tag>
		);
	};
};

/**
 * Renders {@link Dialog.DescriptionProps.children} as the panel's supporting
 * copy, in a native `<p>` set to the panel's muted foreground color so it
 * reads as secondary to {@link Dialog.Title}.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 * @example
 * <Dialog.Description>{t("project.deleteDescription")}</Dialog.Description>
 */
Dialog.Description = function DialogDescription(handle: Handle<Dialog.DescriptionProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<p {...rest} data-slot="description" mix={[fg("neutral.muted"), fontSize("sm"), mix]}>
				{rest.children}
			</p>
		);
	};
};

/**
 * Renders {@link Dialog.FooterProps.children} as the panel's action row: a
 * column of stacked, full-width controls while the panel is narrow,
 * switching to a single end-aligned row past the panel's own `40rem` container mark.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action row's markup.
 * @example
 * <Dialog.Footer>
 * 	<Button commandfor="confirm-delete" command="close" variant="outline">{t("actions.cancel")}</Button>
 * 	<Button commandfor="confirm-delete" command="close" color="danger">{t("actions.delete")}</Button>
 * </Dialog.Footer>
 */
Dialog.Footer = function DialogFooter(handle: Handle<Dialog.FooterProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="footer"
				mix={[
					flex(),
					gap(2),
					flexColReverse(),
					at("40rem", CONTAINER_NAME, [flexRow(), justify("end")]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a dismiss control for the ancestor {@link Dialog} named by
 * `commandfor`: a small, ghost-styled {@link Button} with a fixed "X" glyph,
 * pinned to the panel's corner. `command` defaults to `"close"`, so passing only `commandfor` and `aria-label` wires it up.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the dismiss control's markup.
 * @example
 * <Dialog.Close commandfor="confirm-delete" aria-label={t("actions.close")} />
 */
Dialog.Close = function DialogClose(handle: Handle<Dialog.CloseProps>) {
	return () => {
		let { commandfor, command, mix, ...rest } = handle.props;
		let resolvedCommand = command ?? DEFAULT_CLOSE_COMMAND;

		return (
			<Button
				{...rest}
				type="button"
				variant="ghost"
				color="neutral"
				size="sm"
				commandfor={commandfor}
				command={resolvedCommand}
				data-slot="close"
				mix={[absolute(), inset(4, 4, "auto", "auto"), mix]}
			>
				<XIcon size={16} />
			</Button>
		);
	};
};
