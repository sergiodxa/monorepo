/**
 * Live example island for a small ghost `ToggleButton`, the shape a formatting toolbar uses.
 * A `<button>` keeps no pressed state of its own, so `pressToggle()` flips `aria-pressed` on
 * each click and the island hydrates for that mixin to run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BoldIcon } from "@sdxc/icons";
import { ToggleButton } from "@sdxc/ui";
import { pressToggle } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<ToggleButton
	aria-pressed="false"
	variant="ghost"
	size="sm"
	aria-label="Bold"
	mix={[pressToggle()]}
>
	<BoldIcon />
</ToggleButton>`;

/** A bold toggle, hydrated so each click flips its pressed state. */
export const BoldToggle = clientEntry(import.meta.url, function BoldToggle() {
	return () => (
		<ToggleButton
			aria-pressed="false"
			variant="ghost"
			size="sm"
			aria-label="Bold"
			mix={[pressToggle()]}
		>
			<BoldIcon />
		</ToggleButton>
	);
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Ghost, small",
	code: CODE,
	render: () => <BoldToggle />,
};
