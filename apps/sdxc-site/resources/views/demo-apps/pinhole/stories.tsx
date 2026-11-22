/**
 * The story viewer for today's stories and for a profile's highlights: each person (or each
 * highlight) is a group of timed segments, a drawn photograph that drifts while it plays, a
 * clip over it for a video segment, and a sticker. Every segment has its own address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SendIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { StoryViewer } from "@sdxc/ui/video/story-viewer";

import routes from "~/routes/web";

import type { Person, StorySegment } from "./data";

import { PersonAvatar, PhotoArt, seeded } from "./art";
import { STORIES, actionHref, findPerson, highlightsOf, href, shortAge } from "./data";

/** How long a still segment lasts, in seconds. */
const STILL_SECONDS = 5;

/** One group as the viewer draws it: who, its segments, their addresses and its title. */
export interface StoryGroup {
	id: string;
	person: Person;
	/** A highlight's title, shown beside the handle. */
	title?: string;
	segments: StorySegment[];
	/** The address of each segment, in order. */
	hrefs: string[];
}

/** Today's stories as groups, unseen first, the order the tray lists them. */
export function storyGroups(): StoryGroup[] {
	return [...STORIES]
		.sort((a, b) => Number(a.seen) - Number(b.seen))
		.map((story) => ({
			id: story.author,
			person: findPerson(story.author)!,
			segments: story.segments,
			hrefs: story.segments.map((_, index) => href(`stories/${story.author}/${index + 1}`)),
		}));
}

/** A person's highlights as groups, in the order their profile shows them. */
export function highlightGroups(handle: string): StoryGroup[] {
	let person = findPerson(handle);
	if (person === undefined) return [];
	return highlightsOf(handle).map((highlight) => ({
		id: highlight.id,
		person,
		title: highlight.title,
		segments: highlight.segments,
		hrefs: highlight.segments.map((_, index) =>
			href(`highlights/${handle}/${highlight.id}/${index + 1}`),
		),
	}));
}

/** A segment's length in seconds: its clip's, or five for a still. */
function secondsOf(segment: StorySegment): number {
	return segment.clip?.seconds ?? STILL_SECONDS;
}

/** A sticker of text set over a segment, tilted a little, placed by the photograph's seed. */
function Sticker(handle: Handle<{ text: string; seed: number }>) {
	return () => {
		let random = seeded(handle.props.seed + 7);
		let top = 28 + Math.round(random() * 34);
		let tilt = Math.round((random() - 0.5) * 10);
		return (
			<span
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: `${top}%`,
						insetInlineStart: "50%",
						zIndex: "1",
						translate: "-50% 0",
						rotate: `${tilt}deg`,
						paddingBlock: "0.375rem",
						paddingInline: "0.75rem",
						borderRadius: "0.375rem",
						backgroundColor: "oklch(0.98 0.012 85)",
						color: "oklch(0.2 0.02 40)",
						fontFamily: "var(--pinhole-display)",
						fontSize: "1.375rem",
						fontWeight: "600",
						letterSpacing: "-0.01em",
						whiteSpace: "nowrap",
						boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.5)",
						pointerEvents: "none",
					}),
				]}
			>
				{handle.props.text}
			</span>
		);
	};
}

/** One segment's picture: the drifting photograph, a clip over it when it has one, a sticker. */
function SegmentPicture(handle: Handle<{ segment: StorySegment; preload: "auto" | "none" }>) {
	return () => {
		let { preload, segment } = handle.props;
		return (
			<div mix={[raw({ position: "relative" })]}>
				<PhotoArt photo={segment.photo} moving />
				{segment.clip === undefined ? null : (
					<video
						muted
						playsinline
						loop
						preload={preload}
						aria-hidden="true"
						poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
						mix={[
							raw({
								position: "absolute",
								inset: "0",
								inlineSize: "100%",
								blockSize: "100%",
								objectFit: "cover",
							}),
						]}
					>
						<source
							src={routes.showcase.media.href({
								file: `video/vesper/${segment.clip.minutes}.webm`,
							})}
							type="video/webm"
						/>
						<source
							src={routes.showcase.media.href({ file: `video/vesper/${segment.clip.minutes}.mp4` })}
							type="video/mp4"
						/>
					</video>
				)}
				{segment.sticker === undefined ? null : (
					<Sticker text={segment.sticker} seed={segment.photo.seed} />
				)}
			</div>
		);
	};
}

/** A group's header: avatar, handle (and a highlight's title) and how long ago. */
function GroupHeader(handle: Handle<{ group: StoryGroup; current: number }>) {
	return () => {
		let { current, group } = handle.props;
		let segment = group.segments[current]!;
		return (
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.625rem",
						fontSize: "0.875rem",
						textShadow: "0 1px 2px rgb(0 0 0 / 0.45)",
					}),
				]}
			>
				<a href={href(`u/${group.person.handle}`)} aria-hidden="true" tabindex={-1}>
					<PersonAvatar person={group.person} size={2} />
				</a>
				<a
					href={href(`u/${group.person.handle}`)}
					mix={[
						raw({ color: "inherit", fontWeight: "650", textDecoration: "none" }),
						when("&:hover", raw({ textDecoration: "underline" })),
					]}
				>
					{group.title ?? group.person.handle}
				</a>
				<span mix={[raw({ opacity: "0.75" })]}>
					{group.title === undefined ? shortAge(segment.ago) : group.person.handle}
				</span>
			</div>
		);
	};
}

/** The reply field at a story's foot: a message to its author, posted as a form. */
function ReplyForm(handle: Handle<{ group: StoryGroup; back: string }>) {
	return () => {
		let { back, group } = handle.props;
		return (
			<form
				method="post"
				action={actionHref(`stories/${group.person.handle}/reply`)}
				mix={[raw({ display: "flex", alignItems: "center", gap: "0.5rem" })]}
			>
				<input type="hidden" name="back" value={back} />
				<input
					name="text"
					required
					maxlength={300}
					autocomplete="off"
					aria-label={`Reply to ${group.person.handle}`}
					placeholder={`Reply to ${group.person.handle}…`}
					mix={[
						raw({
							flex: "1 1 auto",
							minInlineSize: "0",
							blockSize: "2.75rem",
							paddingInline: "1rem",
							border: "1px solid rgb(255 255 255 / 0.6)",
							borderRadius: "999px",
							background: "transparent",
							color: "oklch(0.99 0 0)",
							font: "inherit",
							fontSize: "0.9375rem",
							"&::placeholder": { color: "rgb(255 255 255 / 0.8)" },
						}),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid oklch(0.99 0 0)", outlineOffset: "1px" }),
						),
					]}
				/>
				<button
					type="submit"
					aria-label="Send reply"
					mix={[
						raw({
							display: "grid",
							placeItems: "center",
							inlineSize: "2.75rem",
							blockSize: "2.75rem",
							padding: "0",
							border: "0",
							borderRadius: "999px",
							background: "transparent",
							color: "oklch(0.99 0 0)",
							cursor: "pointer",
						}),
						when("&:focus-visible", raw({ outline: "2px solid oklch(0.99 0 0)" })),
					]}
				>
					<SendIcon size={24} aria-hidden="true" />
				</button>
			</form>
		);
	};
}

namespace StoriesPage {
	export interface Props {
		groups: StoryGroup[];
		/** The group the viewer opens on, by id. */
		active: string;
		/** The segment it opens on, from 0. */
		segment: number;
		/** Where closing goes. */
		closePage: string;
		/** Whether these are a profile's highlights. */
		highlights?: boolean;
	}
}

/** The story viewer screen. */
export default function StoriesPage(handle: Handle<StoriesPage.Props>) {
	return () => {
		let { active, closePage, groups, highlights = false, segment } = handle.props;
		let close = href(closePage);
		let at = groups.findIndex((group) => group.id === active);
		let opened = groups[at]!;
		return (
			<>
				<h1
					mix={[
						raw({
							position: "absolute",
							inlineSize: "1px",
							blockSize: "1px",
							overflow: "hidden",
							clipPath: "inset(50%)",
						}),
					]}
				>
					{highlights ? `${opened.title} · ${opened.person.name}` : `${opened.person.name}'s story`}
				</h1>
				<StoryViewer
					label={highlights ? "Highlights" : "Stories"}
					closeHref={close}
					labels={{ close: "Close", pause: "Pause" }}
					mix={[raw({ "--ui-story-viewer-bg": "oklch(0.14 0.01 50)" })]}
				>
					{groups.map((group, position) => {
						let current = position === at ? segment : 0;
						let before = groups[position - 1];
						let after = groups[position + 1];
						let previousHref = group.hrefs[current - 1] ?? before?.hrefs.at(-1) ?? close;
						let nextHref = group.hrefs[current + 1] ?? after?.hrefs[0] ?? close;
						return (
							<StoryViewer.Group
								id={`story-${group.id}`}
								label={highlights ? `${group.title}, a highlight` : `${group.person.name}'s story`}
								durations={group.segments.map(secondsOf)}
								current={current}
								active={position === at}
								previousHref={previousHref}
								nextHref={nextHref}
								labels={{ previous: "Previous", next: "Next" }}
								header={<GroupHeader group={group} current={current} />}
								footer={
									highlights ? undefined : (
										<ReplyForm
											group={group}
											back={group.hrefs[current]!.slice(href().length + 1)}
										/>
									)
								}
							>
								{group.segments.map((entry, index) => {
									let near = position === at && (index === current || index === current + 1);
									return (
										<StoryViewer.Segment href={group.hrefs[index]!} current={index === current}>
											<SegmentPicture segment={entry} preload={near ? "auto" : "none"} />
										</StoryViewer.Segment>
									);
								})}
							</StoryViewer.Group>
						);
					})}
				</StoryViewer>
			</>
		);
	};
}
