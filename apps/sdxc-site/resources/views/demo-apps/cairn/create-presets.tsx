/**
 * Client island: presets the create dialog from the button that opens it, so a board column's
 * + starts the new issue in that column's status. Without script the dialog still opens, with
 * every field at its default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { invokerFields } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** Renders a hidden marker carrying the dialog's presets. */
export const CreatePresets: EntryComponent<Record<never, never>> = clientEntry(
	import.meta.url,
	function CreatePresets() {
		return () => <span mix={[hidden(), invokerFields()]} />;
	},
);
