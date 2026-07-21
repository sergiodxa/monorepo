/**
 * An interruptive modal surface that demands an explicit response before a
 * page continues — confirming a destructive action, surfacing a blocking
 * error — built on the same native `<dialog>` host as {@link Dialog} but
 * widened for its two-button layout and sealed against light dismiss. Its
 * compound parts cover a header, title, description, and a footer holding an
 * emphasized action and a cancel control.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

import { Button } from "./button";
import { Dialog } from "./dialog";
import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope";

/**
 * Invoker Commands verb {@link AlertDialog.Action} and
 * {@link AlertDialog.Cancel} fall back to when `command` is omitted,
 * dismissing the ancestor AlertDialog named by `commandfor`.
 */
const DEFAULT_COMMAND = "close";

/** Semantic color role {@link AlertDialog.Action} falls back to when `color` is omitted. */
const DEFAULT_ACTION_COLOR: Button.Color = "danger";

/** Visual weight {@link AlertDialog.Cancel} falls back to when `variant` is omitted. */
const DEFAULT_CANCEL_VARIANT: Button.Variant = "outline";

/** Semantic color role {@link AlertDialog.Cancel} falls back to when `color` is omitted. */
const DEFAULT_CANCEL_COLOR: Button.Color = "neutral";

/**
 * Prop types for {@link AlertDialog} and its compound parts.
 */
export namespace AlertDialog {
	/**
	 * Every prop {@link Dialog} accepts except the ones this component fixes
	 * on the consumer's behalf: `role` is always `"alertdialog"`, and
	 * `closedby`/`closedBy` are always `"closerequest"`, so the panel can
	 * never be light-dismissed by clicking its backdrop.
	 */
	export interface Props extends Omit<Dialog.Props, "role" | "closedby" | "closedBy"> {}

	/**
	 * Props accepted by {@link AlertDialog.Header}.
	 */
	export interface HeaderProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link AlertDialog.Title}. Every native heading-element
	 * attribute still applies, since the rendered tag depends on the nearest
	 * ambient heading level, falling back to `<h1>` where nothing supplies
	 * one.
	 */
	export interface TitleProps extends TagProps<"h1"> {}

	/**
	 * Props accepted by {@link AlertDialog.Description}.
	 */
	export interface DescriptionProps extends TagProps<"p"> {}

	/**
	 * Props accepted by {@link AlertDialog.Footer}.
	 */
	export interface FooterProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link AlertDialog.Action}: every {@link Button.Props}
	 * field except `commandfor`/`command`, which this type narrows.
	 */
	export interface ActionProps extends Omit<Button.Props, "commandfor" | "command"> {
		/** `id` of the ancestor {@link AlertDialog} this action dismisses. */
		commandfor: string;
		/** Invoker Commands verb dispatched to the target AlertDialog. Defaults to `"close"`. */
		command?: "close";
	}

	/**
	 * Props accepted by {@link AlertDialog.Cancel}: every {@link Button.Props}
	 * field except `commandfor`/`command`, which this type narrows.
	 */
	export interface CancelProps extends Omit<Button.Props, "commandfor" | "command"> {
		/** `id` of the ancestor {@link AlertDialog} this cancel control dismisses. */
		commandfor: string;
		/** Invoker Commands verb dispatched to the target AlertDialog. Defaults to `"close"`. */
		command?: "close";
	}
}

/**
 * Renders the alert panel through {@link Dialog}, inheriting its native
 * `<dialog>` host, tinted `::backdrop`, padding, and rounded, shadowed
 * surface, widened to fit a two-button footer. `role` is fixed to
 * `"alertdialog"` and `closedby` is fixed to `"closerequest"`: an Escape
 * press still closes the panel, but clicking its backdrop never does,
 * matching the alert dialog pattern's requirement that an interruption only
 * clears through an explicit response. Opening and closing still ride
 * Invoker Commands exactly as {@link Dialog} does — a trigger elsewhere on
 * the page points `commandfor` at this element's `id` with
 * `command="show-modal"`, and {@link AlertDialog.Action} or
 * {@link AlertDialog.Cancel} inside it point back at that same `id` with
 * `command="close"`.
 *
 * @param handle Runtime handle carrying the host `<dialog>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <Button commandfor="delete-project" command="show-modal" color="danger">{t("project.delete")}</Button>
 * <AlertDialog id="delete-project" aria-labelledby="delete-project-title">
 * 	<AlertDialog.Header>
 * 		<AlertDialog.Title id="delete-project-title">{t("project.deleteTitle")}</AlertDialog.Title>
 * 		<AlertDialog.Description>{t("project.deleteDescription")}</AlertDialog.Description>
 * 	</AlertDialog.Header>
 * 	<AlertDialog.Footer>
 * 		<AlertDialog.Cancel commandfor="delete-project">{t("actions.cancel")}</AlertDialog.Cancel>
 * 		<AlertDialog.Action commandfor="delete-project">{t("actions.delete")}</AlertDialog.Action>
 * 	</AlertDialog.Footer>
 * </AlertDialog>
 */
export function AlertDialog(handle: Handle<AlertDialog.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<Dialog
				{...rest}
				role="alertdialog"
				closedby="closerequest"
				mix={[
					css({
						maxInlineSize: "32rem",
					}),
					mix,
				]}
			>
				{children}
			</Dialog>
		);
	};
}

/**
 * Renders {@link AlertDialog.HeaderProps.children} as the panel's header
 * slot: a column stacking {@link AlertDialog.Title} and
 * {@link AlertDialog.Description} with a small gap between them.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the header slot's markup.
 * @example
 * <AlertDialog.Header>
 * 	<AlertDialog.Title>{t("project.deleteTitle")}</AlertDialog.Title>
 * 	<AlertDialog.Description>{t("project.deleteDescription")}</AlertDialog.Description>
 * </AlertDialog.Header>
 */
AlertDialog.Header = function AlertDialogHeader(handle: Handle<AlertDialog.HeaderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="header"
				mix={[
					css({
						display: "flex",
						flexDirection: "column",
						gap: "0.5rem",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders {@link AlertDialog.TitleProps.children} as the panel's heading,
 * inside the native heading element matching the nearest ancestor
 * `HeadingScope`'s depth, or `<h1>` where no scope wraps it at all, sized as
 * the panel's most prominent line of text at its font's own default line
 * height.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the heading's markup.
 * @example
 * <AlertDialog.Title>{t("project.deleteTitle")}</AlertDialog.Title>
 */
AlertDialog.Title = function AlertDialogTitle(handle: Handle<AlertDialog.TitleProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<Tag
				{...rest}
				data-slot="title"
				mix={[
					css({
						fontSize: "1.125rem",
						lineHeight: "calc(1.75 / 1.125)",
						fontWeight: "600",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
					mix,
				]}
			>
				{rest.children}
			</Tag>
		);
	};
};

/**
 * Renders {@link AlertDialog.DescriptionProps.children} as the panel's
 * supporting copy, in a native `<p>` set to the panel's muted foreground
 * color so it reads as secondary to {@link AlertDialog.Title}.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 * @example
 * <AlertDialog.Description>{t("project.deleteDescription")}</AlertDialog.Description>
 */
AlertDialog.Description = function AlertDialogDescription(
	handle: Handle<AlertDialog.DescriptionProps>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				data-slot="description"
				mix={[
					css({
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						color: "var(--ui-neutral-fg-muted)",
					}),
					mix,
				]}
			>
				{rest.children}
			</p>
		);
	};
};

/**
 * Renders {@link AlertDialog.FooterProps.children} as the panel's action row:
 * an end-aligned row of controls, separated from the content above it by a
 * block-start margin. Compose {@link AlertDialog.Cancel} before
 * {@link AlertDialog.Action} so the emphasized, potentially destructive
 * control renders last.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action row's markup.
 * @example
 * <AlertDialog.Footer>
 * 	<AlertDialog.Cancel commandfor="delete-project">{t("actions.cancel")}</AlertDialog.Cancel>
 * 	<AlertDialog.Action commandfor="delete-project">{t("actions.delete")}</AlertDialog.Action>
 * </AlertDialog.Footer>
 */
AlertDialog.Footer = function AlertDialogFooter(handle: Handle<AlertDialog.FooterProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="footer"
				mix={[
					css({
						display: "flex",
						justifyContent: "flex-end",
						gap: "0.5rem",
						marginBlockStart: "1.5rem",
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the panel's emphasized action for the ancestor {@link AlertDialog}
 * named by `commandfor`: a {@link Button} colored with the semantic danger
 * tone by default, since this control most often confirms a destructive
 * action. `command` defaults to `"close"`, so passing `commandfor` and the
 * button's label is enough to wire it up; pass `color` to override the
 * default tone for a non-destructive confirmation.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the action's markup.
 * @example
 * <AlertDialog.Action commandfor="delete-project">{t("actions.delete")}</AlertDialog.Action>
 * @example
 * <AlertDialog.Action commandfor="publish-post" color="primary">{t("actions.publish")}</AlertDialog.Action>
 */
AlertDialog.Action = function AlertDialogAction(handle: Handle<AlertDialog.ActionProps>) {
	return () => {
		let { color, command, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_ACTION_COLOR;
		let resolvedCommand = command ?? DEFAULT_COMMAND;

		return <Button {...rest} color={resolvedColor} command={resolvedCommand} data-slot="action" />;
	};
};

/**
 * Renders the panel's dismiss control for the ancestor {@link AlertDialog}
 * named by `commandfor`: an outline-styled, neutral-colored {@link Button}
 * that backs out of the interruption without taking
 * {@link AlertDialog.Action}'s action. `command` defaults to `"close"`, so
 * passing `commandfor` and the button's label is enough to wire it up.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the cancel control's markup.
 * @example
 * <AlertDialog.Cancel commandfor="delete-project">{t("actions.cancel")}</AlertDialog.Cancel>
 */
AlertDialog.Cancel = function AlertDialogCancel(handle: Handle<AlertDialog.CancelProps>) {
	return () => {
		let { variant, color, command, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_CANCEL_VARIANT;
		let resolvedColor = color ?? DEFAULT_CANCEL_COLOR;
		let resolvedCommand = command ?? DEFAULT_COMMAND;

		return (
			<Button
				{...rest}
				variant={resolvedVariant}
				color={resolvedColor}
				command={resolvedCommand}
				data-slot="cancel"
			/>
		);
	};
};
