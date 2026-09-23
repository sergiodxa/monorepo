/**
 * Live preview island for `FieldError`. The element is a `<p>` with a stable id and a
 * `data-field-error` marker, and that marker is the whole contract: `validate()` finds the
 * slot through the field's own `aria-describedby`, writes the schema's message into it, and
 * unhides it. It stays quiet until the browser first reports the field invalid — pressing
 * Save is what does that — and from then on it tracks every keystroke.
 *
 * The second field carries a message the server produced instead, which is the same
 * element with its text rendered rather than written in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, Description, FieldError, Input, Label } from "@sdxc/ui";
import { validate } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/ui";

import { CustomDomain } from "~/app/services/preview-form-schemas";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const FIELD_ERROR_CODE = `<form>
	<Label htmlFor="domain">Custom domain</Label>
	<Input
		id="domain"
		name="domain"
		defaultValue="https://app.acme"
		required
		aria-describedby="domain-hint domain-error"
		mix={[validate(CustomDomain)]}
	/>
	<Description id="domain-hint">
		Point a CNAME at edge.acme-hosting.com before you save this.
	</Description>
	<FieldError id="domain-error" hidden />

	<Label htmlFor="subdomain">Workspace subdomain</Label>
	<Input
		id="subdomain"
		name="subdomain"
		defaultValue="acme"
		aria-invalid="true"
		aria-describedby="subdomain-error"
	/>
	<FieldError id="subdomain-error">That subdomain is already taken.</FieldError>

	<Button type="submit">Save domains</Button>
</form>`;

/** Two invalid fields, hydrated so the first one's message comes from the schema. */
export const FieldErrorPreview = clientEntry(
	"/resources/components/previews/field-error.tsx#FieldErrorPreview",
	function FieldErrorPreview() {
		return () => (
			<form mix={[vstack({ gap: 5, align: "stretch" }), is("24rem")]}>
				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Label htmlFor="preview-domain">Custom domain</Label>
					<Input
						id="preview-domain"
						name="domain"
						defaultValue="https://app.acme"
						required
						aria-describedby="preview-domain-hint preview-domain-error"
						mix={[validate(CustomDomain)]}
					/>
					<Description id="preview-domain-hint">
						Point a CNAME at edge.acme-hosting.com before you save this.
					</Description>
					<FieldError id="preview-domain-error" hidden />
				</div>

				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Label htmlFor="preview-subdomain">Workspace subdomain</Label>
					<Input
						id="preview-subdomain"
						name="subdomain"
						defaultValue="acme"
						aria-invalid="true"
						aria-describedby="preview-subdomain-error"
					/>
					<FieldError id="preview-subdomain-error">That subdomain is already taken.</FieldError>
				</div>

				<Button type="submit">Save domains</Button>
			</form>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: FIELD_ERROR_CODE, render: () => <FieldErrorPreview /> };
