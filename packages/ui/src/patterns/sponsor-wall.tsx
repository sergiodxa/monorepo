/**
 * A tiered sponsor and partner wall: each tier is a labelled, ruled grid of marks whose
 * cells and logos shrink with the tier, followed by a cloud of individual backers and a
 * closing call to action, so the biggest supporters read first and every backer is shown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { combine, raw } from "@sdxc/u/general";
import { container, vstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";

import { CtaGroup } from "../components/cta-group.js";
import { HeadingScope, resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";
import { eyebrow } from "../styles/marketing.js";

/** Container the tier grids and the backer cloud query for their column steps. */
const CONTAINER = "ui-marketing-sponsor-wall";

/** Translucent line the tier grids rule their cells with. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** Tier size {@link SponsorWall.Tier} applies when `size` is omitted. */
const DEFAULT_TIER_SIZE: SponsorWall.TierSize = "md";

/** Circle size {@link SponsorWall.Person} applies when `size` is omitted. */
const DEFAULT_PERSON_SIZE: SponsorWall.PersonSize = "md";

/**
 * Columns, cell height and logo height for one tier at the phone, `md` and `lg` container
 * steps. A higher tier gets fewer, taller cells and larger marks.
 */
interface TierScale {
	columns: [phone: number, md: number, lg: number];
	cell: [phone: string, lg: string];
	logo: [phone: string, lg: string];
}

/** Every tier's scale: `xl` 2 columns of 15rem cells down to `sm` 6 columns of 5rem cells. */
const TIER_SCALES: Record<SponsorWall.TierSize, TierScale> = {
	xl: { columns: [1, 2, 2], cell: ["8rem", "15rem"], logo: ["2.5rem", "3.5rem"] },
	lg: { columns: [2, 3, 3], cell: ["6rem", "8.75rem"], logo: ["1.75rem", "2.5rem"] },
	md: { columns: [2, 3, 4], cell: ["5rem", "7.5rem"], logo: ["1.5rem", "2.25rem"] },
	sm: { columns: [3, 4, 6], cell: ["4rem", "5rem"], logo: ["1.125rem", "1.75rem"] },
};

/** Diameter of a backer circle per size. */
const PERSON_SIZES: Record<SponsorWall.PersonSize, string> = {
	sm: "2rem",
	md: "2.75rem",
	lg: "3.5rem",
};

/**
 * Prop types for {@link SponsorWall} and its compound parts.
 */
export namespace SponsorWall {
	/** How prominent a tier is: `xl` for the top partners down to `sm` for the long tail. */
	export type TierSize = "sm" | "md" | "lg" | "xl";

	/** How large a backer's circle draws, usually by how much they give. */
	export type PersonSize = "sm" | "md" | "lg";

	/**
	 * Props accepted by {@link SponsorWall}.
	 */
	export interface Props extends TagProps<"div"> {
		/** {@link SponsorWall.Tier} groups, highest first, then an optional {@link SponsorWall.Individuals}. */
		children: RemixNode;
		/** Closing actions, such as "Become a sponsor", rendered inside a centred {@link CtaGroup}. */
		actions?: RemixNode;
	}

	/**
	 * Props accepted by {@link SponsorWall.Tier}.
	 */
	export interface TierProps extends TagProps<"div"> {
		/** The tier's name, such as "Gold partners"; it heads the tier at the ambient depth. */
		label: RemixNode;
		/** Cell and logo scale. Defaults to {@link DEFAULT_TIER_SIZE}. */
		size?: TierSize;
		/**
		 * The marks: inline SVGs drawn in `currentColor`, images, or links wrapping either.
		 * Each direct child becomes one cell; passed as a list, the tier balances its rows.
		 */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link SponsorWall.Individuals}.
	 */
	export interface IndividualsProps extends TagProps<"div"> {
		/** A label above the cloud, such as "Individual sponsors". */
		label?: RemixNode;
		/** {@link SponsorWall.Person} circles. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link SponsorWall.Person}.
	 */
	export interface PersonProps extends Omit<TagProps<"a">, "children" | "href" | "role"> {
		/** Where the circle links: the backer's profile or site. */
		href: string;
		/** The backer's name, which is the link's accessible name and its tooltip. */
		name: string;
		/** Picture URL; without one the circle shows the name's initials. */
		src?: string;
		/** Circle size. Defaults to {@link DEFAULT_PERSON_SIZE}. */
		size?: PersonSize;
	}
}

/**
 * Stacks sponsor tiers, the backer cloud and the closing actions, and opens a heading
 * scope so every tier label sits one level under the band's title.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the wall's markup.
 * @example
 * <SponsorWall actions={<LinkButton href={sponsor}>{t("sponsor.cta")}</LinkButton>}>
 * 	<SponsorWall.Tier label={t("sponsor.gold")} size="xl">{goldMarks}</SponsorWall.Tier>
 * 	<SponsorWall.Tier label={t("sponsor.silver")} size="lg">{silverMarks}</SponsorWall.Tier>
 * </SponsorWall>
 */
export function SponsorWall(handle: Handle<SponsorWall.Props>) {
	return () => {
		let { actions, children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="sponsor-wall"
				mix={[
					container(CONTAINER),
					vstack({ gap: 14, align: "stretch" }),
					raw({ inlineSize: "100%" }),
					mix,
				]}
			>
				<HeadingScope>{children}</HeadingScope>
				{actions ? (
					<CtaGroup data-slot="sponsor-wall-actions" mix={[raw({ justifyContent: "center" })]}>
						{actions}
					</CtaGroup>
				) : null}
			</div>
		);
	};
}

/**
 * The centred mono label over a tier or the backer cloud, rendered as a heading at the
 * ambient depth so a screen reader can jump between tiers.
 */
function tierLabel() {
	return [eyebrow(), m(0), raw({ alignSelf: "center", textAlign: "center" })];
}

/**
 * The column count that spreads `count` marks over as few rows as `max` columns allow while
 * keeping those rows as even as possible: seven marks at six columns become rows of four and
 * three. An unknown count keeps `max`.
 */
function balancedColumns(max: number, count: number | undefined): number {
	if (!count || count <= max) return Math.max(1, Math.min(max, count ?? max));
	return Math.ceil(count / Math.ceil(count / max));
}

/** How many marks `children` holds when it is a list; `undefined` for a single node or fragment. */
function countMarks(children: RemixNode): number | undefined {
	if (!Array.isArray(children)) return undefined;
	let count = 0;
	for (let child of children as unknown[]) {
		if (Array.isArray(child)) count += countMarks(child as RemixNode) ?? 0;
		else if (child !== null && child !== undefined && child !== false) count += 1;
	}
	return count;
}

/**
 * The tier's ruled grid in one rule, so its column count, cell and logo scale and ruling
 * never compete with another class. Cells grow to fill their row, so the last row never
 * leaves an empty track; hairlines are cell shadows the grid clips at its side edges.
 */
function tierGrid(size: SponsorWall.TierSize, count: number | undefined) {
	let scale = TIER_SCALES[size];
	let columns = scale.columns.map((max) => balancedColumns(max, count));

	return combine([
		raw({
			"--ui-sponsor-wall-columns": String(columns[0]),
			"--ui-sponsor-wall-cell": scale.cell[0],
			"--ui-sponsor-wall-logo": scale.logo[0],
			"--ui-sponsor-wall-pad": "0.5rem",
			display: "flex",
			flexWrap: "wrap",
			clipPath: "inset(0)",
			borderBlock: `1px solid ${HAIRLINE}`,
			color: "var(--ui-neutral-fg-emphasis)",
		}),
		at(
			"md",
			CONTAINER,
			raw({ "--ui-sponsor-wall-columns": String(columns[1]), "--ui-sponsor-wall-pad": "1rem" }),
		),
		at(
			"lg",
			CONTAINER,
			raw({
				"--ui-sponsor-wall-columns": String(columns[2]),
				"--ui-sponsor-wall-cell": scale.cell[1],
				"--ui-sponsor-wall-logo": scale.logo[1],
			}),
		),
		when(
			"& > *",
			raw({
				boxSizing: "border-box",
				flex: "1 1 calc(100% / var(--ui-sponsor-wall-columns) - 1px)",
				minInlineSize: "0",
				blockSize: "var(--ui-sponsor-wall-cell)",
				paddingInline: "var(--ui-sponsor-wall-pad)",
				paddingBlock: "calc((var(--ui-sponsor-wall-cell) - var(--ui-sponsor-wall-logo)) / 2)",
				objectFit: "contain",
				color: "currentColor",
				boxShadow: `1px 0 0 ${HAIRLINE}, 0 1px 0 ${HAIRLINE}`,
				outlineOffset: "-2px",
			}),
		),
		when(
			"& > * > :is(svg, img)",
			raw({
				display: "block",
				inlineSize: "100%",
				blockSize: "100%",
				objectFit: "contain",
			}),
		),
	]);
}

/**
 * One sponsor tier: its label, then its marks in a ruled grid scaled by `size`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the tier's markup.
 * @example
 * <SponsorWall.Tier label={t("sponsor.bronze")} size="md">
 * 	<a href={acme}><img src={acmeLogo} alt="Acme" /></a>
 * </SponsorWall.Tier>
 */
SponsorWall.Tier = function SponsorWallTier(handle: Handle<SponsorWall.TierProps>) {
	return () => {
		let { children, label, mix, size, ...rest } = handle.props;
		let resolvedSize = size ?? DEFAULT_TIER_SIZE;
		let Tag = TAG_BY_LEVEL[resolveHeadingLevel(handle)];

		return (
			<div
				{...rest}
				data-slot="sponsor-wall-tier"
				data-size={resolvedSize}
				mix={[vstack({ gap: 4, align: "stretch" }), mix]}
			>
				<Tag data-slot="sponsor-wall-label" data-variant="mono" mix={tierLabel()}>
					{label}
				</Tag>
				<div data-slot="sponsor-wall-marks" mix={[tierGrid(resolvedSize, countMarks(children))]}>
					{children}
				</div>
			</div>
		);
	};
};

/**
 * The individual backers: a centred, wrapping cloud of {@link SponsorWall.Person} circles
 * under an optional label.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the cloud's markup.
 * @example
 * <SponsorWall.Individuals label={t("sponsor.people")}>
 * 	<SponsorWall.Person href={ana.url} name="Ana Souza" src={ana.avatar} size="lg" />
 * </SponsorWall.Individuals>
 */
SponsorWall.Individuals = function SponsorWallIndividuals(
	handle: Handle<SponsorWall.IndividualsProps>,
) {
	return () => {
		let { children, label, mix, ...rest } = handle.props;
		let Tag = TAG_BY_LEVEL[resolveHeadingLevel(handle)];

		return (
			<div
				{...rest}
				data-slot="sponsor-wall-individuals"
				mix={[vstack({ gap: 6, align: "stretch" }), mix]}
			>
				{label ? (
					<Tag data-slot="sponsor-wall-label" data-variant="mono" mix={tierLabel()}>
						{label}
					</Tag>
				) : null}
				<ul
					data-slot="sponsor-wall-people"
					mix={[
						raw({
							listStyle: "none",
							margin: "0",
							padding: "0",
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							justifyContent: "center",
							gap: "0.75rem",
						}),
					]}
				>
					{children}
				</ul>
			</div>
		);
	};
};

/** The initials a backer without a picture shows: the first letter of up to two words. */
function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}

/**
 * One backer's circle in one rule: grayscale until a pointer rests on it or it takes
 * keyboard focus, so a wall of mixed photos reads as one band, and a hit area at least
 * 44px across around even the smallest circle.
 */
function personCircle(diameter: string) {
	return combine([
		raw({
			position: "relative",
			display: "grid",
			placeItems: "center",
			inlineSize: diameter,
			blockSize: diameter,
			borderRadius: "9999px",
			overflow: "visible",
			backgroundColor: "color-mix(in oklch, var(--ui-neutral-fg-emphasis) 10%, transparent)",
			color: "var(--ui-neutral-fg-emphasis)",
			fontSize: `calc(${diameter} * 0.36)`,
			fontWeight: "600",
			textDecoration: "none",
			filter: "grayscale(1)",
			outlineOffset: "2px",
		}),
		when("&:is(:hover, :focus-visible)", raw({ filter: "none" })),
		when(
			"&::after",
			raw({
				content: '""',
				position: "absolute",
				inset: `min(0px, calc((${diameter} - 2.75rem) / 2))`,
				borderRadius: "9999px",
			}),
		),
		when(
			"& > img",
			raw({
				inlineSize: "100%",
				blockSize: "100%",
				borderRadius: "9999px",
				objectFit: "cover",
				outline: "1px solid var(--ui-image-outline, rgb(0 0 0 / 0.1))",
				outlineOffset: "-1px",
			}),
		),
		motionSafe(raw({ transition: "filter 200ms" })),
	]);
}

/**
 * One individual backer: a linked circle with their picture, or their initials, named by
 * `name` for assistive technology and as a tooltip.
 *
 * @param handle Runtime handle carrying the host `<a>`'s props.
 * @returns The render function producing the backer's list item.
 * @example
 * <SponsorWall.Person href="https://github.com/ana" name="Ana Souza" src={ana} size="sm" />
 */
SponsorWall.Person = function SponsorWallPerson(handle: Handle<SponsorWall.PersonProps>) {
	return () => {
		let { href, mix, name, size, src, ...rest } = handle.props;
		let resolvedSize = size ?? DEFAULT_PERSON_SIZE;

		return (
			<li data-slot="sponsor-wall-person" mix={[raw({ display: "flex" })]}>
				<a
					{...rest}
					href={href}
					aria-label={name}
					title={name}
					data-size={resolvedSize}
					mix={[personCircle(PERSON_SIZES[resolvedSize]), mix]}
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
