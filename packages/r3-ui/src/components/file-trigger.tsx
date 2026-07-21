/**
 * A pressable surface that opens the platform's file picker, backed by a
 * native `<input type="file">` wrapped in a `<label>` so the platform itself
 * handles the trigger-to-picker wiring. Its visible content renders inside
 * the same label as a button-like surface, colored, weighted, and sized
 * through the same semantic contract as this library's other pressable
 * controls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { attrs, css } from "remix/ui";

import { interactiveTransition } from "../styles/interactive-transition";
import { hasAccessibleText } from "../utils/has-accessible-text";

/** Semantic color role {@link FileTrigger} falls back to when `color` is omitted. */
const DEFAULT_COLOR: FileTrigger.Color = "neutral";

/** Visual weight {@link FileTrigger} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: FileTrigger.Variant = "solid";

/** Size variant {@link FileTrigger} falls back to when `size` is omitted. */
const DEFAULT_SIZE: FileTrigger.Size = "md";

/**
 * Prop types for {@link FileTrigger}.
 */
export namespace FileTrigger {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*` variables.
	 */
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Visual weight the trigger renders with: a solid fill with an on-solid
	 * foreground, a transparent fill with a strong colored border, or a fully
	 * transparent fill with just a colored label.
	 */
	export type Variant = "solid" | "outline" | "ghost";

	/**
	 * Size variant controlling the trigger's padding and font size.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Per-part styling for the elements this component composes besides its
	 * own host `<input>`.
	 */
	export interface PartsProps {
		/** Styling for the `<label>` rendering as the trigger's visible, pressable surface. */
		trigger?: TagProps<"label">["mix"];
	}

	/**
	 * Props accepted by {@link FileTrigger}. Every native `<input type="file">`
	 * attribute is available unchanged, aside from `type`, `role`, and `size`
	 * — `type` is always `"file"`, the platform allows no `role` override on a
	 * file input, and `size` is repurposed for the trigger's visual size
	 * variant instead of the native character-width attribute. `accept` and
	 * `multiple` carry their native meaning: a comma-separated list of
	 * accepted MIME types or extensions, and whether more than one file may
	 * be chosen. `capture` carries its native meaning too, requesting a
	 * specific camera where a mobile browser's picker offers one.
	 */
	export interface Props extends Omit<TagProps<"input">, "type" | "role" | "size"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Visual weight. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/**
		 * Switches the picker from choosing individual files to choosing whole
		 * directories, carrying every file nested inside the chosen directory.
		 */
		acceptDirectory?: boolean;
		/**
		 * The trigger's visible content, rendered inside the same `<label>` that
		 * wraps the host `<input>` — an icon, text, or both. Keep it to
		 * decorative content rather than another interactive control: the
		 * platform's label-to-control association is what opens the picker with
		 * no script involved, and nesting another focusable control inside the
		 * label would intercept that click before it ever reaches the input.
		 */
		children?: RemixNode;
		/** Per-part styling for this component's internally composed elements. */
		parts?: PartsProps;
	}
}

/**
 * Renders a native `<input type="file">` wrapped in a `<label>`, colored and
 * shaped through the label's own `data-color`, `data-variant`, and
 * `data-size` attribute contract, exactly mirroring this library's other
 * pressable controls: `"solid"` fills the label with the color's solid
 * background and on-solid foreground, `"outline"` renders a strong colored
 * border over a transparent fill, and `"ghost"` renders just the colored
 * label until hovered or pressed.
 *
 * The input itself stays visually hidden through a clip technique rather
 * than `display: none`, so it remains reachable in the tab order and keeps
 * responding to its own native keyboard activation. Hover and pressed states
 * read directly off the label, which the pointer actually lands on, while
 * the focus-visible ring and disabled dimming read the input's own
 * `:focus-visible` and `:disabled` states through a `:has()` query, since
 * the input — not the label — is the element that actually gets focused and
 * disabled. Clicking anywhere in the label, including its visible content,
 * activates the input through the platform's own label-to-control
 * association, opening the file picker with no script involved.
 *
 * Setting `acceptDirectory` switches the picker to choosing whole
 * directories instead of individual files.
 *
 * In dev mode, a trigger whose content carries no plain text and no
 * `aria-label`/`aria-labelledby` logs a `console.warn`, since assistive
 * technology otherwise has no accessible name to announce for it.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <FileTrigger name="avatar" accept="image/png, image/jpeg">
 * 	{t("profile.chooseFile")}
 * </FileTrigger>
 * @example
 * <FileTrigger name="attachments" multiple color="primary" variant="outline">
 * 	{t("thread.attachFiles")}
 * </FileTrigger>
 * @example
 * <FileTrigger name="folder" acceptDirectory aria-label={t("importer.chooseFolder")} />
 */
export function FileTrigger(handle: Handle<FileTrigger.Props>) {
	return () => {
		let { color, variant, size, acceptDirectory, children, parts, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedSize = size ?? DEFAULT_SIZE;

		if (
			import.meta.env.DEV &&
			!handle.props["aria-label"] &&
			!handle.props["aria-labelledby"] &&
			!hasAccessibleText(children)
		) {
			console.warn(
				"FileTrigger: a trigger with no visible label text needs an `aria-label` describing what it opens — assistive technology has no accessible name to announce otherwise.",
			);
		}

		return (
			<label
				data-slot="trigger"
				data-color={resolvedColor}
				data-variant={resolvedVariant}
				data-size={resolvedSize}
				mix={[
					interactiveTransition(),
					css({
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "0.5rem",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						fontWeight: "500",
						cursor: "default",
						userSelect: "none",

						paddingInline: "1rem",
						paddingBlock: "0.5rem",
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",

						'&[data-size="sm"]': {
							paddingInline: "0.75rem",
							paddingBlock: "0.375rem",
							fontSize: "0.75rem",
							lineHeight: "calc(1 / 0.75)",
						},
						'&[data-size="lg"]': {
							paddingInline: "1.25rem",
							paddingBlock: "0.625rem",
							fontSize: "1rem",
							lineHeight: "1.5",
						},

						'&[data-variant="solid"]': {
							'&[data-color="primary"]': {
								backgroundColor: "var(--ui-primary-bg-solid)",
								color: "var(--ui-primary-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-primary-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-primary-bg-solid-pressed)" },
							},
							'&[data-color="neutral"]': {
								backgroundColor: "var(--ui-neutral-bg-solid)",
								color: "var(--ui-neutral-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-neutral-bg-solid-pressed)" },
							},
							'&[data-color="success"]': {
								backgroundColor: "var(--ui-success-bg-solid)",
								color: "var(--ui-success-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-success-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-success-bg-solid-pressed)" },
							},
							'&[data-color="warning"]': {
								backgroundColor: "var(--ui-warning-bg-solid)",
								color: "var(--ui-warning-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-warning-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-warning-bg-solid-pressed)" },
							},
							'&[data-color="danger"]': {
								backgroundColor: "var(--ui-danger-bg-solid)",
								color: "var(--ui-danger-fg-on-solid)",
								"&:hover": { backgroundColor: "var(--ui-danger-bg-solid-hover)" },
								"&:active": { backgroundColor: "var(--ui-danger-bg-solid-pressed)" },
							},
						},

						'&[data-variant="outline"]': {
							borderWidth: "2px",
							backgroundColor: "transparent",
							'&[data-color="primary"]': {
								borderColor: "var(--ui-primary-border-strong)",
								color: "var(--ui-primary-fg)",
								"&:hover": { backgroundColor: "var(--ui-primary-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-primary-bg-tint-hover)" },
							},
							'&[data-color="neutral"]': {
								borderColor: "var(--ui-neutral-border-strong)",
								color: "var(--ui-neutral-fg)",
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
							},
							'&[data-color="success"]': {
								borderColor: "var(--ui-success-border-strong)",
								color: "var(--ui-success-fg)",
								"&:hover": { backgroundColor: "var(--ui-success-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-success-bg-tint-hover)" },
							},
							'&[data-color="warning"]': {
								borderColor: "var(--ui-warning-border-strong)",
								color: "var(--ui-warning-fg)",
								"&:hover": { backgroundColor: "var(--ui-warning-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-warning-bg-tint-hover)" },
							},
							'&[data-color="danger"]': {
								borderColor: "var(--ui-danger-border-strong)",
								color: "var(--ui-danger-fg)",
								"&:hover": { backgroundColor: "var(--ui-danger-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-danger-bg-tint-hover)" },
							},
						},

						'&[data-variant="ghost"]': {
							backgroundColor: "transparent",
							'&[data-color="primary"]': {
								color: "var(--ui-primary-fg)",
								"&:hover": { backgroundColor: "var(--ui-primary-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-primary-bg-tint-hover)" },
							},
							'&[data-color="neutral"]': {
								color: "var(--ui-neutral-fg)",
								"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
								"&:active": { backgroundColor: "var(--ui-neutral-bg-tint-pressed)" },
							},
							'&[data-color="success"]': {
								color: "var(--ui-success-fg)",
								"&:hover": { backgroundColor: "var(--ui-success-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-success-bg-tint-hover)" },
							},
							'&[data-color="warning"]': {
								color: "var(--ui-warning-fg)",
								"&:hover": { backgroundColor: "var(--ui-warning-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-warning-bg-tint-hover)" },
							},
							'&[data-color="danger"]': {
								color: "var(--ui-danger-fg)",
								"&:hover": { backgroundColor: "var(--ui-danger-bg-tint)" },
								"&:active": { backgroundColor: "var(--ui-danger-bg-tint-hover)" },
							},
						},

						"&:has(input:focus-visible)": {
							outlineWidth: "2px",
							outlineStyle: "solid",
							outlineOffset: "2px",
							outlineColor: "var(--ui-primary-ring)",
							'&[data-color="neutral"]': { outlineColor: "var(--ui-neutral-ring)" },
							'&[data-color="success"]': { outlineColor: "var(--ui-success-ring)" },
							'&[data-color="warning"]': { outlineColor: "var(--ui-warning-ring)" },
							'&[data-color="danger"]': { outlineColor: "var(--ui-danger-ring)" },
						},

						"&:has(input:disabled)": {
							cursor: "not-allowed",
							opacity: "0.5",
						},
					}),
					parts?.trigger,
				]}
			>
				{children}
				<input
					type="file"
					{...rest}
					mix={[
						acceptDirectory && attrs({ webkitdirectory: true }),
						css({
							position: "absolute",
							inlineSize: "1px",
							blockSize: "1px",
							margin: 0,
							overflow: "hidden",
							clipPath: "inset(50%)",
							whiteSpace: "nowrap",
						}),
						mix,
					]}
				/>
			</label>
		);
	};
}
