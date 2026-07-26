/**
 * A styled drop target for files: a dashed, centered surface wrapping a
 * native `<input type="file">`, so picking a file through the platform's own
 * file picker works the moment the markup renders, with no script involved.
 * Its decorative content — an icon, an instructional caption, or both —
 * renders inside the same `<label>` that wraps the input, giving the input
 * its accessible name through the platform's own label association rather
 * than a separate prop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, border, fg, outline } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flex, flexCol, gap, items, justify } from "@pkg/u/layout";
import { minBs, pb, pi } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { textAlign } from "@pkg/u/typography";

import { interactiveTransition } from "../styles/interactive-transition";
import { warnIfNoAccessibleName } from "../utils/warn-if-no-accessible-name";

/**
 * Prop types for {@link DropZone}.
 */
export namespace DropZone {
	/**
	 * Per-part styling for the elements this component composes besides its
	 * own host `<label>`.
	 */
	export interface PartsProps {
		/** Styling for the native `<input type="file">` nested inside the zone. */
		input?: TagProps<"input">["mix"];
	}

	/**
	 * Props accepted by {@link DropZone}. Every native `<label>` attribute is
	 * available unchanged, and `mix` styles that same `<label>` — the visible
	 * drop surface itself, which is also where a hydrated island attaches a
	 * drag-and-drop mixin, since that surface is what a dragged file actually
	 * needs to cover. The handful of attributes the nested file input itself
	 * understands are listed individually below and forwarded onto that input
	 * instead, styled through `parts.input` rather than the top-level `mix`.
	 */
	export interface Props extends TagProps<"label"> {
		/** Native `name` submitted with an enclosing form. */
		name?: string;
		/** Comma-separated list of accepted MIME types or file extensions. */
		accept?: string;
		/** Whether more than one file may be chosen at once. */
		multiple?: boolean;
		/** Requests a specific camera where a mobile browser's picker offers one. */
		capture?: TagProps<"input">["capture"];
		/** Marks the control required for its enclosing form. */
		required?: boolean;
		/** Marks the control inert and excluded from the tab order. */
		disabled?: boolean;
		/**
		 * The zone's visible content — an icon, an instructional caption, or
		 * both — rendered inside the same `<label>` that wraps the nested file
		 * input, so clicking or tapping any of it opens the file picker and
		 * gives the input its accessible name through the platform's own label
		 * association, with no separate `aria-label` required.
		 */
		children?: RemixNode;
		/** Per-part styling for this component's internally composed input. */
		parts?: PartsProps;
	}
}

/**
 * Renders a native `<input type="file">` wrapped in a `<label>` styled as a
 * dashed, centered drop surface. Clicking or tapping anywhere in the surface
 * — including its decorative content — opens the platform's file picker
 * through the label's own association with the input, and the label's
 * visible text becomes the input's accessible name with no separate prop
 * needed.
 *
 * The `data-drop-target` attribute this surface's styling reacts to —
 * tinting the border and background toward the primary color — is a
 * DOM-only attribute a paired drag-and-drop mixin toggles; this component
 * never sets it itself, so the surface renders in its resting state until
 * one is attached. The focus-visible ring reads the nested input's own
 * `:focus-visible` state through a `:has()` query, since the input — not the
 * label — is the element that actually receives keyboard focus.
 *
 * Dragging a file from outside the page and dropping it directly onto this
 * surface needs a script to read the drag payload and highlight the surface
 * while it hovers; this component's own markup covers only the platform's
 * file picker, reachable by clicking the surface or tabbing to its nested
 * input.
 *
 * In dev mode, a zone whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since assistive
 * technology otherwise has no accessible name to announce for its nested
 * input.
 *
 * @param handle Runtime handle carrying the host `<label>`'s props.
 * @returns The render function producing the drop zone's markup.
 * @example
 * <DropZone name="attachments" multiple>
 * 	{t("uploads.dropInstructions")}
 * </DropZone>
 * @example
 * <DropZone name="avatar" accept="image/png, image/jpeg" aria-label={t("profile.chooseAvatar")}>
 * 	<ImageIcon aria-hidden />
 * </DropZone>
 * @example
 * <DropZone name="documents" multiple accept="application/pdf" required>
 * 	<p>{t("uploads.dropHint")}</p>
 * </DropZone>
 */
export function DropZone(handle: Handle<DropZone.Props>) {
	return () => {
		let { name, accept, multiple, capture, required, disabled, children, parts, mix, ...rest } =
			handle.props;

		warnIfNoAccessibleName(
			handle.props,
			children,
			"DropZone: a zone with no visible instructional text needs an `aria-label` describing what it accepts — assistive technology has no accessible name to announce for its file input otherwise.",
		);

		return (
			<label
				{...rest}
				data-slot="zone"
				mix={[
					when("&:has(input:focus-visible)", outline({ color: "primary.ring", offset: 2 })),
					flex(),
					flexCol(),
					items("center"),
					justify("center"),
					gap(2),
					minBs("6rem"),
					rounded("lg"),
					border({ color: "neutral", width: "2px", style: "dashed" }),
					pi(6),
					pb(6),
					textAlign("center"),
					bg("neutral.tint"),
					fg("neutral"),
					when("&[data-drop-target]", [border("primary.ring"), bg("primary.tint")]),
					interactiveTransition(),
					mix,
				]}
			>
				{children}
				<input
					type="file"
					name={name}
					accept={accept}
					multiple={multiple}
					capture={capture}
					required={required}
					disabled={disabled}
					mix={parts?.input}
				/>
			</label>
		);
	};
}
