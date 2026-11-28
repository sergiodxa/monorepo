/**
 * Understory's pages, drawn as a garden: every view the blog's controller builds, inside the
 * blog's frame. The feed, a post and the browsing pages live in their own modules; the about,
 * newsletter and not-found pages are small enough to live here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CheckIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { pretty, text, weight } from "@sdxc/u/typography";
import { Avatar, Typeset } from "@sdxc/ui";

import type { DemoBlogContext, DemoBlogView } from "~/resources/views/demo-blogs";

import { ARCHIVE_PAGE, FEED_PAGE, SUBSCRIBE_PAGE, TAGS_PAGE } from "~/resources/views/demo-blogs";
import { NewsletterForm } from "~/resources/views/demo-blogs/parts";
import {
	ArchivePage,
	SearchForm,
	SearchPage,
	TagPage,
	TagsPage,
} from "~/resources/views/demo-blogs/understory/browse";
import { FeedPage } from "~/resources/views/demo-blogs/understory/feed";
import { UnderstoryShell } from "~/resources/views/demo-blogs/understory/frame";
import {
	CardGrid,
	GardenCard,
	labelFace,
	PageIntro,
	quietLink,
	SectionTitle,
	tinted,
	Wrap,
} from "~/resources/views/demo-blogs/understory/parts";
import { PostPage } from "~/resources/views/demo-blogs/understory/post";

/** The evergreen posts a lost visitor is offered, by path. */
const LOST_PICKS = [
	"articles/the-server-is-a-peer",
	"tutorials/sync-from-scratch-change-log",
	"glossary/crdt",
];

namespace UnderstoryPage {
	export interface Props {
		view: DemoBlogView;
		context: DemoBlogContext;
	}
}

/** Draws whichever page the controller asked for, inside the blog's frame. */
export function UnderstoryPage(handle: Handle<UnderstoryPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let current = iife(() => {
			if (view.view === "feed" && view.type !== null) return `?type=${view.type}`;
			if (view.view === "post") return `?type=${view.article.post.kind}`;
			if (view.view === "tags" || view.view === "tag") return TAGS_PAGE;
			if (view.view === "archive") return ARCHIVE_PAGE;
			if (view.view === "about") return "about";
			return undefined;
		});
		return (
			<UnderstoryShell context={context} current={current}>
				{iife(() => {
					if (view.view === "feed") return <FeedPage view={view} context={context} />;
					if (view.view === "post") return <PostPage view={view} context={context} />;
					if (view.view === "archive") {
						return <ArchivePage context={context} posts={view.posts} type={view.type} />;
					}
					if (view.view === "tags") return <TagsPage context={context} tags={view.tags} />;
					if (view.view === "tag") {
						return <TagPage context={context} tag={view.tag} posts={view.posts} />;
					}
					if (view.view === "search") {
						return (
							<SearchPage
								context={context}
								query={view.query}
								type={view.type}
								matches={view.matches}
								results={view.results}
							/>
						);
					}
					if (view.view === "about") return <AboutPage context={context} />;
					if (view.view === "subscribe")
						return <SubscribePage context={context} sent={view.sent} />;
					return <NotFoundPage context={context} path={view.path} />;
				})}
			</UnderstoryShell>
		);
	};
}

namespace AboutPage {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** Who tends the garden: a portrait card beside the about prose. */
function AboutPage(handle: Handle<AboutPage.Props>) {
	return () => {
		let { context } = handle.props;
		let { href, site } = context;
		return (
			<Wrap max="64rem">
				<PageIntro
					eyebrow="About"
					title={`Hello, I'm ${site.author.name.split(" ")[0]}.`}
					lead={site.author.role}
				/>
				<div
					mix={[
						raw({ display: "grid", gap: "2.5rem", gridTemplateColumns: "minmax(0, 1fr)" }),
						media("(min-width: 52rem)", raw({ gridTemplateColumns: "minmax(0, 1fr) 16rem" })),
					]}
				>
					<Typeset
						preset="reading"
						mix={[m(0), raw({ fontFamily: "var(--demo-blog-reading-font)" })]}
					>
						{site.about()}
					</Typeset>
					<aside
						aria-label="Elsewhere"
						data-slot="understory-about-card"
						mix={[
							tinted(140),
							p(5),
							vstack({ gap: 3, align: "start" }),
							raw({ alignSelf: "start" }),
						]}
					>
						<Avatar size="lg">
							<Avatar.Fallback>{site.author.initials}</Avatar.Fallback>
						</Avatar>
						<p mix={[m(0), weight("semibold"), fg("neutral.emphasis")]}>{site.author.name}</p>
						<p mix={[m(0), text("sm"), fg("neutral.muted"), pretty()]}>{site.author.bio}</p>
						<ul mix={[m(0), raw({ paddingInlineStart: "1.1rem" }), text("sm")]}>
							{site.author.links.map((link) => (
								<li>
									<a href={link.href} rel="noreferrer" mix={[quietLink(), fg("brand")]}>
										{link.label}
									</a>
								</li>
							))}
							<li>
								<a href={href(SUBSCRIBE_PAGE)} mix={[quietLink(), fg("brand")]}>
									Newsletter
								</a>
							</li>
							<li>
								<a href={href(FEED_PAGE)} mix={[quietLink(), fg("brand")]}>
									RSS feed
								</a>
							</li>
						</ul>
					</aside>
				</div>
			</Wrap>
		);
	};
}

namespace SubscribePage {
	export interface Props {
		context: DemoBlogContext;
		sent: boolean;
	}
}

/** The seasonal letter: the form, or the confirmation once an address has been sent. */
function SubscribePage(handle: Handle<SubscribePage.Props>) {
	return () => {
		let { context, sent } = handle.props;
		let { href } = context;
		return (
			<Wrap max="44rem">
				<PageIntro
					eyebrow="Newsletter"
					title="A letter each season"
					lead="Four emails a year: what was planted, what was tended and one thing I am still unsure about. No tracking pixels, and every letter is also on the RSS feed."
				/>
				<div
					data-slot="understory-subscribe"
					mix={[tinted(140), p(6), vstack({ gap: 4, align: "stretch" })]}
				>
					{sent ? (
						<div role="status" mix={[vstack({ gap: 2, align: "start" })]}>
							<p
								mix={[
									m(0),
									hstack({ gap: 2, align: "center" }),
									text("xl"),
									weight("semibold"),
									fg("brand"),
								]}
							>
								<CheckIcon size={22} aria-hidden="true" />
								You're on the list.
							</p>
							<p mix={[m(0), fg("neutral"), pretty()]}>
								Check your inbox for a note asking you to confirm. The next letter goes out at the
								turn of the season.
							</p>
							<a href={href()} mix={[quietLink(), fg("brand")]}>
								Back to the garden
							</a>
						</div>
					) : (
						<>
							<NewsletterForm action={href(SUBSCRIBE_PAGE)} submitLabel="Send me the letter" />
							<p mix={[m(0), ...labelFace(), fg("neutral.muted")]}>
								Prefer a feed reader?{" "}
								<a href={href(FEED_PAGE)} mix={[quietLink(), fg("brand")]}>
									Subscribe by RSS
								</a>
								.
							</p>
						</>
					)}
				</div>
			</Wrap>
		);
	};
}

namespace NotFoundPage {
	export interface Props {
		context: DemoBlogContext;
		path: string;
	}
}

/** A path nothing grows at: search, and three evergreen posts to start from instead. */
function NotFoundPage(handle: Handle<NotFoundPage.Props>) {
	return () => {
		let { context, path } = handle.props;
		let picks = LOST_PICKS.flatMap((pick) => context.posts.filter((post) => post.path === pick));
		return (
			<Wrap>
				<PageIntro
					eyebrow="Not found"
					title="Nothing grows here"
					lead={`There is no page at ${path}. It may have been moved when a post was tended, or the link was mistyped.`}
				>
					<SearchForm context={context} />
				</PageIntro>
				<section data-slot="understory-lost" mix={[vstack({ gap: 4, align: "stretch" })]}>
					<SectionTitle note="good places to start">Try one of these</SectionTitle>
					<CardGrid>
						{picks.map((post) => (
							<GardenCard context={context} post={post} />
						))}
					</CardGrid>
				</section>
			</Wrap>
		);
	};
}
