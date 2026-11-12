/**
 * The box a person writes a chat message in: a form whose text field grows with what is
 * typed up to a cap and then scrolls, over a toolbar for attaching files, picking options and
 * sending. It is a plain form, so a message posts before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg, outline } from "@sdxc/u/color";
import { shadow } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

/** The slot the text field carries, which `ComposerSubmit` finds to send on Enter. */
export const COMPOSER_INPUT_SLOT = "composer-input";

/** Prop types for {@link Composer} and its compound parts. */
export namespace Composer {
	/** Props accepted by {@link Composer}: every native `<form>` attribute. */
	export interface Props extends TagProps<"form"> {
		/** Attachments, the {@link Composer.Input} and a {@link Composer.Toolbar}, in that order. */
		children: RemixNode;
	}

	/** Props accepted by {@link Composer.Input}: every native `<textarea>` attribute. */
	export type InputProps = TagProps<"textarea">;

	/** Props accepted by {@link Composer.Toolbar}. */
	export interface ToolbarProps extends TagProps<"div"> {
		/** Attach and option controls first, then a {@link Composer.Hint} and the send control. */
		children: RemixNode;
	}

	/** Props accepted by {@link Composer.Hint}. */
	export interface HintProps extends TagProps<"p"> {
		/** How to send, such as `<Keyboard>Enter</Keyboard> to send`. */
		children: RemixNode;
	}
}

/**
 * Renders the composer's surface: one rounded box that draws the focus ring for the field
 * inside it, so the field, its attachments and its toolbar read as a single control.
 *
 * @example
 * <Composer method="post" action="/chat">
 * 	<Composer.Input name="prompt" aria-label="Message" required />
 * 	<Composer.Toolbar><ComposerSubmit labels={{ send: "Send", stop: "Stop" }} /></Composer.Toolbar>
 * </Composer>
 */
export function Composer(handle: Handle<Composer.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<form
				{...rest}
				data-slot="composer"
				mix={mergeMix(
					[
						vstack({ gap: 1, align: "stretch" }),
						p(2),
						raw({ borderRadius: "var(--ui-composer-radius, calc(var(--ui-radius-lg) * 2))" }),
						border({ color: "neutral", width: 1 }),
						bg(),
						shadow("sm"),
						when("&:focus-within", [
							border("neutral.border-strong"),
							outline({ color: "neutral.ring", offset: 0 }),
						]),
					],
					mix,
				)}
			>
				{children}
			</form>
		);
	};
}

/**
 * The message field: borderless inside the composer's frame, one line tall when empty,
 * growing with its text to `--ui-composer-max-block-size` (twelve lines) and scrolling past it.
 */
Composer.Input = function ComposerInput(handle: Handle<Composer.InputProps>) {
	return () => {
		let { mix, rows = 1, ...rest } = handle.props;
		return (
			<textarea
				{...rest}
				rows={rows}
				data-slot={COMPOSER_INPUT_SLOT}
				mix={mergeMix(
					[
						m(0),
						raw({
							display: "block",
							inlineSize: "100%",
							boxSizing: "border-box",
							paddingInline: "0.5rem",
							paddingBlock: "0.5rem",
							border: "none",
							background: "transparent",
							color: "inherit",
							font: "inherit",
							fontSize: "1rem",
							lineHeight: "1.5",
							resize: "none",
							fieldSizing: "content",
							minBlockSize: "calc(1lh + 1rem)",
							maxBlockSize: "var(--ui-composer-max-block-size, calc(12lh + 1rem))",
							overflowY: "auto",
							outline: "none",
						}),
						when("&::placeholder", fg("neutral.fg-muted")),
					],
					mix,
				)}
			/>
		);
	};
};

/** The row under the field: controls at the start, the hint and send control at the end. */
Composer.Toolbar = function ComposerToolbar(handle: Handle<Composer.ToolbarProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="composer-toolbar"
				mix={mergeMix([hstack({ gap: 1, align: "center" }), raw({ minInlineSize: 0 })], mix)}
			>
				{children}
			</div>
		);
	};
};

/**
 * How to send, set at the toolbar's end before the send control. It truncates rather than
 * widen a narrow composer, and hides on touch screens, where only the send button sends.
 */
Composer.Hint = function ComposerHint(handle: Handle<Composer.HintProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<p
				{...rest}
				data-slot="composer-hint"
				mix={mergeMix(
					[
						m(0),
						raw({
							marginInlineStart: "auto",
							paddingInline: "0.5rem",
							minInlineSize: 0,
							overflow: "hidden",
							whiteSpace: "nowrap",
							textOverflow: "ellipsis",
						}),
						text("xs"),
						fg("neutral.fg-muted"),
						media("(hover: none)", raw({ display: "none" })),
					],
					mix,
				)}
			>
				{children}
			</p>
		);
	};
};
