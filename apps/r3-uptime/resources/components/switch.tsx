/**
 * A toggle switch for boolean form fields — a track+thumb pill that slides between
 * on/off, matching the green-track/white-thumb design used across the product. Built
 * from a native `<input type="checkbox">` so the field still submits as a plain
 * checkbox with no client JS: the checkbox is visually hidden and a sibling
 * track/thumb pair reacts to its `:checked`/`:focus-visible`/`:disabled`/`:active`
 * state through CSS combinators alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import { neutral, primary } from "~/resources/theme";

namespace Switch {
	export interface Props {
		/** The checkbox's `name`; submitted as `"true"` when the switch is on. */
		name: string;
		/** Whether the switch starts on. */
		defaultChecked?: boolean;
		disabled?: boolean;
		/** Label text rendered next to the track. */
		children: RemixNode;
	}
}

/** Renders a track+thumb switch backed by a visually-hidden native checkbox. */
export default function Switch(handle: Handle<Switch.Props>) {
	return () => {
		let { name, defaultChecked, disabled, children } = handle.props;

		return (
			<label
				mix={[
					css({
						position: "relative",
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 16,
						fontSize: "0.875rem",
						cursor: disabled ? "not-allowed" : "pointer",
						userSelect: "none",

						"& input": {
							position: "absolute",
							width: 1,
							height: 1,
							padding: 0,
							margin: -1,
							overflow: "hidden",
							clipPath: "inset(50%)",
							whiteSpace: "nowrap",
							border: 0,
						},

						"& .switch-track": {
							display: "inline-flex",
							alignItems: "center",
							flexShrink: 0,
							width: 44,
							height: 24,
							padding: 2,
							borderRadius: 9999,
							background: neutral[200],
							transition: "background-color 150ms ease",
						},

						"& .switch-thumb": {
							display: "block",
							width: 20,
							height: 20,
							borderRadius: 9999,
							background: "#ffffff",
							boxShadow: "0 1px 2px rgba(0, 0, 0, 0.25)",
							transition: "transform 150ms ease",
							transform: "translateX(0)",
						},

						"& input:checked ~ .switch-track": { background: primary[600] },
						"& input:checked ~ .switch-track .switch-thumb": {
							transform: "translateX(20px)",
						},
						"& input:active ~ .switch-track": {
							background: `color-mix(in srgb, ${neutral[200]} 70%, black)`,
						},
						"& input:checked:active ~ .switch-track": {
							background: `color-mix(in srgb, ${primary[600]} 85%, black)`,
						},
						"& input:active ~ .switch-track .switch-thumb": { transform: "scale(0.95)" },
						"& input:checked:active ~ .switch-track .switch-thumb": {
							transform: "translateX(20px) scale(0.95)",
						},
						"& input:focus-visible ~ .switch-track": {
							outline: `2px solid ${primary[600]}`,
							outlineOffset: 2,
						},
						"& input:disabled ~ .switch-track": { opacity: 0.5 },

						"@media (prefers-color-scheme: dark)": {
							"& .switch-track": { background: neutral[700] },
							"& input:active ~ .switch-track": {
								background: `color-mix(in srgb, ${neutral[700]} 70%, white)`,
							},
						},
					}),
				]}
			>
				<input
					type="checkbox"
					name={name}
					value="true"
					defaultChecked={defaultChecked}
					disabled={disabled}
				/>
				<span class="switch-track">
					<span class="switch-thumb" />
				</span>
				<span>{children}</span>
			</label>
		);
	};
}
