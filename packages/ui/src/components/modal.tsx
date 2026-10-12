/**
 * A pre-animated preset of {@link Dialog}: the same native `<dialog>` panel,
 * its `::backdrop` treatment, and every compound part, with the panel's own
 * pop-in and pop-out motion — a fade paired with a scale, entering from
 * slightly smaller than rest and leaving faster, shrinking only halfway back
 * and blurring softly as it fades — already wired onto the host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { durations, easings } from "../animations/tokens.js";
import { enterExit } from "../animations/transitions.js";

import { Dialog } from "./dialog.js";

/** `scale` factor {@link Modal}'s panel grows from on entry. */
const PANEL_ENTRY_SCALE = 0.95;

/** `scale` factor the panel shrinks to on exit, halfway back toward its entry scale. */
const PANEL_EXIT_SCALE = 0.975;

/** Blur radius in pixels the panel softens to as it fades out. */
const PANEL_EXIT_BLUR_PX = 2;

/**
 * Prop types for {@link Modal} and its compound parts. Every part aliases
 * {@link Dialog}'s matching part, since {@link Modal} renders straight
 * through to {@link Dialog}'s own markup.
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
 * Renders {@link Dialog} with its panel's pop-in/pop-out motion pre-wired
 * through `mix`, collapsing to an opacity-only fade under reduced motion.
 * A `mix` passed to {@link Modal} layers alongside the built-in motion.
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
					enterExit({
						opacity: 0,
						scale: PANEL_ENTRY_SCALE,
						duration: durations.normal,
						easing: easings.standard,
						exit: { scale: PANEL_EXIT_SCALE, blur: PANEL_EXIT_BLUR_PX },
						exitDuration: durations.fast,
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
 * markup with {@link Dialog}.
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
