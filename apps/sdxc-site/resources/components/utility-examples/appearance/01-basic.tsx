/**
 * The opening `appearance` example: a checkbox built from scratch, where with the
 * native box gone the control is a plain square that a border and a checked state paint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { appearance, hstack } from "sdxc/u/layout";
import { bs, is, m } from "sdxc/u/size";
import { checked } from "sdxc/u/state";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Checkboxes drawn by the page after `appearance()` clears the native box. */
export default {
	title: "Basic example",
	description:
		"Clear a checkbox's native look with `appearance()` and draw your own, then paint the checked state. Click the boxes to toggle them:",
	render: () => (
		<div mix={[demo.stack()]}>
			<label mix={[hstack({ gap: 2, align: "center" }), text("sm")]}>
				<input
					type="checkbox"
					checked
					mix={[
						appearance(),
						is(5),
						bs(5),
						m(0),
						rounded("sm"),
						border({ color: "brand.strong", width: 2, style: "solid" }),
						checked(bg("brand.solid")),
					]}
				/>
				Email me about replies
			</label>
			<label mix={[hstack({ gap: 2, align: "center" }), text("sm")]}>
				<input
					type="checkbox"
					mix={[
						appearance(),
						is(5),
						bs(5),
						m(0),
						rounded("sm"),
						border({ color: "brand.strong", width: 2, style: "solid" }),
						checked(bg("brand.solid")),
					]}
				/>
				Email me about mentions
			</label>
		</div>
	),
} satisfies UtilityExampleModule;
