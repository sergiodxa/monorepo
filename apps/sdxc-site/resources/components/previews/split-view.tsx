/**
 * Live preview for `SplitView`: a support inbox with folders, conversations and the open
 * conversation side by side. Narrow the frame to watch the folders become a sheet and,
 * below 48rem, the conversation take the screen with a link back to the list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArchiveIcon, InboxIcon, SendIcon, StarIcon } from "@sdxc/icons";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { contain, grow, hstack, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, m, p, pb, pi } from "@sdxc/u/size";
import { aria } from "@sdxc/u/state";
import { text, truncate, weight } from "@sdxc/u/typography";
import { SPLIT_VIEW_ITEM_ATTRIBUTE, SplitView, SplitViewToggle } from "@sdxc/ui/app/split-view";

/** The source the page shows, matching the markup below. */
const CODE = `<SplitView
	id="inbox"
	sidebar={<FolderNav />}
	rail={<FolderIcons />}
	list={<ConversationList />}
	detail={selected ? <Conversation id={selected} /> : null}
	empty={<p>Pick a conversation to read it here.</p>}
	backHref="/inbox"
	layout={readSplitViewLayout(request.headers.get("Cookie"))}
	labels={{ resizeSidebar: "Resize folders", resizeList: "Resize conversations", back: "Inbox" }}
/>

// each conversation link in the list
<a href="/inbox?c=42" data-split-view-item aria-current={selected === 42 ? "page" : undefined}>…</a>`;

/** The inbox's folders, with their unread counts. */
const FOLDERS = [
	{ name: "Inbox", count: 12, icon: InboxIcon },
	{ name: "Starred", count: 3, icon: StarIcon },
	{ name: "Sent", count: 0, icon: SendIcon },
	{ name: "Archive", count: 0, icon: ArchiveIcon },
];

/** The conversations in the inbox, newest first. */
const CONVERSATIONS = [
	{ id: 1, from: "Maya Chen", subject: "Invoice shows the wrong seat count", at: "9:41" },
	{ id: 2, from: "Leo Martins", subject: "Can we move to yearly billing?", at: "9:12" },
	{ id: 3, from: "Priya Nair", subject: "SSO login loops back to the start", at: "Yesterday" },
	{ id: 4, from: "Tom Becker", subject: "Export to CSV drops the last row", at: "Yesterday" },
	{ id: 5, from: "Aiko Tanaka", subject: "Feature request: Slack digest", at: "Mon" },
	{ id: 6, from: "Sam Okafor", subject: "Thanks for the quick fix!", at: "Mon" },
];

/** The open conversation. */
const SELECTED = 3;

/** The folder list the sidebar shows, with a toggle that collapses it to its rail. */
function FolderNav() {
	return () => (
		<nav aria-label="Folders" mix={[vstack({ gap: 1 }), p(2)]}>
			<div mix={[hstack({ gap: 2, align: "center", justify: "between" }), pi(2), pb(1)]}>
				<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Support</span>
				<SplitViewToggle viewId="preview-inbox" pane="sidebar" label="Toggle folders" />
			</div>
			{FOLDERS.map((folder) => (
				<a
					key={folder.name}
					href={`#folder-${folder.name.toLowerCase()}`}
					aria-current={folder.name === "Inbox" ? "page" : undefined}
					mix={[
						hstack({ gap: 2, align: "center" }),
						pi(2),
						bs("2rem"),
						rounded("md"),
						text("sm"),
						fg(),
						aria("current", "page", bg("neutral.tint")),
					]}
				>
					<folder.icon size={16} aria-hidden="true" />
					<span mix={[grow()]}>{folder.name}</span>
					{folder.count > 0 ? (
						<span mix={[text("xs"), fg("neutral.muted")]}>{folder.count}</span>
					) : null}
				</a>
			))}
		</nav>
	);
}

/** The folder icons the collapsed sidebar shows as its rail. */
function FolderIcons() {
	return () => (
		<nav aria-label="Folders" mix={[vstack({ gap: 1, align: "center" }), pb(2)]}>
			<SplitViewToggle viewId="preview-inbox" pane="sidebar" label="Toggle folders" collapsed />
			{FOLDERS.map((folder) => (
				<a
					key={folder.name}
					href={`#folder-${folder.name.toLowerCase()}`}
					aria-label={folder.name}
					title={folder.name}
					mix={[hstack({ align: "center", justify: "center" }), is("2rem"), bs("2rem"), fg()]}
				>
					<folder.icon size={16} aria-hidden="true" />
				</a>
			))}
		</nav>
	);
}

/** The conversation list: each row a link the j/k keys step through. */
function ConversationList() {
	return () => (
		<ul mix={[m(0), p(0), listStyle("none")]}>
			{CONVERSATIONS.map((conversation) => (
				<li key={conversation.id} mix={[borderEdge("bottom", { width: 1, color: "neutral" })]}>
					<a
						href={`#conversation-${conversation.id}`}
						{...{ [SPLIT_VIEW_ITEM_ATTRIBUTE]: "" }}
						aria-current={conversation.id === SELECTED ? "page" : undefined}
						mix={[
							vstack({ gap: 0.5 }),
							pi(3),
							pb(2.5),
							fg(),
							aria("current", "page", bg("neutral.tint")),
						]}
					>
						<span mix={[hstack({ gap: 2, justify: "between" }), text("sm")]}>
							<span mix={[weight("semibold"), truncate()]}>{conversation.from}</span>
							<span mix={[text("xs"), fg("neutral.muted")]}>{conversation.at}</span>
						</span>
						<span mix={[text("sm"), fg("neutral.muted"), truncate()]}>{conversation.subject}</span>
					</a>
				</li>
			))}
		</ul>
	);
}

/** The open conversation: its subject and the first message. */
function Conversation() {
	return () => (
		<article mix={[vstack({ gap: 3 }), p(5)]}>
			<h2 mix={[m(0), text("lg"), weight("semibold")]}>SSO login loops back to the start</h2>
			<p mix={[m(0), text("sm"), fg("neutral.muted")]}>Priya Nair · Yesterday at 16:20</p>
			<p mix={[m(0), text("sm")]}>
				After the Okta change this morning, signing in with SSO sends our team back to the login
				page. Password sign-in still works. Could you check the redirect URL on your side?
			</p>
		</article>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	flush: true,
	viewports: true,
	render: () => (
		<div
			mix={[
				is("full"),
				bs("32rem"),
				contain("layout paint"),
				overflow("hidden"),
				rounded("lg"),
				border({ color: "neutral.border", width: 1 }),
				bg(),
			]}
		>
			<SplitView
				id="preview-inbox"
				sidebar={<FolderNav />}
				rail={<FolderIcons />}
				list={<ConversationList />}
				detail={<Conversation />}
				empty={<p>Pick a conversation to read it here.</p>}
				backHref="#preview-inbox"
				cookie="ui-split-view-preview"
				keys="view"
				labels={{
					resizeSidebar: "Resize folders",
					resizeList: "Resize conversations",
					back: "Inbox",
				}}
			/>
		</div>
	),
};
