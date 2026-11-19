/**
 * The small pieces every Parley screen draws: a person's face on a tinted tile with their
 * presence dot, a channel's glyph, a message's Markdown with mentions and channel links, and
 * the files attached to it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	FileCodeIcon,
	FileIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	HashIcon,
	LockIcon,
} from "@sdxc/icons";
import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { raw } from "@sdxc/u/general";
import { Attachment } from "@sdxc/ui/chat/attachment";
import { ImagePlaceholder } from "@sdxc/ui/image-placeholder";

import type {
	Conversation,
	FileRef,
	Person,
	Presence,
} from "~/resources/views/demo-apps/parley/data";

import {
	CHANNELS,
	ME_HANDLE,
	PEOPLE,
	conversationPage,
	findPerson,
	href,
} from "~/resources/views/demo-apps/parley/data";

/** The scheme a mention or channel reference carries until the link renderer reads it. */
const REFERENCE = "parley:";

/** What each presence reads as, for the dot's accessible name and the member list. */
export const PRESENCE_LABEL: Record<Presence, string> = {
	active: "Active",
	away: "Away",
	dnd: "Do not disturb",
};

/** Sizes a face renders at, in rem. */
const FACE_SIZE = { xs: 1.25, sm: 1.5, md: 2.25, lg: 3.5 } as const;

namespace Face {
	export interface Props {
		person: Person;
		size?: keyof typeof FACE_SIZE;
		/** Draws the presence dot, which the live stream flips by `data-presence`. */
		presence?: boolean;
	}
}

/**
 * A person's face: their initials on a rounded tile in their own hue, and when asked their
 * presence dot at the corner, marked so a live update can find and recolour it.
 */
export function Face(handle: Handle<Face.Props>) {
	return () => {
		let { person, size = "md", presence = false } = handle.props;
		let rem = FACE_SIZE[size];
		let glyph = size === "xs" ? person.initials.slice(0, 1) : person.initials;
		if (person.bot) glyph = "🌿";
		return (
			<ImagePlaceholder
				shape="square"
				aria-hidden={presence ? undefined : "true"}
				mix={[
					raw({
						inlineSize: `${rem}rem`,
						blockSize: `${rem}rem`,
						minInlineSize: `${rem}rem`,
						borderRadius: `${Math.max(0.25, rem * 0.24)}rem`,
						fontSize: `${rem * 0.4}rem`,
						flexShrink: "0",
					}),
				]}
			>
				<ImagePlaceholder.Fallback
					mix={[
						raw({
							borderRadius: "inherit",
							fontWeight: "700",
							letterSpacing: "0.02em",
							color: `oklch(0.3 0.08 ${person.hue})`,
							backgroundColor: `oklch(0.88 0.075 ${person.hue})`,
							"@media (prefers-color-scheme: dark)": {
								color: `oklch(0.92 0.05 ${person.hue})`,
								backgroundColor: `oklch(0.42 0.09 ${person.hue})`,
							},
						}),
					]}
				>
					{glyph}
				</ImagePlaceholder.Fallback>
				{presence ? <PresenceDot person={person} /> : null}
			</ImagePlaceholder>
		);
	};
}

/**
 * A person's presence dot: filled green while active, hollow while away, red with a bar on
 * do-not-disturb, so the three read apart without colour as well.
 */
export function PresenceDot(handle: Handle<{ person: Person }>) {
	return () => {
		let { person } = handle.props;
		return (
			<ImagePlaceholder.Badge
				role="img"
				aria-label={PRESENCE_LABEL[person.presence]}
				data-presence={person.handle}
				data-state={person.presence}
				mix={[presenceDot()]}
			/>
		);
	};
}

/** The dot's look by its `data-state`, shared by faces and the inline dots in lists. */
export function presenceDot() {
	return raw({
		inlineSize: "0.625rem",
		blockSize: "0.625rem",
		borderRadius: "999px",
		boxSizing: "border-box",
		boxShadow: "0 0 0 2px var(--ui-bg)",
		"&[data-state=active]": { backgroundColor: "oklch(0.68 0.17 150)", border: "none" },
		"&[data-state=away]": {
			backgroundColor: "var(--ui-bg)",
			border: "2px solid var(--ui-neutral-fg-muted)",
		},
		"&[data-state=dnd]": {
			backgroundColor: "oklch(0.6 0.2 25)",
			border: "none",
			backgroundImage: "linear-gradient(white, white)",
			backgroundSize: "60% 2px",
			backgroundPosition: "center",
			backgroundRepeat: "no-repeat",
		},
	});
}

/** A channel's glyph: a hash, a lock when private. */
export function ChannelGlyph(handle: Handle<{ conversation: Conversation; size?: number }>) {
	return () => {
		let { conversation, size = 16 } = handle.props;
		return conversation.private ? (
			<LockIcon size={size} aria-hidden="true" />
		) : (
			<HashIcon size={size} aria-hidden="true" />
		);
	};
}

/** The handles a mention may name, longest first, so `@jo` never steals `@jonah`. */
const HANDLES = PEOPLE.map((person) => person.handle).sort((a, b) => b.length - a.length);

/** The channels a `#name` may name. */
const CHANNEL_NAMES = CHANNELS.map((channel) => channel.name).sort((a, b) => b.length - a.length);

/** Matches a mention or channel reference at a word's start. */
const REFERENCE_PATTERN = new RegExp(
	`(^|[\\s(])(@(?:${HANDLES.join("|")})|#(?:${CHANNEL_NAMES.join("|")}))\\b`,
	"g",
);

/**
 * Splits a text node around its mentions and channel references, turning each into a link the
 * renderer draws as a chip. The link's own text drops the `@` or `#`, so the walk, which visits
 * it next, never splits it again; code spans and fences are separate nodes and stay untouched.
 */
function references(node: Markdown.Text): Markdown.Inline[] {
	let parts: Markdown.Inline[] = [];
	let cursor = 0;
	for (let match of node.value.matchAll(REFERENCE_PATTERN)) {
		let lead = match[1] ?? "";
		let reference = match[2] ?? "";
		let start = (match.index ?? 0) + lead.length;
		if (start > cursor) {
			parts.push({ type: "text", value: node.value.slice(cursor, start), position: node.position });
		}
		parts.push({
			type: "link",
			href: `${REFERENCE}${reference}`,
			children: [{ type: "text", value: reference.slice(1), position: node.position }],
			position: node.position,
		});
		cursor = start + reference.length;
	}
	if (cursor === 0) return [node];
	if (cursor < node.value.length) {
		parts.push({ type: "text", value: node.value.slice(cursor), position: node.position });
	}
	return parts;
}

/** The props the Markdown renderer hands a link. */
interface LinkProps {
	href: string;
	title?: string;
	children?: RemixNode;
}

/**
 * Draws a link: a mention as a tinted chip leading to a direct message (the visitor's own name
 * stronger), a channel reference as a chip leading to it, and any other address as an external
 * link that opens in a new tab.
 */
function MessageLink(handle: Handle<LinkProps>) {
	return () => {
		let { href: target, title, children } = handle.props;
		if (target.startsWith(REFERENCE)) {
			let reference = target.slice(REFERENCE.length);
			let isMention = reference.startsWith("@");
			let name = reference.slice(1);
			let person = isMention ? findPerson(name) : undefined;
			let destination = person === undefined ? href(conversationPage(`c:${name}`)) : undefined;
			if (person !== undefined && person.handle !== ME_HANDLE) {
				destination = href(conversationPage(`d:${person.handle}`));
			}
			let chip = raw({
				display: "inline",
				paddingInline: "0.1875rem",
				borderRadius: "0.25rem",
				fontWeight: "600",
				textDecoration: "none",
				color: "var(--ui-brand-fg-emphasis)",
				backgroundColor: "var(--ui-brand-bg-tint)",
				"&[data-me]": {
					color: "var(--ui-warning-fg-emphasis)",
					backgroundColor: "color-mix(in oklch, var(--ui-warning-bg-solid) 28%, transparent)",
				},
				"&:hover": { textDecoration: "underline" },
			});
			let label = person === undefined ? reference : `@${person.name}`;
			return destination === undefined ? (
				<span data-me="" data-mention={name} mix={[chip]}>
					{label}
				</span>
			) : (
				<a href={destination} data-mention={name} title={person?.title} mix={[chip]}>
					{label}
				</a>
			);
		}
		return (
			<a
				href={target}
				title={title}
				target="_blank"
				rel="noopener noreferrer"
				mix={[
					raw({
						color: "var(--ui-brand-fg)",
						textDecoration: "underline",
						textDecorationThickness: "1px",
						textUnderlineOffset: "0.15em",
						overflowWrap: "anywhere",
					}),
				]}
			>
				{children}
			</a>
		);
	};
}

/**
 * A message's text as Markdown: emphasis, code spans and highlighted fences, lists, quotes,
 * task lists, links, mentions and channel references. Text that fails to parse shows as written.
 */
export function MessageText(handle: Handle<{ text: string; edited?: RemixNode }>) {
	return () => {
		let { text, edited } = handle.props;
		let parsed = Markdown.parse(text);
		let body: RemixNode = text;
		if (!isFailure(parsed)) {
			let walked = Markdown.walk(parsed.data.document, { text: (node) => references(node) });
			if (!isFailure(walked)) {
				body = toRemix(walked.data, {
					components: {
						link: MessageLink as unknown as (handle: Handle<never>) => () => RemixNode,
					},
				});
			}
		}
		return (
			<div
				data-message-text=""
				mix={[
					raw({
						minInlineSize: "0",
						"& p, & ul, & ol, & blockquote, & pre, & figure": { marginBlock: "0 0.375rem" },
						"& > :last-child, & > :last-child > :last-child": { marginBlockEnd: "0" },
						"& ul, & ol": { paddingInlineStart: "1.25rem" },
						"& ul": { listStyle: "disc" },
						"& ol": { listStyle: "decimal" },
						"& li:has(> input[type=checkbox])": {
							listStyle: "none",
							marginInlineStart: "-1.25rem",
						},
						"& li > input[type=checkbox]": { marginInlineEnd: "0.375rem", verticalAlign: "-0.1em" },
						"& blockquote": {
							marginInline: "0",
							paddingInlineStart: "0.75rem",
							borderInlineStart: "3px solid var(--ui-neutral-border-strong)",
							color: "var(--ui-neutral-fg)",
						},
						"& :not(pre) > code": {
							fontSize: "0.8125rem",
							paddingInline: "0.25rem",
							paddingBlock: "0.0625rem",
							borderRadius: "0.25rem",
							border: "1px solid var(--ui-neutral-border)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							color: "var(--ui-danger-fg-emphasis, inherit)",
						},
						"& pre": { maxInlineSize: "100%", overflowX: "auto", fontSize: "0.8125rem" },
						"& strong": { fontWeight: "700" },
					}),
				]}
			>
				{body}
				{edited}
			</div>
		);
	};
}

/** A size in bytes as people read it: "184 KB", "2.3 MB". */
export function formatSize(bytes: number): string {
	if (bytes < 1000) return `${bytes} B`;
	if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
	return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** What a file's kind is called on its card. */
const KIND_LABEL: Record<FileRef["kind"], string> = {
	image: "Image",
	pdf: "PDF",
	doc: "Document",
	sheet: "Spreadsheet",
	code: "Code",
	other: "File",
};

/** The glyph a file's card shows by kind. */
function FileGlyph(handle: Handle<{ kind: FileRef["kind"] }>) {
	return () => {
		let { kind } = handle.props;
		if (kind === "sheet") return <FileSpreadsheetIcon aria-hidden="true" />;
		if (kind === "code") return <FileCodeIcon aria-hidden="true" />;
		if (kind === "pdf" || kind === "doc") return <FileTextIcon aria-hidden="true" />;
		return <FileIcon aria-hidden="true" />;
	};
}

/** A stable number from a file's name, so its preview art is the same on every render. */
function seedOf(name: string): number {
	let seed = 0;
	for (let char of name) seed = (seed * 31 + char.charCodeAt(0)) % 997;
	return seed;
}

/**
 * An image file's preview: abstract art in the file's own colours (a sky, two hills and a sun),
 * drawn from its name, so screenshots in the history read as pictures without shipping any.
 */
function ImagePreview(handle: Handle<{ file: FileRef }>) {
	return () => {
		let { file } = handle.props;
		let seed = seedOf(file.name);
		let hue = (seed * 37) % 360;
		let dark = file.name.includes("dark");
		return (
			<figure
				mix={[
					raw({
						margin: "0",
						display: "grid",
						gap: "0.25rem",
						inlineSize: "min(20rem, 100%)",
					}),
				]}
			>
				<svg
					viewBox="0 0 320 180"
					role="img"
					aria-label={`Preview of ${file.name}`}
					mix={[
						raw({
							display: "block",
							inlineSize: "100%",
							blockSize: "auto",
							borderRadius: "0.5rem",
							border: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<rect
						width="320"
						height="180"
						fill={dark ? `oklch(0.28 0.05 ${hue})` : `oklch(0.94 0.04 ${hue})`}
					/>
					<circle
						cx={60 + (seed % 200)}
						cy="58"
						r="22"
						fill={`oklch(0.82 0.13 ${(hue + 60) % 360})`}
					/>
					<path
						d={`M0 140 Q ${80 + (seed % 60)} ${90 + (seed % 30)} 180 130 T 320 120 V180 H0Z`}
						fill={`oklch(${dark ? 0.45 : 0.72} 0.12 ${(hue + 140) % 360})`}
					/>
					<path
						d={`M0 160 Q 120 ${120 + (seed % 25)} 220 150 T 320 150 V180 H0Z`}
						fill={`oklch(${dark ? 0.36 : 0.6} 0.13 ${(hue + 160) % 360})`}
					/>
				</svg>
				<figcaption mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}>
					{file.name} · {formatSize(file.size)}
				</figcaption>
			</figure>
		);
	};
}

/**
 * A message's files: images as previews, everything else as cards with the name, kind and size,
 * in a row that wraps.
 */
export function Files(handle: Handle<{ files: readonly FileRef[] }>) {
	return () => {
		let { files } = handle.props;
		if (files.length === 0) return null;
		return (
			<div
				mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-start" })]}
			>
				{files.map((file) =>
					file.kind === "image" ? (
						<ImagePreview file={file} />
					) : (
						<Attachment mix={[raw({ inlineSize: "min(17rem, 100%)" })]}>
							<Attachment.Media>
								<FileGlyph kind={file.kind} />
							</Attachment.Media>
							<Attachment.Content>
								<Attachment.Title>{file.name}</Attachment.Title>
								<Attachment.Description>
									{KIND_LABEL[file.kind]} · {formatSize(file.size)}
								</Attachment.Description>
							</Attachment.Content>
						</Attachment>
					),
				)}
			</div>
		);
	};
}
