/**
 * The quickstart: from signing in to reading a first post, with the queue shown as it
 * looks once a few feeds are followed. It is the hub's first route for a new reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { QueueView, ReaderWindow } from "~/resources/components/marketing/reader-window";
import { H2, Kbd, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "sign-in", text: "Sign in", level: 2 },
	{ id: "follow", text: "Follow your first feed", level: 2 },
	{ id: "read", text: "Read a post", level: 2 },
	{ id: "phone", text: "Read on your phone", level: 2 },
];

/** The quickstart's body. */
export default function GettingStarted(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<p>
					Reader keeps one list of every post from every site you follow, newest first. Signing in
					is free, and Free follows up to {figures.freeFeeds} feeds.
				</p>

				<H2 id="sign-in">Sign in</H2>
				<Steps>
					<Steps.Item title="Open Reader and press Sign in">
						<p>
							Press <UiLabel>Sign in</UiLabel> at the top of the home page. Reader signs you in
							through <strong>auth.sergiodxa.com</strong>; the first time, follow its steps to make
							your account.
						</p>
					</Steps.Item>
					<Steps.Item title="Land on Reading">
						<p>
							Once you are signed in you arrive at <UiLabel>Reading</UiLabel>, your queue. It is
							empty until you follow something.
						</p>
					</Steps.Item>
				</Steps>

				<H2 id="follow">Follow your first feed</H2>
				<Steps>
					<Steps.Item title="Paste an address">
						<p>
							Paste a site's address into <UiLabel>Follow a feed or site…</UiLabel> at the top of
							Reading and press Enter. A feed's own address works, and so does the address of a site
							that advertises one, like a blog's home page.
						</p>
					</Steps.Item>
					<Steps.Item title="Get its older posts too">
						<p>
							When the feed publishes its archive, Reader also fetches its older posts: up to{" "}
							{figures.historyPosts} of them from up to {figures.historyPages} archive pages, behind
							the follow.
						</p>
					</Steps.Item>
				</Steps>

				<Callout kind="tip" label="Tip">
					<p>
						Coming from another reader? Import everything at once from an OPML file instead:{" "}
						<a href={docHref("import-opml")}>Import from another reader</a>.
					</p>
				</Callout>

				<H2 id="read">Read a post</H2>
				<p>
					Your queue lists every post newest first. Press a post's title to open it on the
					publisher's site, which also marks it read, or press <UiLabel>Read here</UiLabel> to read
					it inside Reader. From the keyboard, <Kbd>j</Kbd> and <Kbd>k</Kbd> move between posts and{" "}
					<Kbd>o</Kbd> opens one.
				</p>
				<Scene caption="The queue, set to Unread, with the posts from every feed you follow, newest first.">
					<ReaderWindow
						t={t}
						title={t("nav.reading")}
						path="/reading"
						label="Reader's queue showing posts from several feeds"
					>
						<QueueView t={t} waiting={0} />
					</ReaderWindow>
				</Scene>
				<p>
					To keep a post for later, press <UiLabel>Save</UiLabel> on it; it then stays on{" "}
					<UiPath items={["Saved"]} /> whatever happens to the feed.
				</p>

				<H2 id="phone">Read on your phone</H2>
				<p>
					Reader is a web app built for phones too. Open it in your phone's browser and add it to
					your home screen. On a phone, swipe a post's row sideways to mark it read.
				</p>
			</>
		);
	};
}
