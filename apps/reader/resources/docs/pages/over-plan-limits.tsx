/**
 * The symptom page for a reader over their plan's numbers, after a downgrade, a lapse or
 * a limit change: what is kept, what pauses, and the two ways back inside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { H2 } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "kept", text: "What stays", level: 2 },
	{ id: "paused", text: "What pauses", level: 2 },
	{ id: "back", text: "Get back inside your plan", level: 2 },
];

/** The over-limits symptom page's body. */
export default function OverPlanLimits(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<p>
					You can be over your plan after moving to a smaller one, or when a payment lapses past its{" "}
					{figures.graceDays} days. <UiPath items={["Settings", "Your plan"]} /> then shows{" "}
					<UiLabel>Over your plan</UiLabel> and says by how much.
				</p>

				<H2 id="kept">What stays</H2>
				<Callout kind="note" label="Note">
					<p>
						Nothing has been deleted, and nothing will be. Everything you follow and kept stays.
					</p>
				</Callout>

				<H2 id="paused">What pauses</H2>
				<ul>
					<li>Following new feeds, while you follow more than your plan allows.</li>
					<li>Saving new posts, while you have saved more than your plan keeps.</li>
					<li>New pins and saved searches, past your plan's numbers.</li>
					<li>Filters past your plan's number stop running; on Free, all filters stop.</li>
					<li>
						Posts, past the number your plan keeps: Reader first makes room by taking back posts you
						have read and not saved, oldest first. When there are none left, new posts wait.
					</li>
				</ul>

				<H2 id="back">Get back inside your plan</H2>
				<p>Either way works, and you can mix them:</p>
				<ul>
					<li>
						Unfollow feeds or remove saved posts until Settings no longer shows{" "}
						<UiLabel>Over your plan</UiLabel>.
					</li>
					<li>
						Move up a plan from <UiLabel>Your plan</UiLabel>. See{" "}
						<a href={docHref("plans")}>Plans and limits</a>.
					</li>
				</ul>
			</>
		);
	};
}
