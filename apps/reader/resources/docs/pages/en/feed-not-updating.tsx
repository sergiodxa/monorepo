/**
 * The symptom page for a feed that seems stuck: reading the feed page's last check,
 * checking it on demand, and telling a quiet feed apart from a failing one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { UiLabel } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { FactTable, H2 } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "look", text: "Read the feed's last check", level: 2 },
	{ id: "check", text: "Check it now", level: 2 },
	{ id: "failing", text: "If its checks are failing", level: 2 },
	{ id: "quiet", text: "If the site has gone quiet", level: 2 },
	{ id: "span", text: "If posts arrive and then disappear", level: 2 },
];

/** The stuck-feed symptom page's body. */
export default function FeedNotUpdating(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<H2 id="look">Read the feed's last check</H2>
				<p>
					Open the feed under <UiLabel>Feeds</UiLabel> in the sidebar. Its header says when it was
					last checked, and, when checks are failing, how many failed in a row and why.
				</p>

				<H2 id="check">Check it now</H2>
				<p>
					Press <UiLabel>Check feed</UiLabel>. Reader fetches it on the spot and says whether new
					posts arrived, nothing was new, or the feed could not be reached. On Reading,{" "}
					<UiLabel>Check all</UiLabel> does the same for every feed.
				</p>

				<H2 id="failing">If its checks are failing</H2>
				<FactTable
					caption="What a failing feed's badge says, and what to do."
					head={["The badge says", "What to do"]}
					rows={[
						[
							"The site answered with an error",
							"The site is having trouble or moved its feed. Open the site; if the feed moved, follow its new address and unfollow the old one.",
						],
						[
							"The site could not be reached",
							"The site is down or slow. Reader backs off and tries again; nothing for you to do.",
						],
						[
							"The feed could not be read",
							"The site sent something that is not a valid feed. If it lasts, look on the site for a new feed address and follow that.",
						],
					]}
				/>

				<H2 id="quiet">If the site has gone quiet</H2>
				<p>
					A feed is checked as often as it publishes, from every {figures.pollFloor} for a busy one
					to weekly once it has been silent for a month. A feed with nothing new moves to{" "}
					<UiLabel>Quiet</UiLabel> at the bottom of the sidebar. That is the site resting, not
					Reader failing.
				</p>

				<H2 id="span">If posts arrive and then disappear</H2>
				<p>
					The feed's span may be short: under Breaking, posts leave after three hours, read or not.
					Choose a longer one in <UiLabel>How long these posts stay</UiLabel>, or save the posts you
					want to keep. See <a href={docHref("feeds")}>Follow and manage feeds</a>.
				</p>
			</>
		);
	};
}
