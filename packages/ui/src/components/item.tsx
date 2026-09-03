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

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import {
	basis,
	center,
	container,
	flex,
	flexCol,
	flexWrap,
	gap,
	grow,
	items,
	shrink,
} from "@sdxc/u/layout";
import { atMax } from "@sdxc/u/responsive";
import { bs, is, mis, minIs, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { fontSize, leading, text, truncate, weight } from "@sdxc/u/typography";

/**
 * Named container {@link Item} declares on its own host, so
 * {@link Item.Actions} can adapt to the row's own width instead of the
 * page's, keeping the same row width in a full page or a narrow panel.
 */
const CONTAINER_NAME = "ui-item";

/**
 * `@container` max-width threshold below which the row can't hold
 * {@link Item.Media}, {@link Item.Content}, and {@link Item.Actions} on one
 * line without crowding {@link Item.Content}'s text out of room.
 */
const NARROW_CONTAINER_SIZE = "20rem";

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
 * {@link Item.Content}, and {@link Item.Actions} on one flex line, dropping
 * {@link Item.Actions} to a second line once the row narrows past threshold.
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
					gap("var(--ui-item-gap, 0.75rem)"),
					pb("var(--ui-item-padding-block, 0.625rem)"),
					pi("var(--ui-item-padding-inline, 0.75rem)"),
					container(CONTAINER_NAME),
					atMax(NARROW_CONTAINER_SIZE, CONTAINER_NAME, flexWrap("wrap")),
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
 * shrink-proof, centered `<div>` colored from the neutral foreground so a
 * nested icon inherits it through `currentcolor`.
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
					shrink(),
					is("var(--ui-item-media-size, 2rem)"),
					bs("var(--ui-item-media-size, 2rem)"),
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
 * `<div>` stacking {@link Item.Title} and {@link Item.Description} with its
 * minimum inline size collapsed to `0` so their truncation takes effect.
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
				mix={[flex(), flexCol(), minIs(0), gap(0.5), grow(), shrink(1), basis("0%"), mix]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Item.TitleProps.children} as the row's label in a plain
 * `<div>`, since a document outline gains nothing from a heading entry per
 * repeated row, truncated to one line in the foreground's emphasized tone.
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
				mix={[weight("medium"), fg("neutral.emphasis"), truncate(), text("sm"), mix]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Item.DescriptionProps.children} as the row's supporting
 * detail in a native `<p>`, truncated to one line to match
 * {@link Item.Title} so the pair reads as one compact two-line block.
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
					fontSize("0.8125rem"),
					leading("calc(1.125 / 0.8125)"),
					mix,
				]}
			>
				{children}
			</p>
		);
	};
};

/**
 * Renders {@link Item.ActionsProps.children} as the row's trailing slot,
 * pinned to the inline-end edge; once {@link Item} wraps narrow, it drops
 * to its own line, indented past {@link Item.Media} to read as trailing.
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
					shrink(),
					gap("var(--ui-item-actions-gap, 0.5rem)"),
					atMax(NARROW_CONTAINER_SIZE, CONTAINER_NAME, [
						basis("100%"),
						raw({
							justifyContent: "flex-end",
							marginInlineStart:
								"calc(var(--ui-item-media-size, 2rem) + var(--ui-item-gap, 0.75rem))",
						}),
					]),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};
