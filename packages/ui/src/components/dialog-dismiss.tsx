/**
 * Client island that closes the modal `<dialog>` it renders inside on a backdrop press or a
 * followed link, for a navigation sheet or drawer whose links include same-page anchors.
 * It owns no visible markup, so it drops into any dialog's content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { clientEntry } from "remix/component";

import { dialogDismiss } from "../mixins/dialog-dismiss.js";

/**
 * Renders a hidden marker carrying {@link dialogDismiss}. The island loads from the bare
 * `@sdxc/ui/dialog-dismiss` specifier, which the app's browser entry maps to a dynamic
 * import. A page restored from the back-forward cache returns with the dialog closed.
 *
 * @example
 * <SiteHeader brand={<Logo />} items={items} sheet={<DialogDismiss />} />
 */
export const DialogDismiss: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/dialog-dismiss#DialogDismiss",
	function DialogDismiss() {
		return () => <span mix={[hidden(), dialogDismiss()]} />;
	},
);
