/**
 * Inkwell's editor: a serif writing column under a sticky bar whose quiet status says the
 * draft is safe and whose one loud button says what publishing will do, beside the post's
 * properties as rows that open small popovers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CalendarClockIcon, CircleDotIcon, PenLineIcon, SendIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { border, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, leading, text, weight } from "@sdxc/u/typography";
import { Badge, Button, FieldError, LinkButton } from "@sdxc/ui";
import { EditorLayout } from "@sdxc/ui/app/editor-layout";
import { SaveBar } from "@sdxc/ui/app/save-bar";
import { SaveStatus } from "@sdxc/ui/app/save-status";
import { Skeleton } from "@sdxc/ui/app/skeleton";
import { PropertyList } from "@sdxc/ui/property-list";
import { RelativeTime } from "@sdxc/ui/relative-time";
import { StatusDot } from "@sdxc/ui/status-dot";
import { Timeline } from "@sdxc/ui/timeline";

import type { Post, PostStatus } from "~/resources/views/demo-apps/inkwell/data";

import DemoAppFrame from "~/resources/views/demo-apps/frame";
import {
	AUTHORS,
	findAuthor,
	minutesBefore,
	postDate,
	TAGS,
	wordCount,
} from "~/resources/views/demo-apps/inkwell/data";
import { FrameRegion } from "~/resources/views/demo-apps/inkwell/placeholders";
import { STATUS_COLOR, STATUS_LABEL } from "~/resources/views/demo-apps/inkwell/posts-query";
import { action, Byline, href, Initials, SLUG } from "~/resources/views/demo-apps/inkwell/shell";

/** The id the writing form takes, which the bar's buttons and the popovers' fields submit with. */
const FORM_ID = "post-form";

/**
 * The minimum heights the history's region holds: a live post's two events and the fold, in
 * the sidebar's narrow column and at a wider sheet.
 */
export const HISTORY_REGION = { narrow: "9.5rem", wide: "8rem" } as const;

/** What each status means to a reader, shown under its option in the status popover. */
const STATUS_HELP: Record<PostStatus, string> = {
	draft: "Only the masthead can read it.",
	published: "Live on lanternreview.example.",
	scheduled: "Goes live on its scheduled date.",
};

/** The save status line's strings. */
const SAVE_STATUS_LABELS = {
	saving: "Saving…",
	saved: "Saved",
	failed: "Couldn't save",
	retry: "Retry",
	edited: "Edited {time}",
};

/** The writing column's fields as a submit carried them, kept whole when it fails. */
export interface EditorValues {
	title: string;
	excerpt: string;
	body: string;
}

/** Props accepted by {@link EditorScreen}. */
interface EditorScreenProps {
	/** The document open in the editor; `null` for a new one. */
	post: Post | null;
	/** Whether the document is a post or one of the publication's pages. */
	kind: "post" | "page";
	/** The field the last submit left invalid. */
	issue: "title" | null;
	/** What the visitor typed into the writing column, when a failed submit answers it again. */
	values?: EditorValues;
	/** Whether the visitor just saved, so the status reads "Saved" before it decays. */
	justSaved: boolean;
	now: Date;
}

/**
 * The publication action for a document's state: a draft publishes, a queued or edited live
 * post updates, and a live post with nothing new says so on a disabled button.
 *
 * @param post The open document, or `null` for a new one.
 * @returns The button's label, the intent it submits and whether it is disabled.
 */
function primaryFor(post: Post | null): { label: string; intent: string; disabled: boolean } {
	if (post === null || post.status === "draft") {
		return { label: "Publish", intent: "publish", disabled: false };
	}
	if (post.status === "published" && !post.changed) {
		return { label: "Published", intent: "update", disabled: true };
	}
	return { label: "Update", intent: "update", disabled: false };
}

/**
 * The editor for one post, a new post or a new page. Every field, the popovers' included,
 * submits with one form, so ⌘S and the bar's buttons save the whole document at once.
 */
export function EditorScreen(handle: Handle<EditorScreenProps>) {
	return () => {
		let { post, kind, issue, values, justSaved, now } = handle.props;
		let noun = kind === "page" ? "page" : "post";
		let listPage = kind === "page" ? "pages" : "posts";
		let page = post === null ? `${listPage}/new` : `posts/${post.id}`;
		let primary = primaryFor(post);
		let isDraft = post === null || post.status === "draft";
		let editedAt =
			post === null
				? undefined
				: (justSaved ? now : minutesBefore(now, post.editedMinutesAgo)).toISOString();
		let titleIssueId = "post-title-issue";
		let body = values?.body ?? post?.body.join("\n\n") ?? "";
		let words = post === null ? 0 : wordCount(post);

		return (
			<EditorLayout
				form={FORM_ID}
				back={{ href: href(listPage), label: kind === "page" ? "Pages" : "Posts" }}
				title={post?.title ?? `New ${noun}`}
				status={
					<SaveStatus
						id="post-save-status"
						state={justSaved ? "saved" : undefined}
						editedAt={editedAt}
						form={FORM_ID}
						locale="en-US"
						labels={SAVE_STATUS_LABELS}
					/>
				}
				preview={
					<>
						{isDraft ? (
							<Button
								type="submit"
								form={FORM_ID}
								name="intent"
								value="draft"
								variant="ghost"
								color="neutral"
								size="sm"
							>
								Save draft
							</Button>
						) : null}
						{post === null ? null : (
							<LinkButton
								href={href(`posts/${post.id}/preview`)}
								data-rmx-document=""
								variant="outline"
								color="neutral"
								size="sm"
							>
								Preview
							</LinkButton>
						)}
					</>
				}
				primary={
					<Button
						type="submit"
						form={FORM_ID}
						name="intent"
						value={primary.intent}
						color="brand"
						size="sm"
						disabled={primary.disabled}
						title={primary.disabled ? "No unpublished changes" : undefined}
					>
						{primary.label}
					</Button>
				}
				sidebar={
					post === null ? <NewDocumentSidebar noun={noun} /> : <PostSidebar post={post} now={now} />
				}
				labels={{
					settings: "Settings",
					closeSettings: "Close settings",
					sidebar: kind === "page" ? "Page settings" : "Post settings",
				}}
				mix={[raw({ margin: "calc(-1 * var(--ui-app-gutter, 1rem))", inlineSize: "auto" })]}
			>
				<form
					id={FORM_ID}
					method="post"
					action={action(page)}
					mix={[vstack({ gap: 4, align: "stretch" }), raw({ paddingBlock: "1.5rem 4rem" })]}
				>
					<div mix={[vstack({ gap: 1, align: "stretch" })]}>
						<label htmlFor="post-title" mix={[visuallyHidden()]}>
							Title
						</label>
						<textarea
							id="post-title"
							name="title"
							rows={1}
							defaultValue={values?.title ?? post?.title ?? ""}
							placeholder={`Give this ${noun} a title`}
							required
							aria-invalid={issue === "title" ? "true" : undefined}
							aria-describedby={issue === "title" ? titleIssueId : undefined}
							autoComplete="off"
							mix={[
								font("serif"),
								fg("neutral.emphasis"),
								raw({
									fontSize: "clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem)",
									fontWeight: "600",
									letterSpacing: "-0.015em",
									lineHeight: "1.15",
									border: "none",
									background: "transparent",
									padding: "0",
									outline: "none",
									inlineSize: "100%",
									resize: "none",
									fieldSizing: "content",
									textWrap: "balance",
								}),
							]}
						/>
						{issue === "title" ? (
							<FieldError id={titleIssueId}>Give the {noun} a title, then save again.</FieldError>
						) : null}
					</div>
					{kind === "post" ? (
						<input
							name="excerpt"
							aria-label="Excerpt"
							defaultValue={values?.excerpt ?? post?.excerpt ?? ""}
							placeholder="A line for the index and the newsletter"
							autoComplete="off"
							mix={[
								font("serif"),
								fg("neutral.muted"),
								raw({
									fontSize: "1.125rem",
									fontStyle: "italic",
									border: "none",
									background: "transparent",
									padding: "0",
									outline: "none",
									inlineSize: "100%",
								}),
							]}
						/>
					) : null}
					<hr
						mix={[
							m(0),
							raw({
								border: "none",
								blockSize: "1px",
								inlineSize: "3rem",
								backgroundColor: "var(--ui-color-brand-300)",
							}),
						]}
					/>
					<textarea
						name="body"
						aria-label="Body"
						placeholder="Start writing…"
						rows={14}
						defaultValue={body}
						mix={[
							font("serif"),
							fg("neutral.emphasis"),
							leading("relaxed"),
							raw({
								fontSize: "1.1875rem",
								lineHeight: "1.7",
								border: "none",
								background: "transparent",
								padding: "0",
								outline: "none",
								resize: "none",
								inlineSize: "100%",
								fieldSizing: "content",
								minBlockSize: "16rem",
							}),
						]}
					/>
					<p mix={[m(0), text("xs"), fg("neutral.muted")]}>
						{words === 0
							? "Drafts save when you press ⌘S."
							: `${words} words · ${Math.max(1, Math.round(words / 230))} min read`}
					</p>
					<SaveBar
						labels={{
							message: "Unsaved changes",
							discard: "Discard",
							save: isDraft ? "Save draft" : "Update",
							shortcut: "⌘S",
						}}
					/>
				</form>
			</EditorLayout>
		);
	};
}

/** Props accepted by {@link PopoverDone}. */
interface PopoverDoneProps {
	/** The popover the button closes. */
	target: string;
}

/**
 * Closes a property popover. Its fields already belong to the writing form, so "Done" only
 * hides the popover and the next save carries the choice.
 */
function PopoverDone(handle: Handle<PopoverDoneProps>) {
	return () => (
		<Button
			type="button"
			size="sm"
			variant="outline"
			color="neutral"
			popovertarget={handle.props.target}
			popovertargetaction="hide"
		>
			Done
		</Button>
	);
}

/** Props accepted by {@link Choice}. */
interface ChoiceProps {
	type: "radio" | "checkbox";
	name: string;
	value: string;
	checked: boolean;
	label: RemixNode;
	help?: string;
}

/** One described option in a property popover, submitted with the writing form. */
function Choice(handle: Handle<ChoiceProps>) {
	return () => {
		let { type, name, value, checked, label, help } = handle.props;
		return (
			<label mix={[hstack({ gap: 2, align: "start" }), text("sm"), weight("medium")]}>
				<input
					type={type}
					name={name}
					value={value}
					checked={checked}
					form={FORM_ID}
					mix={[raw({ accentColor: "var(--ui-brand-bg-solid)" })]}
				/>
				<span mix={[vstack({ gap: 0, align: "stretch" })]}>
					{label}
					{help === undefined ? null : (
						<span mix={[text("xs"), weight("normal"), fg("neutral.muted")]}>{help}</span>
					)}
				</span>
			</label>
		);
	};
}

/** Props accepted by {@link PopoverForm}. */
interface PopoverFormProps {
	legend: string;
	target: string;
	children: RemixNode;
}

/** A property popover's body: a titled group of fields and the Done button. */
function PopoverForm(handle: Handle<PopoverFormProps>) {
	return () => (
		<div mix={[vstack({ gap: 3, align: "stretch" }), raw({ minInlineSize: "15rem" })]}>
			<fieldset mix={[vstack({ gap: 2, align: "stretch" }), m(0), p(0), border("none")]}>
				<legend mix={[p(0), text("xs"), weight("semibold"), fg("neutral.muted")]}>
					{handle.props.legend}
				</legend>
				{handle.props.children}
			</fieldset>
			<PopoverDone target={handle.props.target} />
		</div>
	);
}

/** Props accepted by {@link PostSidebar}. */
interface PostSidebarProps {
	post: Post;
	now: Date;
}

/**
 * A post's properties as named rows, each editable in a popover anchored to its row, then
 * its history as a quiet timeline.
 */
function PostSidebar(handle: Handle<PostSidebarProps>) {
	return () => {
		let { post, now } = handle.props;
		let author = findAuthor(post.authorId);
		let scheduledAt =
			post.status === "scheduled" ? postDate(post, now).toISOString().slice(0, 16) : "";

		return (
			<div mix={[vstack({ gap: 6, align: "stretch" })]}>
				<PropertyList>
					<PropertyList.Item
						label="Status"
						edit={{
							id: "edit-status",
							label: "Change status",
							content: (
								<PopoverForm legend="Status" target="edit-status">
									{(["draft", "published", "scheduled"] as const).map((status) => (
										<Choice
											type="radio"
											name="status"
											value={status}
											checked={status === post.status}
											label={STATUS_LABEL[status]}
											help={STATUS_HELP[status]}
										/>
									))}
								</PopoverForm>
							),
						}}
					>
						<span mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
							<StatusDot color={STATUS_COLOR[post.status]}>{STATUS_LABEL[post.status]}</StatusDot>
							{post.changed ? (
								<Badge color="warning" variant="secondary">
									Changed
								</Badge>
							) : null}
						</span>
					</PropertyList.Item>
					<PropertyList.Item
						label="Schedule"
						empty="Not scheduled"
						edit={{
							id: "edit-schedule",
							label: "Change schedule",
							content: (
								<PopoverForm legend="Publish on" target="edit-schedule">
									<input
										type="datetime-local"
										name="publishAt"
										form={FORM_ID}
										aria-label="Publish on"
										defaultValue={scheduledAt}
									/>
									<span mix={[text("xs"), fg("neutral.muted")]}>
										In the publication's time zone, Europe/Oslo.
									</span>
								</PopoverForm>
							),
						}}
					>
						{post.status === "scheduled" ? (
							<RelativeTime date={postDate(post, now)} now={now} locale="en-US" local />
						) : null}
					</PropertyList.Item>
					<PropertyList.Item
						label="Author"
						edit={{
							id: "edit-author",
							label: "Change author",
							content: (
								<PopoverForm legend="Author" target="edit-author">
									{AUTHORS.map((person) => (
										<Choice
											type="radio"
											name="author"
											value={person.id}
											checked={person.id === post.authorId}
											label={person.name}
											help={person.role}
										/>
									))}
								</PopoverForm>
							),
						}}
					>
						<Byline author={author} />
					</PropertyList.Item>
					<PropertyList.Item
						label="Tags"
						empty="No tags"
						edit={{
							id: "edit-tags",
							label: "Change tags",
							content: (
								<PopoverForm legend="Tags" target="edit-tags">
									{TAGS.map((tag) => (
										<Choice
											type="checkbox"
											name="tags"
											value={tag}
											checked={post.tags.includes(tag)}
											label={tag}
										/>
									))}
								</PopoverForm>
							),
						}}
					>
						{post.tags.length === 0 ? null : (
							<span mix={[hstack({ gap: 1, align: "center" }), raw({ flexWrap: "wrap" })]}>
								{post.tags.map((tag) => (
									<Badge variant="outline" color="neutral">
										{tag}
									</Badge>
								))}
							</span>
						)}
					</PropertyList.Item>
					<PropertyList.Item label="Slug">
						<span
							mix={[text("xs"), raw({ fontFamily: "var(--ui-font-mono)", wordBreak: "break-all" })]}
						>
							/{post.slug}
						</span>
					</PropertyList.Item>
					<PropertyList.Item label="Published" empty="Not yet">
						{post.status === "published" ? (
							<RelativeTime date={postDate(post, now)} now={now} locale="en-US" local />
						) : null}
					</PropertyList.Item>
				</PropertyList>
				<section aria-labelledby="post-history-title" mix={[vstack({ gap: 3, align: "stretch" })]}>
					<h2
						id="post-history-title"
						mix={[m(0), text("xs"), weight("semibold"), fg("neutral.muted")]}
					>
						History
					</h2>
					<FrameRegion {...HISTORY_REGION}>
						<DemoAppFrame
							app={SLUG}
							part={`posts/${post.id}/history`}
							fallback={<HistoryPlaceholder />}
						/>
					</FrameRegion>
				</section>
			</div>
		);
	};
}

/** Props accepted by {@link PostHistory}. */
interface PostHistoryProps {
	post: Post;
	now: Date;
}

/**
 * The post's revisions, newest first, with the older ones folded away. It streams into the
 * sidebar as its own frame, read from the stored post, so the properties above answer first.
 */
export function PostHistory(handle: Handle<PostHistoryProps>) {
	return () => {
		let { post, now } = handle.props;
		let author = findAuthor(post.authorId);
		let editor = findAuthor("jules");
		let created = post.editedMinutesAgo + 3 * 24 * 60;
		let at = (minutes: number) => (
			<RelativeTime date={minutesBefore(now, minutes)} now={now} locale="en-US" local />
		);
		return (
			<Timeline>
				<Timeline.Event
					icon={<PenLineIcon />}
					avatar={<Initials author={author} />}
					actor={author.name}
					time={at(post.editedMinutesAgo)}
				>
					edited the draft
				</Timeline.Event>
				{post.status === "draft" ? null : (
					<Timeline.Event
						icon={post.status === "published" ? <SendIcon /> : <CalendarClockIcon />}
						tone={post.status === "published" ? "success" : "brand"}
						avatar={<Initials author={author} />}
						actor={author.name}
						time={at(post.publishedMinutesAgo ?? post.editedMinutesAgo + 30)}
					>
						{post.status === "published" ? "published it" : "scheduled it"}
					</Timeline.Event>
				)}
				<Timeline.More summary="2 more events">
					<Timeline.Event
						icon={<CircleDotIcon />}
						avatar={<Initials author={editor} />}
						actor={editor.name}
						time={at(created - 60)}
					>
						copy-edited the draft
					</Timeline.Event>
					<Timeline.Event
						icon={<PenLineIcon />}
						avatar={<Initials author={author} />}
						actor={author.name}
						time={at(created)}
					>
						started the draft
					</Timeline.Event>
				</Timeline.More>
			</Timeline>
		);
	};
}

/** The history's placeholder: a line for each event a live post shows and one for the fold. */
export function HistoryPlaceholder() {
	return () => (
		<Skeleton.List
			rows={3}
			avatar
			lines={1}
			mix={[raw({ "--ui-skeleton-list-row-block-size": "2.5rem" })]}
		/>
	);
}

/** Props accepted by {@link NewDocumentSidebar}. */
interface NewDocumentSidebarProps {
	noun: string;
}

/** A new document's properties: everything is still a named empty value until it is saved. */
function NewDocumentSidebar(handle: Handle<NewDocumentSidebarProps>) {
	return () => (
		<PropertyList>
			<PropertyList.Item label="Status">
				<StatusDot color="neutral">Draft</StatusDot>
			</PropertyList.Item>
			<PropertyList.Item label="Author">
				<Byline author={AUTHORS[0]!} />
			</PropertyList.Item>
			<PropertyList.Item label="Schedule" empty="Not scheduled" />
			<PropertyList.Item label="Tags" empty="No tags" />
			<PropertyList.Item label="Slug" empty={`Set from the ${handle.props.noun}'s title`} />
		</PropertyList>
	);
}
