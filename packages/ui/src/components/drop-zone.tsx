/**
 * A styled drop target for files: a dashed, centered surface wrapping a
 * native `<input type="file">`, so picking a file through the platform's own
 * file picker works the moment the markup renders, with no script involved.
 * Its decorative content — an icon, an instructional caption, or both —
 * renders inside the same `<label>` that wraps the input, giving the input
 * its accessible name through the platform's own label association.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexCol, gap, items, justify } from "@sdxc/u/layout";
import { minBs, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { textAlign } from "@sdxc/u/typography";

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
	 * Props accepted by {@link DropZone}. `mix` styles the outer `<label>` —
	 * the visible drop surface a hydrated drag-and-drop mixin attaches to —
	 * while `parts.input` styles the nested file input.
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
		 * The zone's visible content — an icon, an instructional caption, or both —
		 * rendered inside the `<label>` that wraps the file input, so clicking it
		 * opens the picker and names the input via label association.
		 */
		children?: RemixNode;
		/** Per-part styling for this component's internally composed input. */
		parts?: PartsProps;
	}
}

/**
 * Renders a native `<input type="file">` wrapped in a `<label>` styled as a
 * dashed, centered drop surface; a paired drag-and-drop mixin toggles the
 * `data-drop-target` attribute this surface's styling reacts to.
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
					when("&:has(input:focus-visible)", outline({ color: "brand.ring", offset: 2 })),
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
					when("&[data-drop-target]", [border("brand.ring"), bg("brand.tint")]),
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
