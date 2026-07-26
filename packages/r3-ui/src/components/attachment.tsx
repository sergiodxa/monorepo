/**
 * A compound card presenting one attached file or image — its media
 * preview, name, supporting details, and available actions — plus a
 * horizontally scrolling row for showing several such cards side by side.
 * Every part styles itself off the card's own `state`; the whole-card
 * click-through some consumers want stays a separate, opt-in wrapper rather
 * than something baked into the card's own markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, border, fg, outline } from "@pkg/u/color";
import { rounded, transition } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import {
	basis,
	block,
	container,
	flex,
	flexCol,
	gap,
	grow,
	hstack,
	items,
	justify,
	relative,
	shrink,
	vstack,
} from "@pkg/u/layout";
import { overflow, overflowX } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { aspect, bs, fit, is, minIs, p } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { text, textAlign, truncate, weight } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { shimmer } from "../animations/keyframes";
import { scrollFade } from "../animations/scroll";

import { Button } from "./button";

/** State {@link Attachment} falls back to when `state` is omitted. */
const DEFAULT_STATE: Attachment.State = "idle";

/**
 * Named container {@link Attachment} declares on its own host, so
 * {@link Attachment.Media}, {@link Attachment.Content}, and the card's own
 * inner layout wrapper can adapt to the card's own width instead of the
 * page's.
 */
const CONTAINER_NAME = "ui-attachment";

/**
 * `@container` query every width-adapting part below the root shares: past
 * this width the card lays out as a compact row, at or under it the card
 * reflows into a taller tile — the shape {@link Attachment.Group} needs for
 * its narrow, fixed-width cards.
 */
const NARROW_CONTAINER_QUERY = `@container ${CONTAINER_NAME} (max-width: 12rem)`;

/**
 * Selector fragment gating {@link Attachment.Title}'s shimmer: matches the
 * title's own `data-state` attribute while it reads `"uploading"` or
 * `"processing"`, and never matches at all when a consumer leaves `state`
 * unset.
 */
const TITLE_SHIMMER_WHEN = ':is([data-state="uploading"], [data-state="processing"])';

/** Visual weight {@link Attachment.Action} falls back to when `variant` is omitted. */
const DEFAULT_ACTION_VARIANT: Button.Variant = "ghost";

/** Size variant {@link Attachment.Action} falls back to when `size` is omitted. */
const DEFAULT_ACTION_SIZE: Button.Size = "sm";

/** Semantic color role {@link Attachment.Action} falls back to when `color` is omitted. */
const DEFAULT_ACTION_COLOR: Button.Color = "neutral";

/** Native tab-stop order applied to {@link Attachment.Group} through {@link attrs} unless a consumer supplies its own `tabIndex`, so the scrollable row is reachable and scrollable with the keyboard even when none of its cards are themselves focusable. */
const DEFAULT_GROUP_TAB_INDEX = 0;

/** CSS length each edge of {@link Attachment.Group}'s scroll fade extends inward, passed straight through to {@link scrollFade}. */
const GROUP_SCROLL_FADE_SIZE = "2rem";

/**
 * Prop types for {@link Attachment} and its compound parts.
 */
export namespace Attachment {
	/**
	 * Lifecycle state a card's file or image is in. `"idle"` and `"done"`
	 * both render as a settled, static card — `"idle"` for one that never
	 * needed an upload step (already on the server when first rendered),
	 * `"done"` for one whose transfer finished — while `"uploading"` and
	 * `"processing"` mark it busy and `"error"` marks it failed. Transitions
	 * between these are entirely a consumer concern: this component only
	 * ever reads whatever value it's given.
	 */
	export type State = "idle" | "uploading" | "processing" | "error" | "done";

	/**
	 * Props accepted by {@link Attachment}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Lifecycle state of the file or image the card represents. Defaults to {@link DEFAULT_STATE}. */
		state?: State;
		/** The card's compound parts: {@link Attachment.Media}, {@link Attachment.Content}, and {@link Attachment.Actions}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Attachment.Media}.
	 */
	export interface MediaProps extends TagProps<"div"> {
		/** The preview itself: an `<img>`, or a decorative icon standing in for the file's type. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Attachment.Content}.
	 */
	export interface ContentProps extends TagProps<"div"> {
		/** {@link Attachment.Title} and, optionally, {@link Attachment.Description}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Attachment.Title}.
	 */
	export interface TitleProps extends TagProps<"p"> {
		/**
		 * Mirrors the ancestor {@link Attachment}'s own `state` so this title
		 * knows when to shimmer — this component renders once per call and
		 * has no way to read a sibling's props on its own, so a consumer
		 * passing the same value to both is what keeps them in sync. Left
		 * unset, the title never shimmers, which is the correct rendering
		 * for a settled card that never needed to pass a state here at all.
		 */
		state?: Attachment.State;
		/** The file or image name. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Attachment.Description}.
	 */
	export interface DescriptionProps extends TagProps<"p"> {
		/** Supporting detail — a file size, a page count, an error message. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Attachment.Actions}.
	 */
	export interface ActionsProps extends TagProps<"div"> {
		/** A run of {@link Attachment.Action} controls. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Attachment.Action}: every {@link Button.Props}
	 * field, unchanged, so an action picks up the same semantic color role,
	 * visual weight, and size contract as every other button in the catalog.
	 */
	export interface ActionProps extends Button.Props {}

	/**
	 * Props accepted by {@link Attachment.Trigger}.
	 */
	export interface TriggerProps extends TagProps<"div"> {
		/**
		 * Destination the whole card follows once `attachmentTrigger()` is
		 * mixed in, opened in place unless the activation itself asks for a
		 * new tab. Read as a plain attribute rather than through a native
		 * `<a>`, since the platform disallows nesting another interactive
		 * control — {@link Attachment.Action} — inside an anchor.
		 */
		href?: string;
		/**
		 * `id` of a `<dialog>` element the whole card opens once
		 * `attachmentTrigger()` is mixed in, instead of following `href`.
		 */
		commandfor?: string;
		/** Invoker Commands verb dispatched to `commandfor`'s dialog. Defaults to `"show-modal"`. */
		command?: "show-modal";
		/** Where `href` opens: a window/frame name, or `"_blank"` for a new tab. Meaningful only alongside `href`. */
		target?: string;
		/** The card's own markup — typically an {@link Attachment}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Attachment.Group}.
	 */
	export interface GroupProps extends TagProps<"div"> {
		/** A run of {@link Attachment} or {@link Attachment.Trigger} cards. */
		children: RemixNode;
	}
}

/**
 * Renders the card's outer host: a rounded, bordered `<div>` tinted with the
 * neutral tint background by default and, once `state` reads `"error"`,
 * recolored to the danger tint instead — the one visual distinction this
 * root itself carries, since every other state renders identically until a
 * nested {@link Attachment.Title} shimmers. `aria-busy` mirrors `"uploading"`
 * and `"processing"` automatically, and the root declares the `ui-attachment`
 * named container so {@link Attachment.Media} and {@link Attachment.Content}
 * can reflow the card once it renders inside a narrow context, such as
 * {@link Attachment.Group}'s row.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the card's markup.
 * @example
 * <Attachment state="uploading">
 * 	<Attachment.Media><FileIcon aria-hidden /></Attachment.Media>
 * 	<Attachment.Content>
 * 		<Attachment.Title state="uploading">quarterly-report.pdf</Attachment.Title>
 * 		<Attachment.Description>{t("attachment.uploading")}</Attachment.Description>
 * 	</Attachment.Content>
 * </Attachment>
 * @example
 * <Attachment state="error">
 * 	<Attachment.Media><FileIcon aria-hidden /></Attachment.Media>
 * 	<Attachment.Content>
 * 		<Attachment.Title>quarterly-report.pdf</Attachment.Title>
 * 		<Attachment.Description>{t("attachment.uploadFailed")}</Attachment.Description>
 * 	</Attachment.Content>
 * 	<Attachment.Actions>
 * 		<Attachment.Action aria-label={t("attachment.retry")}><RotateCwIcon /></Attachment.Action>
 * 	</Attachment.Actions>
 * </Attachment>
 */
export function Attachment(handle: Handle<Attachment.Props>) {
	return () => {
		let { state, children, mix, ...rest } = handle.props;
		let resolvedState = state ?? DEFAULT_STATE;
		let isBusy = resolvedState === "uploading" || resolvedState === "processing";

		return (
			<div
				{...rest}
				data-slot="attachment"
				data-state={resolvedState}
				aria-busy={isBusy || undefined}
				mix={[
					relative(),
					rounded("lg"),
					border({ width: 1 }),
					border("neutral"),
					bg("neutral.tint"),
					fg("neutral.emphasis"),
					p(3),
					transition("border-color, background-color"),
					container(CONTAINER_NAME),
					when('&[data-state="error"]', [
						border("danger"),
						bg("danger.tint"),
						fg("danger.emphasis"),
					]),
					mix,
				]}
			>
				<div
					data-slot="body"
					mix={[
						hstack({ gap: 3, align: "center" }),
						when(NARROW_CONTAINER_QUERY, [flexCol(), items("stretch")]),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * Renders the card's media well: a fixed-size, rounded, centered `<div>`
 * clipping whatever preview a consumer nests inside — an `<img>` filling it
 * edge to edge through `object-fit: cover`, or a decorative icon sized and
 * colored through ordinary inheritance. Once the ancestor {@link Attachment}
 * renders inside a narrow container (such as {@link Attachment.Group}'s
 * row), the well grows to fill the card's own inline size at a wider aspect
 * ratio, reading as a thumbnail tile instead of a small icon well.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the media well's markup.
 * @example
 * <Attachment.Media><img src={file.thumbnailUrl} alt="" /></Attachment.Media>
 * @example
 * <Attachment.Media><FileTextIcon aria-hidden /></Attachment.Media>
 */
Attachment.Media = function AttachmentMedia(handle: Handle<Attachment.MediaProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="media"
				mix={[
					flex(),
					shrink(0),
					items("center"),
					justify("center"),
					overflow(),
					is(10),
					bs(10),
					rounded("md"),
					bg("neutral.bg-tint-hover"),
					fg("neutral"),
					when("& > svg", [is(5), bs(5)]),
					when("& > img", [is("full"), bs("full"), fit("cover")]),
					when(NARROW_CONTAINER_QUERY, [is("full"), bs("auto"), aspect(4, 3), rounded("lg")]),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders the card's text column: a `<div>` stacking {@link Attachment.Title}
 * and an optional {@link Attachment.Description}, growing to fill whatever
 * inline space {@link Attachment.Media} and {@link Attachment.Actions} leave
 * it, with its minimum inline size collapsed to `0` so its children's own
 * text-overflow truncation actually takes effect inside a flex row. Once the
 * ancestor {@link Attachment} renders inside a narrow container, the column
 * centers its text instead, matching {@link Attachment.Media}'s own switch
 * to a taller tile.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the text column's markup.
 * @example
 * <Attachment.Content>
 * 	<Attachment.Title>quarterly-report.pdf</Attachment.Title>
 * 	<Attachment.Description>2.4 MB</Attachment.Description>
 * </Attachment.Content>
 */
Attachment.Content = function AttachmentContent(handle: Handle<Attachment.ContentProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="content"
				mix={[
					vstack({ gap: 0.5 }),
					minIs(0),
					grow(),
					shrink(1),
					basis("0%"),
					when(NARROW_CONTAINER_QUERY, textAlign("center")),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders the file or image name in a native `<p>`, truncated to a single
 * line with an ellipsis rather than wrapping. Passing the same `state` a
 * consumer gave the ancestor {@link Attachment} makes the title shimmer
 * through the `shimmer()` animation factory while that state reads
 * `"uploading"` or `"processing"`, settling back to plain text the moment it
 * no longer does — leaving `state` unset renders a plain, never-shimmering
 * title, correct for a card that's already settled.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the title's markup.
 * @example
 * <Attachment.Title>quarterly-report.pdf</Attachment.Title>
 * @example
 * <Attachment.Title state={attachment.state}>{attachment.name}</Attachment.Title>
 */
Attachment.Title = function AttachmentTitle(handle: Handle<Attachment.TitleProps>) {
	return () => {
		let { state, children, mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				data-slot="title"
				data-state={state}
				mix={[
					weight("semibold"),
					truncate(),
					text("sm"),
					shimmer({ when: TITLE_SHIMMER_WHEN }),
					mix,
				]}
			>
				{children}
			</p>
		);
	};
};

/**
 * Renders the card's supporting detail line in a native `<p>`, muted to the
 * neutral foreground's quieter tone and truncated to a single line with an
 * ellipsis — a file size, a page count, or, once the ancestor
 * {@link Attachment}'s `state` reads `"error"`, an explanation of what went
 * wrong.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 * @example
 * <Attachment.Description>2.4 MB</Attachment.Description>
 * @example
 * <Attachment.Description>{t("attachment.uploadFailed")}</Attachment.Description>
 */
Attachment.Description = function AttachmentDescription(
	handle: Handle<Attachment.DescriptionProps>,
) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<p {...rest} data-slot="description" mix={[truncate(), fg("neutral.muted"), text("xs"), mix]}>
				{children}
			</p>
		);
	};
};

/**
 * Renders the card's action row: a `<div>` laying a run of
 * {@link Attachment.Action} controls out in a line, shrink-proof so
 * {@link Attachment.Content}'s own truncation absorbs a narrow card's width
 * before the actions ever get squeezed.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action row's markup.
 * @example
 * <Attachment.Actions>
 * 	<Attachment.Action aria-label={t("attachment.download")}><DownloadIcon /></Attachment.Action>
 * 	<Attachment.Action aria-label={t("attachment.remove")}><XIcon /></Attachment.Action>
 * </Attachment.Actions>
 */
Attachment.Actions = function AttachmentActions(handle: Handle<Attachment.ActionsProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div {...rest} data-slot="actions" mix={[flex(), shrink(0), items("center"), gap(1), mix]}>
				{children}
			</div>
		);
	};
};

/**
 * Renders a single card action as a {@link Button}, defaulting to a compact,
 * `"ghost"`, neutral-colored control so a row of actions reads as secondary
 * to {@link Attachment.Title} and {@link Attachment.Media} — every
 * {@link Button} prop stays available to override that, including `type`,
 * left for a consumer to set explicitly (a plain client action, or a real
 * form submission that deletes or retries server-side).
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the action's markup.
 * @example
 * <Attachment.Action aria-label={t("attachment.download")}>
 * 	<DownloadIcon />
 * </Attachment.Action>
 * @example
 * <Attachment.Action type="submit" name="intent" value="retry" aria-label={t("attachment.retry")}>
 * 	<RotateCwIcon />
 * </Attachment.Action>
 */
Attachment.Action = function AttachmentAction(handle: Handle<Attachment.ActionProps>) {
	return () => {
		let { color, variant, size, mix, ...rest } = handle.props;

		return (
			<Button
				color={color ?? DEFAULT_ACTION_COLOR}
				variant={variant ?? DEFAULT_ACTION_VARIANT}
				size={size ?? DEFAULT_ACTION_SIZE}
				{...rest}
				data-slot="action"
				mix={[shrink(0), mix]}
			/>
		);
	};
};

/**
 * Renders a plain wrapper `<div>` around a card — typically an
 * {@link Attachment} — carrying no interactivity of its own: `href` and
 * `commandfor`/`command` sit on the host as inert attributes until a
 * consumer mixes in `attachmentTrigger()`, which reads them to turn a click
 * or `Enter`/`Space` anywhere on the wrapper (outside an
 * {@link Attachment.Action} or other native control) into following the
 * link or opening the named dialog. Rendering `href` or `commandfor` also
 * gives the wrapper `role="link"`/`role="button"` and a `tabIndex` of `0`
 * unless a consumer overrides either, so the whole-card activation stays
 * reachable and announced correctly once the mixin is attached; without it,
 * the wrapper is simply focusable and inert, and the card underneath stays
 * fully readable regardless.
 *
 * In dev mode, a trigger rendered with neither `href` nor `commandfor` logs
 * a `console.warn`, since nothing would happen once the mixin handles an
 * activation.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the wrapper's markup.
 * @example
 * <Attachment.Trigger href="/files/quarterly-report.pdf" mix={attachmentTrigger()}>
 * 	<Attachment state="done">
 * 		<Attachment.Media><FileTextIcon aria-hidden /></Attachment.Media>
 * 		<Attachment.Content>
 * 			<Attachment.Title>quarterly-report.pdf</Attachment.Title>
 * 		</Attachment.Content>
 * 		<Attachment.Actions>
 * 			<Attachment.Action aria-label={t("attachment.download")}><DownloadIcon /></Attachment.Action>
 * 		</Attachment.Actions>
 * 	</Attachment>
 * </Attachment.Trigger>
 * @example
 * <Attachment.Trigger commandfor="quarterly-report-preview" mix={attachmentTrigger()}>
 * 	<Attachment state="done">…</Attachment>
 * </Attachment.Trigger>
 * <Dialog id="quarterly-report-preview">…</Dialog>
 */
Attachment.Trigger = function AttachmentTrigger(handle: Handle<Attachment.TriggerProps>) {
	return () => {
		let { href, commandfor, command, target, role, tabIndex, children, mix, ...rest } =
			handle.props;
		let isConfigured = href !== undefined || commandfor !== undefined;
		let resolvedRole = role ?? (href !== undefined ? "link" : isConfigured ? "button" : undefined);
		let resolvedTabIndex = tabIndex ?? (isConfigured ? 0 : undefined);

		if (import.meta.env.DEV && !isConfigured) {
			console.warn(
				'Attachment.Trigger: rendered with neither "href" nor "commandfor" — nothing will happen once `attachmentTrigger()` handles an activation.',
			);
		}

		return (
			<div
				{...rest}
				role={resolvedRole}
				tabIndex={resolvedTabIndex}
				data-slot="trigger"
				mix={[
					attrs({ href, commandfor, command, target }),
					relative(),
					block(),
					rounded("inherit"),
					when("&[role]:hover", bg("neutral.bg-tint-hover")),
					when("&[role]:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders a horizontally scrolling, scroll-snapping row of cards: a `<div>`
 * whose direct children each snap to its inline-start edge as the row
 * scrolls, faded at both inline edges through the `scrollFade()` animation
 * factory to hint at cards beyond the current view. Reachable and scrollable
 * with the keyboard by default, since the row itself is what actually
 * scrolls and none of the cards inside it need to be focusable for that.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Attachment.Group aria-label={t("thread.attachments")}>
 * 	{attachments.map((attachment) => (
 * 		<Attachment key={attachment.id} state={attachment.state}>…</Attachment>
 * 	))}
 * </Attachment.Group>
 */
Attachment.Group = function AttachmentGroup(handle: Handle<Attachment.GroupProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="group"
				mix={[
					attrs({ tabIndex: DEFAULT_GROUP_TAB_INDEX }),
					flex(),
					gap(3),
					overflowX("auto"),
					raw({
						overscrollBehaviorInline: "contain",
						scrollSnapType: "inline mandatory",
						scrollPaddingInline: "0.75rem",
						scrollBehavior: "auto",
					}),
					when("& > *", [shrink(0), raw({ scrollSnapAlign: "start" })]),
					media("(prefers-reduced-motion: no-preference)", raw({ scrollBehavior: "smooth" })),
					scrollFade({ axis: "inline", size: GROUP_SCROLL_FADE_SIZE }),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};
