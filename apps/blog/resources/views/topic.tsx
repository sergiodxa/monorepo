/**
 * View for a topic page, which every kind's listing and every author's topic share: the
 * title, the Markdown description, the subscribe line naming the topic's three feeds, and an
 * `h-feed` of the posts its query found, each drawn the way its kind's own listing draws it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle } from "remix/component";

import { formatParts, parseDate } from "@sdxc/dates";
import { toRemix } from "@sdxc/markdown/remix";
import { mf } from "@sdxc/microformats/ui";
import { isFailure } from "@sdxc/result";
import { bg, border, fg } from "@sdxc/u/color";
import { ringShadow, rounded, transition } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hstack, items } from "@sdxc/u/layout";
import { m, maxIs, mbs, minIs, mis, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import {
	leading,
	nowrap,
	overflowWrap,
	tabularNums,
	text,
	textDecoration,
	weight,
} from "@sdxc/u/typography";
import { Badge, Heading, Link, Typeset } from "@sdxc/ui";

import type { BookmarksViewModel } from "~/app/http/view-models/bookmarks";
import type { GlossaryViewModel } from "~/app/http/view-models/glossary";
import type { TopicViewModel } from "~/app/http/view-models/topic";

import { LISTING_ENTRIES, socialCardVersion } from "~/app/services/social-card";
import { ActivityRow } from "~/resources/components/activity-row";
import { InlinePost } from "~/resources/components/inline-post";
import { BlogLayout } from "~/resources/layouts/blog";

/**
 * Formats a row's date for compact list display, read on the UTC calendar so the day shown is
 * the same wherever the page renders; an unparseable value yields an empty string.
 */
function formatDate(value: string) {
	let parsed = parseDate(value);
	if (isFailure(parsed)) return "";
	return formatParts(parsed.data, {
		locale: "en",
		timeZone: "UTC",
		month: "short",
		day: "2-digit",
		year: "2-digit",
	})
		.map((part) => part.value)
		.join("");
}

/**
 * The machine-readable instant for `<time datetime>`, which carries the `dt-published` a
 * microformats parser reads; `undefined` for an unparseable value, omitting it.
 */
function isoDate(value: string) {
	let parsed = parseDate(value);
	if (isFailure(parsed)) return undefined;
	return parsed.data.toISOString();
}

/** A bookmark's address made absolute, since one saved without a scheme names a host. */
function absoluteHref(rawHref: string) {
	if (/^https?:\/\//.test(rawHref) || rawHref.startsWith("/")) return rawHref;
	return `https://${rawHref}`;
}

/**
 * An article or a tutorial as an `h-entry`: its linked title, a preview badge while scheduled,
 * and its date, so a microformats reader of the listing finds every entry in it.
 */
function PageRow(handle: Handle<{ item: Extract<TopicViewModel.Item, { type: "page" }> }>) {
	return () => {
		let { item } = handle.props;
		return (
			<li
				mix={[
					mf("h-entry"),
					grid(),
					gridTemplate({ columns: "1fr auto" }),
					gap(3),
					items("baseline"),
					p(4),
					rounded("lg"),
					bg("neutral.tint"),
					border({ width: 1, color: "neutral" }),
				]}
			>
				<p mix={[m(0), text("lg"), fg("neutral.emphasis")]}>
					<Link href={item.href} mix={[mf("u-url", "p-name")]}>
						{item.label}
					</Link>
					{item.preview && (
						<Badge color="warning" variant="secondary" mix={[mis(2)]}>
							Preview
						</Badge>
					)}
				</p>
				<time
					datetime={isoDate(item.date)}
					mix={[mf("dt-published"), text("sm"), fg("neutral.muted"), nowrap(), tabularNums()]}
				>
					{formatDate(item.date)}
				</time>
			</li>
		);
	};
}

/**
 * A bookmark as an `h-entry` whose `u-bookmark-of` is the saved page and whose `p-summary` is
 * its description, ending with its date and an archive-snapshot link. The suffix is a native
 * anchor so the lone glyph renders free of the underline `@sdxc/ui`'s Link applies.
 */
function BookmarkRow(handle: Handle<{ item: BookmarksViewModel.Item }>) {
	return () => {
		let { item } = handle.props;
		return (
			<li
				mix={[
					mf("h-entry"),
					grid(),
					gridTemplate({ columns: "1fr auto" }),
					gap(3),
					items("baseline"),
					p(4),
					rounded("lg"),
					bg("neutral.tint"),
					border({ width: 1, color: "neutral" }),
				]}
			>
				<div mix={[grid(), gap(1), minIs(0)]}>
					<p mix={[m(0), text("lg"), fg("neutral.emphasis"), overflowWrap("anywhere")]}>
						<Link href={absoluteHref(item.href)} mix={[mf("u-bookmark-of", "p-name")]}>
							{item.label}
						</Link>
						{item.preview && (
							<Badge color="warning" variant="secondary" mix={[mis(2)]}>
								Preview
							</Badge>
						)}
					</p>
					{item.description ? (
						<p mix={[mf("p-summary"), m(0), text("base"), fg("neutral")]}>{item.description}</p>
					) : null}
				</div>
				<div mix={[hstack({ gap: 2, align: "center" }), nowrap()]}>
					<time
						datetime={isoDate(item.date)}
						mix={[mf("dt-published"), text("sm"), fg("neutral.muted"), tabularNums()]}
					>
						{formatDate(item.date)}
					</time>
					{item.suffixHref && item.suffixLabel && (
						<a
							href={absoluteHref(item.suffixHref)}
							aria-label={item.suffixAriaLabel}
							title={item.suffixTitle}
							mix={[text("sm"), leading("none"), fg("neutral.muted"), textDecoration("none")]}
						>
							{item.suffixLabel}
						</a>
					)}
				</div>
			</li>
		);
	};
}

/** A glossary entry's term, linking to its own anchor, with its alias, then its definition. */
function GlossaryTerm(handle: Handle<{ entry: GlossaryViewModel.Entry }>) {
	return () => {
		let { entry } = handle.props;
		return (
			<>
				<dt mix={[m(0), text("xl"), weight("bold"), fg("neutral.emphasis")]}>
					<a href={`#${entry.slug}`} mix={[fg("inherit"), textDecoration("none")]}>
						{entry.term}
						{entry.title && (
							<small mix={[mis(2), text("sm"), fg("neutral.muted")]}>(aka {entry.title})</small>
						)}
					</a>
				</dt>
				<dd mix={[m(0), mbs(2), text("lg"), fg("neutral.emphasis")]}>{entry.definition}</dd>
			</>
		);
	};
}

/**
 * A glossary entry as a card with an anchor id: a group inside the page's definition list, or
 * a list item holding its own when it sits among other kinds. It carries a hairline border at
 * rest so the `:target` highlight recolors an existing edge and the card holds its position.
 */
function GlossaryEntry(handle: Handle<{ entry: GlossaryViewModel.Entry; inList?: boolean }>) {
	return () => {
		let { entry, inList } = handle.props;
		let card = [
			p(4),
			rounded("lg"),
			bg("neutral.tint"),
			border({ width: 1, color: "neutral" }),
			transition("background-color, border-color, box-shadow", { duration: 120 }),
			when("&:target", [bg("brand.tint"), border("brand.strong"), ringShadow("brand.ring", 3)]),
			when("&:target dt", fg("brand.emphasis")),
			when("&:target dd", fg("brand")),
			when("&:target small", fg("brand")),
		];
		if (inList) {
			return (
				<li id={entry.slug} mix={card}>
					<dl mix={[m(0)]}>
						<GlossaryTerm entry={entry} />
					</dl>
				</li>
			);
		}
		return (
			<div id={entry.slug} mix={card}>
				<GlossaryTerm entry={entry} />
			</div>
		);
	};
}

/** One row of a mixed list, picked by the kind of post it shows. */
function TopicRow(handle: Handle<{ item: TopicViewModel.Item }>) {
	return () => {
		let { item } = handle.props;
		switch (item.type) {
			case "page":
				return <PageRow item={item} />;
			case "bookmark":
				return <BookmarkRow item={item.bookmark} />;
			case "entry":
				return <GlossaryEntry entry={item.entry} inList />;
			case "activity":
				return (
					<ActivityRow
						kind={item.kind}
						kindLabel={item.kindLabel}
						href={item.href}
						date={item.date}
						description={item.description ?? undefined}
						inline={item.inline ? <InlinePost {...item.inline} /> : undefined}
						linkMix={item.inline ? [mf("u-url")] : undefined}
						mix={[mf("h-entry")]}
					>
						{item.label}
					</ActivityRow>
				);
		}
	};
}

/**
 * Creates the topic page renderer. The subscribe line sits under the description by the
 * description's own trailing margin, as close as the page's other paragraphs; glossary entries
 * alone render as definition cards, as the glossary always has.
 *
 * @returns A view function that renders from a topic page model.
 */
export function TopicView() {
	return ({ model, assets }: { model: TopicViewModel.Page; assets: DocumentAssets }) => {
		let listing;
		if (model.items.length === 0) {
			listing = <p mix={[m(0), text("base"), fg("neutral")]}>{model.empty}</p>;
		} else if (model.entries) {
			listing = (
				<dl mix={[m(0), grid(), gap(3)]}>
					{model.items.map((item) =>
						item.type === "entry" ? <GlossaryEntry key={item.key} entry={item.entry} /> : null,
					)}
				</dl>
			);
		} else {
			listing = (
				<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(3), mbs(2)]}>
					{model.items.map((item) => (
						<TopicRow key={item.key} item={item} />
					))}
				</ol>
			);
		}
		return (
			<BlogLayout
				assets={assets}
				title={model.title}
				description={model.summary}
				activePath={model.path}
				card={{
					path: model.path,
					version: socialCardVersion(
						model.title,
						model.summary,
						...model.items.slice(0, LISTING_ENTRIES).map((item) => item.key),
					),
				}}
			>
				<main mix={[mf("h-feed"), grid(), gap(4)]}>
					<Heading level={1} mix={[mf("p-name"), text("3xl")]}>
						{model.title}
					</Heading>
					<div mix={[grid()]}>
						{model.description ? (
							<Typeset preset="reading" mix={[maxIs("52ch"), fg("neutral")]}>
								{toRemix(model.description)}
							</Typeset>
						) : null}
						<p mix={[m(0), text("lg"), fg("neutral")]}>
							Subscribe to {model.subscribeTo} using <Link href={model.feeds.rss}>RSS</Link>,{" "}
							<Link href={model.feeds.atom}>Atom</Link>, or{" "}
							<Link href={model.feeds.json}>JSON Feed</Link>.
						</p>
					</div>
					{listing}
				</main>
			</BlogLayout>
		);
	};
}
