/**
 * The shell every documentation page composes into: the site header kept on screen, the
 * tree on the left opened at the page being read, the page in the middle closed by where
 * to go next and its author's credit, and — where a page has one — its own headings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { relative } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { before, hover, when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";
import { Callout, DocsNav, DocsPager } from "@sdxc/ui";
import { DocsLayout as Shell } from "@sdxc/ui/patterns";
import { findNeighbours } from "@sdxc/ui/utils";

import type { Anchor } from "~/app/services/article";
import type { NavTree } from "~/app/services/navigation-tree";

import { pickSidebarAd } from "~/app/services/ads";
import { flattenNav, toDocsTree } from "~/app/services/navigation-tree";
import AuthorNote from "~/resources/components/author-note";
import DocsFeedbackBlock from "~/resources/components/docs-feedback-block";
import SidebarAd from "~/resources/components/sidebar-ad";
import SiteHeader from "~/resources/components/site-header";
import routes from "~/routes/web";

/** The site header's height, which the sticky columns and jumped-to headings sit below. */
const HEADER_HEIGHT = "4rem";

/**
 * A tree with more pages than this folds its groups to the ones holding the current page,
 * so a reader of the component catalogue meets a short list rather than every entry.
 */
const FOLD_THRESHOLD = 40;

/**
 * Pulls the sidebar's contact line from the footer's 0.625rem gutter onto the page links'
 * 0.5rem one, so its text starts where theirs does.
 */
const CONTACT_ALIGN = "-0.125rem";

namespace DocsLayout {
	export interface Props {
		tree: NavTree;
		/** The path being read, which marks one link in the tree as current and seeds the pager. */
		activePath: string;
		children: RemixNode;
		/**
		 * The page's own headings: a rail beside the prose where there is room, and a sticky
		 * "On this page" bar under the header where there is not. Too few draw neither.
		 */
		anchors?: Anchor[];
		/**
		 * Closes the page with "Was this page helpful?"; `sent` swaps it for the thank-you on
		 * the page a vote redirected back to. Index pages leave it out.
		 */
		feedback?: { sent: boolean };
	}
}

/**
 * Renders the header, the tree closed by a link to the contact form, and the page between
 * them. The pager stays inside the page's own section, so it follows the path a section was
 * written as rather than crossing into an unrelated one.
 */
export default function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let { activePath, anchors = [], children, feedback, tree } = handle.props;
		let docsTree = toDocsTree(tree);
		let { next, previous } = findNeighbours(docsTree, activePath, { boundary: "section" });
		let section = previous?.section ?? next?.section;
		let { ad } = pickSidebarAd(activePath);

		return (
			<Shell
				dock="md"
				stickyTop={HEADER_HEIGHT}
				header={<SiteHeader activePath={activePath} docs />}
				sidebar={
					<DocsNav
						tree={docsTree}
						activePath={activePath}
						collapseGroups={flattenNav(tree).length > FOLD_THRESHOLD}
						filter={{
							label: "Filter pages",
							placeholder: "Filter pages",
							noResults: "No page title matches. Try search instead.",
						}}
						footer={
							<p
								data-docs-contact=""
								mix={[
									m(0),
									raw({ marginInlineStart: CONTACT_ALIGN }),
									text("sm"),
									fg("neutral.muted"),
								]}
							>
								Can’t find it?{" "}
								<a
									href={routes.docs.contact.index.href()}
									mix={[fg("neutral.emphasis"), hover(fg("brand"))]}
								>
									Contact us
								</a>
							</p>
						}
					/>
				}
				toc={anchors}
				tocLabel="On this page"
				menuLabel="Menu"
				drawerLabel={tree.label}
				closeLabel="Close menu"
				railFooter={<SidebarAd ad={ad} />}
			>
				<div mix={[relative(), raw({ isolation: "isolate" }), gridBackdrop(), smoothJumps()]}>
					{feedback?.sent ? <FeedbackSent path={activePath} /> : null}
					{children}
					{feedback ? (
						<div mix={[raw({ marginBlockStart: "4rem" })]}>
							<DocsFeedbackBlock path={activePath} sent={feedback.sent} />
						</div>
					) : null}
					<DocsPager
						previous={previous}
						next={next}
						section={section}
						labels={{ nav: "Pagination", previous: "Previous", next: "Next" }}
						mix={[raw({ marginBlockStart: "4rem" })]}
					/>
					<AuthorNote />
				</div>
			</Shell>
		);
	};
}

namespace FeedbackSent {
	export interface Props {
		/** The page the vote was about, which the contact link carries along. */
		path: string;
	}
}

/**
 * The thank-you a vote returns to, at the top of the page: the vote reloads the page at its
 * top, so this is where the reader sees it answered, with the contact form one click away.
 */
function FeedbackSent(handle: Handle<FeedbackSent.Props>) {
	return () => (
		<Callout kind="tip" label="Feedback sent" mix={[raw({ marginBlockEnd: "1.5rem" })]}>
			Thanks for the feedback. Have a question it didn’t answer?{" "}
			<a
				href={`${routes.docs.contact.index.href()}?${new URLSearchParams({ page: handle.props.path })}`}
			>
				Contact us
			</a>
			.
		</Callout>
	);
}

/**
 * The faint grid the page opens over, fading out from the title's corner, so the top of
 * every docs page shares the landing's texture while the prose below reads on plain ground.
 */
function gridBackdrop() {
	return before(
		raw({
			content: '""',
			position: "absolute",
			insetBlockStart: "-2.5rem",
			insetInline: "calc(-1 * var(--docs-gutter, 1rem))",
			blockSize: "28rem",
			zIndex: -1,
			backgroundImage:
				"linear-gradient(to right, var(--ui-neutral-border) 1px, transparent 1px), linear-gradient(to bottom, var(--ui-neutral-border) 1px, transparent 1px)",
			backgroundSize: "3rem 3rem",
			opacity: 0.45,
			maskImage: "radial-gradient(70% 90% at 30% 0%, black, transparent 75%)",
			WebkitMaskImage: "radial-gradient(70% 90% at 30% 0%, black, transparent 75%)",
			pointerEvents: "none",
		}),
	);
}

/**
 * Glides the document to a heading picked from the rail or a `#` link, so the reader sees
 * which way the page moved; a reader who asked for reduced motion jumps straight there.
 */
function smoothJumps() {
	return media(
		"(prefers-reduced-motion: no-preference)",
		when(":root:has(&)", raw({ scrollBehavior: "smooth" })),
	);
}
