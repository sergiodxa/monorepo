/**
 * An `if` example driven by data: an inbox whose unread messages are set in bold, each
 * row deciding from its own record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import * as u from "sdxc/u/general";
import { hstack } from "sdxc/u/layout";
import { maxIs } from "sdxc/u/size";
import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Message rows set in bold only when unread. */
export default {
	title: "Styling from data",
	description:
		'Conditions can read each record, like `u.if(message.unread, weight("semibold"))` to set unread messages in bold:',
	render: () => (
		<ul mix={[maxIs(96), demo.card()]}>
			{[
				{ from: "Priya", subject: "Venue confirmed for the offsite", unread: true },
				{ from: "Marco", subject: "Re: invoice 2041", unread: false },
				{ from: "Lena", subject: "Draft of the launch post", unread: true },
			].map((message) => (
				<li
					mix={[hstack({ gap: 3, justify: "between" }), u.if(message.unread, weight("semibold"))]}
				>
					<span>{message.subject}</span>
					<span mix={[text("sm"), fg("neutral.muted")]}>{message.from}</span>
				</li>
			))}
		</ul>
	),
} satisfies UtilityExampleModule;
