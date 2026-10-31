/**
 * Everything a reader does to one feed: following it, checking it on demand, choosing how
 * long its posts stay, keeping its links as published, and unfollowing it. It also says
 * how often a feed is checked, since that is the first question about a quiet one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { CadenceScene } from "~/resources/components/marketing/scenes";
import { FactTable, H2, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "follow", text: "Follow a feed", level: 2 },
	{ id: "feed-page", text: "A feed's page", level: 2 },
	{ id: "checks", text: "How often feeds are checked", level: 2 },
	{ id: "span", text: "How long posts stay", level: 2 },
	{ id: "links", text: "Keep link parameters", level: 2 },
	{ id: "unfollow", text: "Unfollow a feed", level: 2 },
];

/** The feeds guide's body. */
export default function Feeds(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<H2 id="follow">Follow a feed</H2>
				<p>
					Paste an address into <UiLabel>Follow a feed or site…</UiLabel> at the top of Reading. Any
					RSS or Atom feed works, and so does a site that advertises one. Your plan sets how many
					you follow: {figures.freeFeeds} on Free, {figures.paidFeeds} on Paid and{" "}
					{figures.premiumFeeds} on Premium.
				</p>

				<H2 id="feed-page">A feed's page</H2>
				<p>
					Pick a feed under <UiLabel>Feeds</UiLabel> in the sidebar to see only its posts. Its
					header says when it was last checked and, if checks are failing, why. Two buttons sit
					there: <UiLabel>Check feed</UiLabel> and <UiLabel>Mark feed read</UiLabel>. Everything
					else is under <UiLabel>More actions</UiLabel>:
				</p>
				<ul>
					<li>
						<UiLabel>Pin</UiLabel>: see <a href={docHref("pins")}>Pin feeds above your queue</a>.
					</li>
					<li>
						<UiLabel>Notify me about this feed</UiLabel>: see{" "}
						<a href={docHref("notifications")}>Get notified about new posts</a>.
					</li>
					<li>
						<UiLabel>Keep link parameters</UiLabel>, below.
					</li>
					<li>
						<UiLabel>How long these posts stay</UiLabel>, below.
					</li>
					<li>
						<UiLabel>Which folder this feed reads in</UiLabel>: see{" "}
						<a href={docHref("folders")}>Group feeds into folders</a>.
					</li>
					<li>
						<UiLabel>Unfollow</UiLabel>, below.
					</li>
				</ul>

				<H2 id="checks">How often feeds are checked</H2>
				<p>
					Each feed is checked as often as it publishes: every {figures.pollFloor} for a feed
					posting ten times a day, daily for a quiet one, and weekly once it has been silent for a
					month. A feed that publishes almost nothing moves to the <UiLabel>Quiet</UiLabel> group at
					the bottom of the sidebar.
				</p>
				<Scene caption="A busy feed is checked every few minutes, a quiet one daily, a silent one weekly.">
					<CadenceScene t={t} />
				</Scene>
				<p>
					To look sooner, press <UiLabel>Check feed</UiLabel> on its page, or{" "}
					<UiLabel>Check all</UiLabel> on Reading.
				</p>

				<H2 id="span">How long posts stay</H2>
				<p>
					Open <UiPath items={["More actions", "How long these posts stay"]} /> and pick a span.
					Older posts leave your queue, read or not. Saved posts always stay. A new feed keeps its
					posts forever until you choose otherwise.
				</p>
				<FactTable
					caption="The spans a feed can keep its posts for."
					head={["Span", "Posts stay for"]}
					rows={[
						["Breaking", "3 hours"],
						["News", "18 hours"],
						["Articles", "3 days"],
						["Essays", "2 weeks"],
						["Evergreen", "Forever"],
					]}
				/>
				<p>
					When a busy feed keeps everything, its page suggests a shorter span so it doesn't become a
					backlog.
				</p>

				<H2 id="links">Keep link parameters</H2>
				<p>
					Reader removes tracking parameters from the links a feed gives. If a site's links break
					without them, choose <UiPath items={["More actions", "Keep link parameters"]} /> and the
					links open exactly as published. <UiLabel>Strip link parameters</UiLabel> turns the
					cleaning back on.
				</p>

				<H2 id="unfollow">Unfollow a feed</H2>
				<p>
					Choose <UiPath items={["More actions", "Unfollow"]} /> and confirm.
				</p>
				<Callout kind="warning" label="Warning">
					<p>
						Unfollowing takes the feed's posts with it, and what you have read of them. Saved posts
						stay.
					</p>
				</Callout>
			</>
		);
	};
}
