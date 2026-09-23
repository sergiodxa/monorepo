/**
 * Live preview island for `ColorField`. The wrapper composes a label, a text control whose
 * native `pattern` constrains the chosen notation, a live swatch and the description and
 * error slots — a plain form field, typed rather than picked. Repainting that swatch as a
 * keystroke lands on a value the notation accepts is the consumer's to apply, so each
 * field carries the same `colorPreview()` wiring a reader would write; the three fields
 * sit at the three notations so the `format` prop's effect on `pattern` is visible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { ColorField } from "@sdxc/ui";
import { colorPreview } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<form mix={[vstack({ gap: 5, align: "stretch" }), is("100%"), maxIs("22rem")]}>
	<ColorField
		label="Brand"
		name="brandColor"
		format="hex"
		defaultValue="#3b82f6"
		description="Buttons, links and focus rings."
		mix={[colorPreview()]}
	/>
	<ColorField
		label="Surface"
		name="surfaceColor"
		format="rgb"
		defaultValue="rgb(24 24 27)"
		description="Panel and sheet backgrounds."
		mix={[colorPreview()]}
	/>
	<ColorField
		label="Danger"
		name="dangerColor"
		format="hsl"
		defaultValue="hsl(0 84% 60%)"
		description="Destructive actions and failed states."
		errorMessage="This one has not passed contrast against the surface yet."
		mix={[colorPreview()]}
	/>
</form>`;

/** Three theme tokens typed in three notations, hydrated so each swatch follows the typing. */
export const ColorFieldPreview = clientEntry(
	"/resources/components/previews/color-field.tsx#ColorFieldPreview",
	function ColorFieldPreview() {
		return () => (
			<form mix={[vstack({ gap: 5, align: "stretch" }), is("100%"), maxIs("22rem")]}>
				<ColorField
					label="Brand"
					name="brandColor"
					format="hex"
					defaultValue="#3b82f6"
					description="Buttons, links and focus rings."
					mix={[colorPreview()]}
				/>
				<ColorField
					label="Surface"
					name="surfaceColor"
					format="rgb"
					defaultValue="rgb(24 24 27)"
					description="Panel and sheet backgrounds."
					mix={[colorPreview()]}
				/>
				<ColorField
					label="Danger"
					name="dangerColor"
					format="hsl"
					defaultValue="hsl(0 84% 60%)"
					description="Destructive actions and failed states."
					errorMessage="This one has not passed contrast against the surface yet."
					mix={[colorPreview()]}
				/>
			</form>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ColorFieldPreview /> };
