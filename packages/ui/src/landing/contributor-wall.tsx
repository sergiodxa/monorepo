/**
 * A project's contributors as a dense mosaic of square tiles, each a link to one person,
 * ending on a tile that counts everyone the wall leaves out. Tiles take a quiet tint read
 * from the name, so a wall of initials reads as texture and the page's accent stays free.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { combine, raw, mergeMix } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** Container the mosaic queries for its column steps. */
const CONTAINER = "ui-landing-contributor-wall";

/** Columns at the phone, `md` and `lg` container steps when `columns` is omitted. */
const DEFAULT_COLUMNS: ContributorWall.Columns = [6, 9, 12];

/** Shares of the heading ink a tile's tint takes, picked per name so neighbours differ. */
const TINTS = [5, 8, 11, 14] as const;

/**
 * Prop types for {@link ContributorWall} and its compound parts.
 */
export namespace ContributorWall {
	/** Columns at the phone, `md` and `lg` container steps. */
	export type Columns = readonly [phone: number, md: number, lg: number];

	/**
	 * Props accepted by {@link ContributorWall}.
	 */
	export interface Props extends TagProps<"ul"> {
		/** Accessible name for the list, such as "Contributors to plumb". */
		"aria-label": string;
		/**
		 * Columns at each container step. A tile count that divides every step, the
		 * {@link ContributorWall.More} tile included, fills every row.
		 *
		 * @default [6, 9, 12]
		 */
		columns?: Columns;
		/** {@link ContributorWall.Person} tiles, then an optional {@link ContributorWall.More}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link ContributorWall.Person}.
	 */
	export interface PersonProps extends Omit<TagProps<"a">, "children" | "href" | "role"> {
		/** Their profile or commit history. */
		href: string;
		/** Their name, read by assistive technology and shown as a tooltip. */
		name: string;
		/** Their picture; the tile shows their initials when omitted. */
		src?: string;
	}

	/**
	 * Props accepted by {@link ContributorWall.More}.
	 */
	export interface MoreProps extends Omit<TagProps<"a">, "children" | "href" | "role"> {
		/** The full contributor list. */
		href: string;
		/** The short count the tile shows, such as "+190". */
		count: RemixNode;
		/** What the link opens, read in full by assistive technology. */
		"aria-label": string;
	}
}

/**
 * Renders the mosaic. Every tile is square and the grid's columns step with its own
 * width, so the wall keeps its texture from a phone column to a wide split. Server markup and
 * CSS alone; tiles round to `--ui-landing-card-radius-inner` and outline in `--ui-landing-hairline`.
 *
 * @param handle Runtime handle carrying the host `<ul>`'s props.
 * @returns The render function producing the wall's markup.
 * @example
 * <ContributorWall aria-label="Contributors">
 * 	<ContributorWall.Person href="https://github.com/ana" name="Ana Souza" />
 * 	<ContributorWall.More href="https://github.com/org/repo/graphs/contributors" count="+190" aria-label="All 214 contributors" />
 * </ContributorWall>
 */
export function ContributorWall(handle: Handle<ContributorWall.Props>) {
	return () => {
		let { children, columns, mix, ...rest } = handle.props;
		let [phone, md, lg] = columns ?? DEFAULT_COLUMNS;

		return (
			<div data-slot="contributor-wall" mix={[container(CONTAINER), raw({ inlineSize: "100%" })]}>
				<ul
					{...rest}
					data-slot="contributor-wall-tiles"
					mix={mergeMix(
						[
							raw({
								"--ui-contributor-wall-columns": String(phone),
								display: "grid",
								gridTemplateColumns: "repeat(var(--ui-contributor-wall-columns), minmax(0, 1fr))",
								gap: "0.25rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
							}),
							at("md", CONTAINER, raw({ "--ui-contributor-wall-columns": String(md) })),
							at("lg", CONTAINER, raw({ "--ui-contributor-wall-columns": String(lg) })),
						],
						mix,
					)}
				>
					{children}
				</ul>
			</div>
		);
	};
}

/** The initials a tile without a picture shows: the first letter of up to two words. */
function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}

/** A stable tint step for a name, so the same person keeps the same tile on every render. */
function tintFor(name: string): number {
	let sum = 0;
	for (let index = 0; index < name.length; index += 1)
		sum = (sum * 31 + name.charCodeAt(index)) | 0;
	return TINTS[Math.abs(sum) % TINTS.length]!;
}

/**
 * One square tile in one rule: the tint (or, for the closing tile, a hairline outline), mono
 * initials, a picture in grayscale, and the brand fill on hover or focus, so a pointer finds
 * a person without anything moving.
 */
function tile(tint: number | "outline") {
	let outlined = tint === "outline";
	return combine([
		raw({
			display: "grid",
			placeItems: "center",
			aspectRatio: "1",
			minInlineSize: "0",
			overflow: "hidden",
			borderRadius: "var(--ui-landing-card-radius-inner, 0.25rem)",
			backgroundColor: outlined
				? "transparent"
				: `color-mix(in oklch, var(--ui-neutral-fg-emphasis) ${tint}%, transparent)`,
			boxShadow: outlined
				? "inset 0 0 0 1px var(--ui-landing-hairline, var(--ui-neutral-border))"
				: "none",
			color: outlined ? "var(--ui-neutral-fg-emphasis)" : "var(--ui-neutral-fg-muted)",
			fontVariantNumeric: "tabular-nums",
			fontFamily: "var(--ui-font-mono)",
			fontSize: "clamp(0.625rem, 2.5cqi, 0.8125rem)",
			fontWeight: "500",
			letterSpacing: "0.02em",
			textDecoration: "none",
			outlineOffset: "2px",
		}),
		when(
			"&:is(:hover, :focus-visible)",
			raw({ backgroundColor: "var(--ui-brand-bg-solid)", color: "var(--ui-brand-fg-on-solid)" }),
		),
		when(
			"& > img",
			raw({
				inlineSize: "100%",
				blockSize: "100%",
				objectFit: "cover",
				filter: "grayscale(1)",
			}),
		),
		when("&:is(:hover, :focus-visible) > img", raw({ filter: "none" })),
		motionSafe(raw({ transition: "background-color 150ms, color 150ms" })),
	]);
}

/**
 * One contributor: a linked tile with their picture or their initials, named by `name`.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the tile's list item.
 * @example
 * <ContributorWall.Person href="https://github.com/ana" name="Ana Souza" />
 */
ContributorWall.Person = function ContributorWallPerson(
	handle: Handle<ContributorWall.PersonProps>,
) {
	return () => {
		let { href, mix, name, src, ...rest } = handle.props;

		return (
			<li data-slot="contributor-wall-person" mix={[raw({ display: "grid" })]}>
				<a
					{...rest}
					href={href}
					aria-label={name}
					title={name}
					mix={mergeMix(tile(tintFor(name)), mix)}
				>
					{src ? (
						<img src={src} alt="" loading="lazy" />
					) : (
						<span aria-hidden="true">{initials(name)}</span>
					)}
				</a>
			</li>
		);
	};
};

/**
 * The closing tile: the count of contributors the wall leaves out, linking to all of them,
 * drawn as a hairline outline so it reads as a way out of the mosaic.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the tile's list item.
 * @example
 * <ContributorWall.More href={contributorsUrl} count="+190" aria-label="All 214 contributors" />
 */
ContributorWall.More = function ContributorWallMore(handle: Handle<ContributorWall.MoreProps>) {
	return () => {
		let { count, mix, ...rest } = handle.props;

		return (
			<li data-slot="contributor-wall-more" mix={[raw({ display: "grid" })]}>
				<a {...rest} mix={mergeMix(tile("outline"), mix)}>
					<span aria-hidden="true">{count}</span>
				</a>
			</li>
		);
	};
};
