/**
 * Live example for a `SearchField` with no visible caption. The `aria-label` on the field
 * names the search landmark and the one on the input names the control itself, so both
 * are announced and the example is plain markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { SearchField } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<SearchField aria-label="Search the Acme docs">
	<SearchField.Input name="q" aria-label="Search the Acme docs" placeholder="Billing, webhooks, SSO…" />
</SearchField>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Without a visible label",
	code: CODE,
	render: () => (
		<SearchField aria-label="Search the Acme docs">
			<SearchField.Input
				name="q"
				aria-label="Search the Acme docs"
				placeholder="Billing, webhooks, SSO…"
			/>
		</SearchField>
	),
};
