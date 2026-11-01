/**
 * The symptom page for a follow that answers with no feed: one section per cause, in the
 * order they are worth trying, each matched to the message Reader shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { UiLabel } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { H2 } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "no-feed", text: "“Nothing at that address publishes an RSS or Atom feed”", level: 2 },
	{ id: "unreachable", text: "“That address could not be reached”", level: 2 },
	{ id: "invalid", text: "“That is not an address this app can fetch”", level: 2 },
	{ id: "already", text: "“You already follow that feed”", level: 2 },
	{ id: "limit", text: "“Your plan follows … feeds”", level: 2 },
];

/** The no-feed symptom page's body. */
export default function NoFeedFound(_handle: Handle<DocBody.Props>) {
	return () => (
		<>
			<p>Find the message Reader showed under the follow box, then try what its section says.</p>

			<H2 id="no-feed">"Nothing at that address publishes an RSS or Atom feed"</H2>
			<p>
				The page you pasted neither is a feed nor points to one. Reader looks for the link a site
				puts in its pages to advertise its feed, and some sites leave it out.
			</p>
			<ul>
				<li>
					Look on the site for an <strong>RSS</strong>, <strong>Atom</strong> or{" "}
					<strong>Feed</strong> link, often in the footer, and paste that address instead.
				</li>
				<li>
					Try the site's home page rather than one article: the home page is where most sites
					advertise their feed.
				</li>
				<li>
					Try common addresses: the site followed by <code>/feed</code>, <code>/rss</code>,{" "}
					<code>/atom.xml</code> or <code>/index.xml</code>.
				</li>
			</ul>
			<p>Some sites publish no feed at all. Reader can only follow RSS and Atom.</p>

			<H2 id="unreachable">"That address could not be reached"</H2>
			<p>
				The site did not answer in time, or refused the request. Check the address opens in your
				browser, then try again in a moment.
			</p>

			<H2 id="invalid">"That is not an address this app can fetch"</H2>
			<p>
				Paste the whole address, starting with <code>https://</code> or <code>http://</code>.
			</p>

			<H2 id="already">"You already follow that feed"</H2>
			<p>
				The feed is already in your sidebar under <UiLabel>Feeds</UiLabel>, possibly under a folder,
				under <UiLabel>Pinned</UiLabel>, or under <UiLabel>Quiet</UiLabel> at the bottom.
			</p>

			<H2 id="limit">"Your plan follows … feeds"</H2>
			<p>You follow as many feeds as your plan allows. Unfollow one, or move up a plan.</p>
		</>
	);
}
