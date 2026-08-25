/**
 * A compound card presenting one attached file or image — media preview, name,
 * supporting details, actions — plus a horizontally scrolling row for several
 * cards side by side. Every part styles itself off the card's own `state`, and
 * whole-card click-through stays an opt-in wrapper a consumer mixes in.
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

const DEFAULT_STATE: Attachment.State = "idle";

/**
 * Named container {@link Attachment} declares on its own host, so
 * {@link Attachment.Media}, {@link Attachment.Content}, and the inner layout
 * wrapper resolve their width queries against the card itself.
 */
const CONTAINER_NAME = "ui-attachment";

/**
 * `@container` query every width-adapting part below the root shares: at or
 * under this width the card reflows into a taller tile, the shape
 * {@link Attachment.Group}'s narrow, fixed-width cards need.
 */
const NARROW_CONTAINER_QUERY = `@container ${CONTAINER_NAME} (max-width: 12rem)`;

/**
 * Selector fragment gating {@link Attachment.Title}'s shimmer: it matches the
 * title's own `data-state` attribute while that reads `"uploading"` or
 * `"processing"`, so a title given no state stays plain.
 */
const TITLE_SHIMMER_WHEN = ':is([data-state="uploading"], [data-state="processing"])';

const DEFAULT_ACTION_VARIANT: Button.Variant = "ghost";

const DEFAULT_ACTION_SIZE: Button.Size = "sm";

const DEFAULT_ACTION_COLOR: Button.Color = "neutral";

/**
 * Tab-stop order {@link attrs} applies to {@link Attachment.Group} when a
 * consumer supplies no `tabIndex`, so the row itself stays keyboard-reachable
 * and scrollable whatever its cards contain.
 */
const DEFAULT_GROUP_TAB_INDEX = 0;

const GROUP_SCROLL_FADE_SIZE = "2rem";

/**
 * Prop types for {@link Attachment} and its compound parts.
 */
export namespace Attachment {
	/**
	 * Lifecycle state of a card's file or image. `"idle"` and `"done"` both
	 * render as a settled card — `"idle"` for a file already on the server,
	 * `"done"` for one whose transfer finished. A consumer owns every transition.
	 */
	export type State = "idle" | "uploading" | "processing" | "error" | "done";

	/**
	 * Props accepted by {@link Attachment}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Lifecycle state of the file or image the card represents. Defaults to `"idle"`. */
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
		 * The ancestor {@link Attachment}'s own `state`, repeated here because a
		 * component reads only its own props; passing the same value to both is
		 * what keeps them in sync. Left unset, the title renders plain.
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
	 * field, unchanged, so an action keeps the same color, weight, and size
	 * contract as every other button in the catalog.
	 */
	export interface ActionProps extends Button.Props {}

	/**
	 * Props accepted by {@link Attachment.Trigger}.
	 */
	export interface TriggerProps extends TagProps<"div"> {
		/**
		 * Destination the whole card follows once `attachmentTrigger()` is mixed
		 * in, opened in place unless the activation asks for a new tab. It rides on
		 * a `<div>` so a nested {@link Attachment.Action} stays valid markup.
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
 * The card's outer host, recolored to the danger tint at `state="error"` and
 * declaring the `ui-attachment` named container so nested parts reflow at the
 * card's width. A busy state sets `aria-busy` to the token ARIA recognizes.
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
				aria-busy={isBusy ? "true" : undefined}
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
 * The card's media well: a fixed-size, rounded box clipping the preview a
 * consumer nests inside. Inside a narrow container it grows to the card's own
 * inline size at a wider aspect ratio, reading as a thumbnail tile.
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
 * The card's text column, growing into whatever inline space
 * {@link Attachment.Media} and {@link Attachment.Actions} leave it. Its minimum
 * inline size collapses to `0`, which is what lets its children truncate.
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
 * The file or image name in a native `<p>`, truncated to a single line with an
 * ellipsis. Given the same `state` as the ancestor {@link Attachment}, it
 * shimmers while that reads `"uploading"` or `"processing"`, then settles.
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
 * The card's supporting detail line: a muted, single-line `<p>` carrying a file
 * size, a page count, or the explanation of what went wrong once the ancestor
 * {@link Attachment}'s `state` reads `"error"`.
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
 * The card's action row, shrink-proof so a narrow card's width is absorbed by
 * {@link Attachment.Content}'s own truncation while the actions keep their
 * size.
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
 * A single card action as a {@link Button}, defaulting to a compact, `"ghost"`,
 * neutral control so a row of actions reads as secondary to the card's title.
 * Every {@link Button} prop stays available, `type` included.
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
 * A wrapper `<div>` whose `href` or `commandfor` stays an inert attribute until
 * a consumer mixes in `attachmentTrigger()`. Either one also derives a `role`
 * and `tabIndex`, so whole-card activation is announced and keyboard-reachable.
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
					when("&[role]:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * A horizontally scroll-snapping row of cards, faded at both inline edges to
 * hint at cards beyond the current view. The row itself carries the tab stop,
 * since the row is what scrolls.
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
