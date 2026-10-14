/**
 * The opening `readOnly` example: an editable and a read-only field side by side, the
 * read-only one flattened into the page, so the reader tries typing in both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { cursor } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { readOnly } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A transparent background and border, and muted text, on the field the user can select but not edit. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `readOnly()` to style a field that can be focused and copied but not edited. Try typing in both fields:",
	render: () => (
		<div mix={[demo.stack()]}>
			<label mix={[vstack({ gap: 1 }), text("sm"), weight("medium")]}>
				Display name
				<input
					type="text"
					value="Ada Lovelace"
					mix={[
						border("neutral.border"),
						readOnly([
							bg("transparent"),
							border("transparent"),
							fg("neutral.muted"),
							cursor("default"),
						]),
						demo.input(),
					]}
				/>
			</label>
			<label mix={[vstack({ gap: 1 }), text("sm"), weight("medium")]}>
				Account ID
				<input
					type="text"
					value="acct_7f3a91"
					readonly
					mix={[
						border("neutral.border"),
						readOnly([
							bg("transparent"),
							border("transparent"),
							fg("neutral.muted"),
							cursor("default"),
						]),
						demo.input(),
					]}
				/>
			</label>
		</div>
	),
} satisfies UtilityExampleModule;
