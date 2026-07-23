/**
 * A single-line content row composing a leading media slot, a title and
 * description content slot, and a trailing action slot along one
 * horizontally centered line — the shape a settings row, a notification
 * list entry, or a file row all share. Every part lays out through the
 * row's own flex line rather than any part reading a semantic role from its
 * neighbors, so a row renders correctly whichever parts a given list needs:
 * media and content alone, content and actions alone, or all three.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { fg } from "@pkg/u/color";
import { center, flex, flexCol, gap, items } from "@pkg/u/layout";
import { bs, is, mis, minIs } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { truncate, weight } from "@pkg/u/typography";
import { css } from "remix/ui";

/**
 * Named container {@link Item} declares on its own host, so
 * {@link Item.Actions} can adapt to the row's own width instead of the
 * page's — the same row width whether it renders at the full page measure
 * or inside a narrower embedded panel.
 */
const CONTAINER_NAME = "ui-item";

/**
 * `@container` query gating the point past which the row's own width is too
 * narrow to hold {@link Item.Media}, {@link Item.Content}, and
 * {@link Item.Actions} on one line without crowding {@link Item.Content}'s
 * text out of room; below it {@link Item} wraps and {@link Item.Actions}
 * drops to a second line of its own.
 */
const NARROW_CONTAINER_QUERY = `@container ${CONTAINER_NAME} (max-width: 20rem)`;

/**
 * Prop types for {@link Item} and its compound parts.
 */
export namespace Item {
	/**
	 * Props accepted by {@link Item}.
	 */
	export interface Props extends TagProps<"div"> {
		/** The row's compound parts: {@link Item.Media}, {@link Item.Content}, and {@link Item.Actions}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Item.Media}.
	 */
	export interface MediaProps extends TagProps<"div"> {
		/** The leading graphic — an icon, an image thumbnail, an Avatar instance, or a checkbox. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Item.Content}.
	 */
	export interface ContentProps extends TagProps<"div"> {
		/** {@link Item.Title} and, optionally, {@link Item.Description}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Item.Title}.
	 */
	export interface TitleProps extends TagProps<"div"> {
		/** The row's label text. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Item.Description}.
	 */
	export interface DescriptionProps extends TagProps<"p"> {
		/** Supporting detail below the title — a file size, an email address, a timestamp. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Item.Actions}.
	 */
	export interface ActionsProps extends TagProps<"div"> {
		/** A run of buttons, links, or a switch — whatever control the row offers. */
		children: RemixNode;
	}
}

/**
 * Renders the row's host: a `<div>` laying {@link Item.Media},
 * {@link Item.Content}, and {@link Item.Actions} out along one
 * vertically centered flex line. Declares the `ui-item` named container so
 * {@link Item.Actions} can drop to a second line once the row itself
 * renders too narrow to hold every part on one — a file row inside a
 * sidebar rail, for instance, rather than the row's full page measure.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Item>
 * 	<Item.Media><FileTextIcon aria-hidden /></Item.Media>
 * 	<Item.Content>
 * 		<Item.Title>quarterly-report.pdf</Item.Title>
 * 		<Item.Description>2.4 MB</Item.Description>
 * 	</Item.Content>
 * 	<Item.Actions>
 * 		<Button aria-label={t("files.download")}><DownloadIcon /></Button>
 * 	</Item.Actions>
 * </Item>
 * @example
 * <Item>
 * 	<Item.Content>
 * 		<Item.Title>{t("settings.emailNotifications.title")}</Item.Title>
 * 		<Item.Description>{t("settings.emailNotifications.description")}</Item.Description>
 * 	</Item.Content>
 * 	<Item.Actions>
 * 		<Switch name="emailNotifications" />
 * 	</Item.Actions>
 * </Item>
 */
export function Item(handle: Handle<Item.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="item"
				mix={[
					flex(),
					items("center"),
					css({
						gap: "var(--ui-item-gap, 0.75rem)",
						paddingBlock: "var(--ui-item-padding-block, 0.625rem)",
						paddingInline: "var(--ui-item-padding-inline, 0.75rem)",
						container: `${CONTAINER_NAME} / inline-size`,

						[NARROW_CONTAINER_QUERY]: {
							flexWrap: "wrap",
						},
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders {@link Item.MediaProps.children} as the row's leading slot: a
 * shrink-proof, centered `<div>` sized to a modest square, colored from the
 * neutral foreground so a nested icon inherits it through `currentcolor`.
 * Nest a decorative icon, an image thumbnail, an Avatar instance, or a
 * checkbox inside it — this slot imposes only its own size and centering,
 * never a fixed shape of its own, so a circular Avatar or a square thumbnail
 * both render as that part's own shape rather than being clipped to one this
 * slot picks for it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the media slot's markup.
 * @example
 * <Item.Media><FileTextIcon aria-hidden /></Item.Media>
 * @example
 * <Item.Media>
 * 	<Avatar size="sm">
 * 		<Avatar.Image src={member.avatarUrl} alt={member.name} />
 * 		<Avatar.Fallback>{member.initials}</Avatar.Fallback>
 * 	</Avatar>
 * </Item.Media>
 */
Item.Media = function ItemMedia(handle: Handle<Item.MediaProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="media"
				mix={[
					center(),
					fg("neutral"),
					when("& > svg", [is(5), bs(5)]),
					css({
						flexShrink: "0",
						inlineSize: "var(--ui-item-media-size, 2rem)",
						blockSize: "var(--ui-item-media-size, 2rem)",
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Item.ContentProps.children} as the row's text column: a
 * `<div>` stacking {@link Item.Title} and an optional {@link Item.Description}
 * in a tight column, growing to fill whatever inline space
 * {@link Item.Media} and {@link Item.Actions} leave it, with its minimum
 * inline size collapsed to `0` so its children's own text-overflow
 * truncation actually takes effect inside the row's flex line.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the text column's markup.
 * @example
 * <Item.Content>
 * 	<Item.Title>quarterly-report.pdf</Item.Title>
 * 	<Item.Description>2.4 MB</Item.Description>
 * </Item.Content>
 */
Item.Content = function ItemContent(handle: Handle<Item.ContentProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="content"
				mix={[
					flex(),
					flexCol(),
					minIs(0),
					gap(0.5),
					css({
						flex: "1 1 0%",
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Item.TitleProps.children} as the row's label, in a plain
 * `<div>` rather than a native heading element: a row repeats once per list
 * entry, and a document outline gains nothing from multiplying an entry for
 * every file, notification, or setting a list happens to render. Truncated
 * to a single line with an ellipsis rather than wrapping, in the neutral
 * foreground's most emphasized tone so it reads as the row's primary text.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the title's markup.
 * @example
 * <Item.Title>quarterly-report.pdf</Item.Title>
 */
Item.Title = function ItemTitle(handle: Handle<Item.TitleProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="title"
				mix={[
					weight("medium"),
					fg("neutral.emphasis"),
					truncate(),
					css({
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Item.DescriptionProps.children} as the row's supporting
 * detail, in a native `<p>` muted to the neutral foreground's quieter tone
 * and truncated to a single line with an ellipsis rather than wrapping,
 * matching {@link Item.Title}'s own truncation so the pair reads as one
 * compact two-line block regardless of how long either runs.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 * @example
 * <Item.Description>2.4 MB</Item.Description>
 */
Item.Description = function ItemDescription(handle: Handle<Item.DescriptionProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<p
				{...rest}
				data-slot="description"
				mix={[
					fg("neutral.muted"),
					truncate(),
					css({
						fontSize: "0.8125rem",
						lineHeight: "calc(1.125 / 0.8125)",
					}),
					mix,
				]}
			>
				{children}
			</p>
		);
	};
};

/**
 * Renders {@link Item.ActionsProps.children} as the row's trailing slot: a
 * shrink-proof `<div>` laying its children out in a single row with a small
 * gap, pushed to the row's inline-end edge with `margin-inline-start: auto`
 * so it stays pinned there even when {@link Item.Content} is absent or
 * narrower than the row itself. Once the ancestor {@link Item} renders too
 * narrow to hold every part on one line, this slot drops to a second line
 * of its own, right-aligned and indented past where {@link Item.Media}
 * would sit, so it reads as trailing the content above it rather than
 * restarting flush with the row's own edge.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action slot's markup.
 * @example
 * <Item.Actions>
 * 	<Button aria-label={t("files.download")}><DownloadIcon /></Button>
 * 	<Button aria-label={t("files.remove")}><XIcon /></Button>
 * </Item.Actions>
 */
Item.Actions = function ItemActions(handle: Handle<Item.ActionsProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="actions"
				mix={[
					flex(),
					items("center"),
					mis("auto"),
					css({
						flexShrink: "0",
						gap: "var(--ui-item-actions-gap, 0.5rem)",

						[NARROW_CONTAINER_QUERY]: {
							flexBasis: "100%",
							justifyContent: "flex-end",
							marginInlineStart:
								"calc(var(--ui-item-media-size, 2rem) + var(--ui-item-gap, 0.75rem))",
						},
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};
