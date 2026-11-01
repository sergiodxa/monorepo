/**
 * Live preview for `OptimisticToggle`: a support inbox where each conversation can be
 * starred and marked read. Each toggle flips the moment it is pressed and posts in the
 * background; a refused post flips it back, in the danger tone, with "Failed" beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CircleCheckIcon, CircleIcon, StarIcon } from "@sdxc/icons";
import { border, fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { divide } from "@sdxc/u/overflow";
import { is, m, minIs, p } from "@sdxc/u/size";
import { text, truncate, weight } from "@sdxc/u/typography";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";

/** The inbox's conversations, each posting to the example endpoint. */
const CONVERSATIONS = [
	{
		id: "4821",
		from: "Ana Ruiz",
		subject: "Status page shows the wrong time zone",
		starred: true,
		read: false,
	},
	{
		id: "4819",
		from: "Kenji Mori",
		subject: "Can we pause checks during a deploy?",
		starred: false,
		read: true,
	},
	{
		id: "4817",
		from: "Lea Novak",
		subject: "Webhook retries look duplicated",
		starred: false,
		read: false,
	},
];

/** The source the page shows, for one row. */
const CODE = `<OptimisticToggle
	action={\`/inbox/\${conversation.id}/star\`}
	name="starred"
	pressed={conversation.starred}
	fields={{ returnTo: "/inbox" }}
	labels={{ label: "Star", failed: "Failed" }}
	pressedContent={<StarIcon size={16} fill="currentColor" aria-hidden="true" />}
	unpressedContent={<StarIcon size={16} aria-hidden="true" />}
/>
<OptimisticToggle
	action={\`/inbox/\${conversation.id}/read\`}
	name="read"
	pressed={conversation.read}
	fields={{ returnTo: "/inbox" }}
	labels={{ label: "Read", failed: "Failed" }}
	pressedContent={<CircleCheckIcon size={16} aria-hidden="true" />}
	unpressedContent={<CircleIcon size={16} aria-hidden="true" />}
/>

// The action answers the background post with 204, and a plain form post with a redirect:
if (ctx.request.headers.get("x-optimistic-toggle")) return new Response(null, { status: 204 });
return redirect(returnTo, 303);`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<ul
			mix={[
				vstack({ gap: 0, align: "stretch" }),
				is("100%"),
				m(0),
				p(0),
				listStyle(),
				border({ color: "neutral", width: 1 }),
				divide("block", "neutral"),
			]}
		>
			{CONVERSATIONS.map((conversation) => (
				<li mix={[hstack({ gap: 2, align: "center" }), p(2, 3)]}>
					<OptimisticToggle
						action={`/examples/inbox/${conversation.id}/star`}
						name="starred"
						pressed={conversation.starred}
						fields={{ returnTo: "/examples/inbox" }}
						labels={{ label: "Star", failed: "Failed" }}
						pressedContent={<StarIcon size={16} fill="currentColor" aria-hidden="true" />}
						unpressedContent={<StarIcon size={16} aria-hidden="true" />}
					/>
					<OptimisticToggle
						action={`/examples/inbox/${conversation.id}/read`}
						name="read"
						pressed={conversation.read}
						fields={{ returnTo: "/examples/inbox" }}
						labels={{ label: "Read", failed: "Failed" }}
						pressedContent={<CircleCheckIcon size={16} aria-hidden="true" />}
						unpressedContent={<CircleIcon size={16} aria-hidden="true" />}
					/>
					<span mix={[vstack({ gap: 0, align: "stretch" }), minIs(0), text("sm")]}>
						<span mix={[weight(conversation.read ? "normal" : "semibold"), fg("neutral.emphasis")]}>
							{conversation.from}
						</span>
						<span mix={[truncate(), fg("neutral.muted")]}>{conversation.subject}</span>
					</span>
				</li>
			))}
		</ul>
	),
};
