/**
 * An interruptive modal surface that demands an explicit response before a
 * page continues — confirming a destructive action, surfacing a blocking
 * error — built on the native `<dialog>` host of {@link Dialog}, widened for
 * its two-button layout and sealed against light dismiss. Its compound parts
 * cover a header, title, description, and a two-control footer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@pkg/u/color";
import { flex, gap, justify, vstack } from "@pkg/u/layout";
import { maxIs, mbs } from "@pkg/u/size";
import { text, weight } from "@pkg/u/typography";

import { Button } from "./button";
import { Dialog } from "./dialog";
import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope";

/**
 * Invoker Commands verb {@link AlertDialog.Action} and
 * {@link AlertDialog.Cancel} fall back to when `command` is omitted,
 * dismissing the ancestor AlertDialog named by `commandfor`.
 */
const DEFAULT_COMMAND = "close";

/**
 * Native `button` `type` {@link AlertDialog.Action} and
 * {@link AlertDialog.Cancel} always spell out, since the platform runs an
 * Invoker Command only from a button typed `"button"`, `<form>` or not.
 */
const DEFAULT_TYPE: NonNullable<Button.Props["type"]> = "button";

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
	 * Every prop {@link Dialog} accepts, minus the ones this component fixes:
	 * `role` is always `"alertdialog"` and `closedby`/`closedBy` always
	 * `"closerequest"`, so the panel closes only on an explicit close request.
	 */
	export interface Props extends Omit<Dialog.Props, "role" | "closedby" | "closedBy"> {}

	/**
	 * Props accepted by {@link AlertDialog.Header}.
	 */
	export interface HeaderProps extends TagProps<"div"> {}

	/**
	 * Props accepted by {@link AlertDialog.Title}. Every native heading-element
	 * attribute applies, since the rendered tag follows the nearest ambient
	 * heading level, falling back to `<h1>`.
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
		/**
		 * `id` of the ancestor {@link AlertDialog} this action dismisses.
		 * Required for the default `type="button"` action; a `type="submit"`
		 * action ends the interruption by submitting its enclosing form.
		 */
		commandfor?: string;
		/**
		 * Invoker Commands verb dispatched to the target AlertDialog. Defaults
		 * to `"close"`, and is dropped for a `"submit"` or `"reset"` action,
		 * which the platform drives as a form control instead of an invoker.
		 */
		command?: "close";
	}

	/**
	 * Props accepted by {@link AlertDialog.Cancel}: every {@link Button.Props}
	 * field except `commandfor`/`command`/`type`, which this type narrows.
	 */
	export interface CancelProps extends Omit<Button.Props, "commandfor" | "command" | "type"> {
		/** `id` of the ancestor {@link AlertDialog} this cancel control dismisses. */
		commandfor: string;
		/** Invoker Commands verb dispatched to the target AlertDialog. Defaults to `"close"`. */
		command?: "close";
		/**
		 * Narrowed to the only value a cancel control carries, and always
		 * rendered, since the platform runs its close command only from a
		 * button typed `"button"`, including inside a `<form>`.
		 */
		type?: "button";
	}
}

/**
 * Renders the alert panel through {@link Dialog}, widened to fit a two-button
 * footer, with `role` fixed to `"alertdialog"` and `closedby` to
 * `"closerequest"` so the interruption clears through an explicit response.
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
			<Dialog {...rest} role="alertdialog" closedby="closerequest" mix={[maxIs("32rem"), mix]}>
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

		return <div {...rest} data-slot="header" mix={[vstack({ gap: 2 }), mix]} />;
	};
};

/**
 * Renders {@link AlertDialog.TitleProps.children} as the panel's heading,
 * inside the native heading element matching the nearest ancestor
 * `HeadingScope`'s depth, or `<h1>` where no scope wraps it.
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
				mix={[fg("neutral.emphasis"), weight("semibold"), text("lg"), mix]}
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
			<p {...rest} data-slot="description" mix={[fg("neutral.muted"), text("sm"), mix]}>
				{rest.children}
			</p>
		);
	};
};

/**
 * Renders {@link AlertDialog.FooterProps.children} as an end-aligned action
 * row. Compose {@link AlertDialog.Cancel} before {@link AlertDialog.Action}
 * so the emphasized, potentially destructive control renders last.
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

		return <div {...rest} data-slot="footer" mix={[gap(2), mbs(6), flex(), justify("end"), mix]} />;
	};
};

/**
 * Renders the panel's emphasized action as a danger-toned {@link Button},
 * typed `"button"` so its `command="close"` reaches the {@link AlertDialog}
 * named by `commandfor`; `type="submit"` submits the enclosing form instead.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the action's markup.
 * @example
 * <AlertDialog.Action commandfor="delete-project">{t("actions.delete")}</AlertDialog.Action>
 * @example
 * <AlertDialog.Action commandfor="publish-post" color="brand">{t("actions.publish")}</AlertDialog.Action>
 * @example
 * <AlertDialog.Action type="submit" name="intent" value="delete">{t("actions.delete")}</AlertDialog.Action>
 */
AlertDialog.Action = function AlertDialogAction(handle: Handle<AlertDialog.ActionProps>) {
	return () => {
		let { type, color, command, commandfor, ...rest } = handle.props;
		let resolvedType = type ?? DEFAULT_TYPE;
		let isInvoker = resolvedType === "button";
		let resolvedColor = color ?? DEFAULT_ACTION_COLOR;

		if (import.meta.env.DEV && isInvoker && !commandfor) {
			console.warn(
				'AlertDialog.Action: needs "commandfor" naming the panel it dismisses, or type="submit" to submit its enclosing form instead — as rendered, pressing it does nothing.',
			);
		}

		return (
			<Button
				{...rest}
				type={resolvedType}
				color={resolvedColor}
				commandfor={isInvoker ? commandfor : undefined}
				command={isInvoker ? (command ?? DEFAULT_COMMAND) : undefined}
				data-slot="action"
			/>
		);
	};
};

/**
 * Renders the panel's dismiss control as an outline, neutral {@link Button}
 * with `type` fixed to `"button"`, so its `command="close"` reaches the
 * {@link AlertDialog} named by `commandfor` from inside a `<form>` too.
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
				type={DEFAULT_TYPE}
				variant={resolvedVariant}
				color={resolvedColor}
				command={resolvedCommand}
				data-slot="cancel"
			/>
		);
	};
};
