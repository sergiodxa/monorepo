/**
 * Live example island for a `Switch` carrying `ariaChecked()`. The mixin keeps
 * `aria-checked` following the control's live checkedness from the browser, so the
 * example hydrates for the attribute to change as the switch is flipped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Switch } from "@sdxc/ui";
import { ariaChecked } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<Switch aria-label="Push notifications" name="push" mix={[ariaChecked()]} />`;

/** A switch whose `aria-checked` follows its live state, hydrated so the mixin runs. */
export const AnnouncedStateSwitch = clientEntry(import.meta.url, function AnnouncedStateSwitch() {
	return () => <Switch aria-label="Push notifications" name="push" mix={[ariaChecked()]} />;
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Announced state",
	code: CODE,
	render: () => <AnnouncedStateSwitch />,
};
