/**
 * A pre-animated preset of {@link Dialog}: the same native `<dialog>` panel,
 * its `::backdrop` treatment, and every compound part, with the panel's own
 * pop-in and pop-out motion — a fade paired with a scale, entering from
 * slightly smaller and less opaque than rest and exiting back down to it —
 * already wired onto the host instead of left for a consumer to compose
 * through `mix` themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import { durations, easings } from "../animations/tokens";

import { Dialog } from "./dialog";

/**
 * Exit-state `scale` factor {@link Modal}'s panel animates from on entry and
 * back down to on exit.
 */
const PANEL_EXIT_SCALE = "0.95";

/**
 * Entered-state `scale` factor — the platform's own reset value, undoing
 * {@link PANEL_EXIT_SCALE} once the panel is open.
 */
const PANEL_ENTERED_SCALE = "none";

/**
 * Prop types for {@link Modal} and its compound parts. Every part is an
 * alias of {@link Dialog}'s matching part, since {@link Modal} renders
 * straight through to {@link Dialog} rather than declaring an independent
 * markup shape of its own.
 */
export namespace Modal {
	/** Every prop {@link Dialog.Props} accepts, unchanged. */
	export interface Props extends Dialog.Props {}

	/** Every prop {@link Dialog.HeaderProps} accepts, unchanged. */
	export interface HeaderProps extends Dialog.HeaderProps {}

	/** Every prop {@link Dialog.TitleProps} accepts, unchanged. */
	export interface TitleProps extends Dialog.TitleProps {}

	/** Every prop {@link Dialog.DescriptionProps} accepts, unchanged. */
	export interface DescriptionProps extends Dialog.DescriptionProps {}

	/** Every prop {@link Dialog.FooterProps} accepts, unchanged. */
	export interface FooterProps extends Dialog.FooterProps {}

	/** Every prop {@link Dialog.CloseProps} accepts, unchanged. */
	export interface CloseProps extends Dialog.CloseProps {}
}

/**
 * Renders {@link Dialog} with its panel's pop-in/pop-out motion already
 * applied through `mix`: the panel scales and fades between
 * {@link PANEL_EXIT_SCALE}/transparent and its resting size/full opacity
 * across the platform's own `open` state, timed by the animation layer's
 * `normal` duration and `standard` easing, and collapsing to an opacity-only
 * fade under `prefers-reduced-motion: reduce`. Every other detail (the
 * `::backdrop` treatment, the `ui-dialog` named container its compound parts
 * query, and the missing-`id` dev-mode contract check) rides along unchanged
 * from {@link Dialog}, since this component composes it directly instead of
 * duplicating its markup or styling. A `mix` passed to {@link Modal} itself
 * layers alongside the built-in motion rather than replacing it.
 *
 * @param handle Runtime handle carrying the host `<dialog>`'s props.
 * @returns The render function producing the animated panel's markup.
 * @example
 * <Button commandfor="welcome" command="show-modal">{t("welcome.cta")}</Button>
 * <Modal id="welcome" aria-labelledby="welcome-title">
 * 	<Modal.Header>
 * 		<Modal.Title id="welcome-title">{t("welcome.title")}</Modal.Title>
 * 	</Modal.Header>
 * </Modal>
 * @example
 * <Modal id="confirm-delete" aria-labelledby="confirm-delete-title">
 * 	<Modal.Close commandfor="confirm-delete" aria-label={t("actions.close")} />
 * 	<Modal.Header>
 * 		<Modal.Title id="confirm-delete-title">{t("project.deleteTitle")}</Modal.Title>
 * 		<Modal.Description>{t("project.deleteDescription")}</Modal.Description>
 * 	</Modal.Header>
 * 	<Modal.Footer>
 * 		<Button commandfor="confirm-delete" command="close" color="danger">{t("actions.delete")}</Button>
 * 	</Modal.Footer>
 * </Modal>
 */
export function Modal(handle: Handle<Modal.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<Dialog
				{...rest}
				mix={[
					css({
						scale: PANEL_EXIT_SCALE,
						opacity: "0",
						transitionProperty: "opacity, scale, display, overlay",
						transitionDuration: `${durations.normal}ms`,
						transitionTimingFunction: easings.standard,
						transitionBehavior: "allow-discrete",

						"&[open]": {
							scale: PANEL_ENTERED_SCALE,
							opacity: "1",
						},
						"@starting-style": {
							"&[open]": {
								scale: PANEL_EXIT_SCALE,
								opacity: "0",
							},
						},
						"@media (prefers-reduced-motion: reduce)": {
							scale: PANEL_ENTERED_SCALE,
							transitionProperty: "opacity, display, overlay",
						},
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders {@link Modal.HeaderProps.children} as the panel's header slot:
 * identical to {@link Dialog.Header}, since {@link Modal} shares its panel
 * markup with {@link Dialog} rather than declaring its own header.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the header slot's markup.
 * @example
 * <Modal.Header>
 * 	<Modal.Title>{t("welcome.title")}</Modal.Title>
 * </Modal.Header>
 */
Modal.Header = Dialog.Header;

/**
 * Renders {@link Modal.TitleProps.children} as the panel's heading:
 * identical to {@link Dialog.Title}.
 *
 * @param handle Runtime handle carrying the host `<h2>`'s props.
 * @returns The render function producing the heading's markup.
 * @example
 * <Modal.Title>{t("welcome.title")}</Modal.Title>
 */
Modal.Title = Dialog.Title;

/**
 * Renders {@link Modal.DescriptionProps.children} as the panel's supporting
 * copy: identical to {@link Dialog.Description}.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 * @example
 * <Modal.Description>{t("welcome.description")}</Modal.Description>
 */
Modal.Description = Dialog.Description;

/**
 * Renders {@link Modal.FooterProps.children} as the panel's action row:
 * identical to {@link Dialog.Footer}.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action row's markup.
 * @example
 * <Modal.Footer>
 * 	<Button commandfor="welcome" command="close" variant="outline">{t("actions.cancel")}</Button>
 * 	<Button commandfor="welcome" command="close">{t("actions.continue")}</Button>
 * </Modal.Footer>
 */
Modal.Footer = Dialog.Footer;

/**
 * Renders a dismiss control for the ancestor {@link Modal} named by
 * `commandfor`: identical to {@link Dialog.Close}.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the dismiss control's markup.
 * @example
 * <Modal.Close commandfor="welcome" aria-label={t("actions.close")} />
 */
Modal.Close = Dialog.Close;
