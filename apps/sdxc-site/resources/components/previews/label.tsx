/**
 * Live preview island for `Label`. A caption is only worth looking at next to the field
 * it names, so the preview is a profile form showing the three shapes one takes: pointing
 * at a field by `id`, carrying a trailing optional-marker alongside the caption text, and
 * wrapping its control so the platform pairs them with no `id` at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Description, Input, Label } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<form mix={[vstack({ gap: 5, align: "stretch" })]}>
	<div mix={[vstack({ gap: 2, align: "stretch" })]}>
		<Label htmlFor="display-name">Display name</Label>
		<Input
			id="display-name"
			name="displayName"
			defaultValue="Sergio"
			required
			aria-describedby="display-name-hint"
		/>
		<Description id="display-name-hint">Shown on every comment you leave.</Description>
	</div>

	<div mix={[vstack({ gap: 2, align: "stretch" })]}>
		<Label htmlFor="company" mix={[hstack({ gap: 2, justify: "between" })]}>
			Company
			<span mix={[text("xs"), fg("neutral.muted")]}>Optional</span>
		</Label>
		<Input id="company" name="company" placeholder="Where you work" />
	</div>

	<Label mix={[hstack({ gap: 2, align: "center" })]}>
		<input type="checkbox" name="digest" defaultChecked />
		Send me the weekly digest
	</Label>
</form>`;

/** A profile form's captions, hydrated so the page loads this example's chunk alone. */
export const LabelPreview = clientEntry(import.meta.url, function LabelPreview() {
	return () => (
		<form mix={[vstack({ gap: 5, align: "stretch" }), is("22rem")]}>
			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<Label htmlFor="preview-label-display-name">Display name</Label>
				<Input
					id="preview-label-display-name"
					name="displayName"
					defaultValue="Sergio"
					required
					aria-describedby="preview-label-display-name-hint"
				/>
				<Description id="preview-label-display-name-hint">
					Shown on every comment you leave.
				</Description>
			</div>

			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<Label htmlFor="preview-label-company" mix={[hstack({ gap: 2, justify: "between" })]}>
					Company
					<span mix={[text("xs"), fg("neutral.muted")]}>Optional</span>
				</Label>
				<Input id="preview-label-company" name="company" placeholder="Where you work" />
			</div>

			<Label mix={[hstack({ gap: 2, align: "center" })]}>
				<input type="checkbox" name="digest" defaultChecked />
				Send me the weekly digest
			</Label>
		</form>
	);
});

export default { code: CODE, render: () => <LabelPreview /> };
