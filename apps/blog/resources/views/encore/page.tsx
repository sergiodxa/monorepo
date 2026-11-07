/**
 * The frame of Encore's privacy and support pages: a reading column under the shell, its title
 * in the display serif beside a drawn card back, and the lines under the title. The page's
 * body follows on a card of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { gap, grid } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, pbe, pbs, pi } from "@sdxc/u/size";
import { font, overflowWrap, text, weight } from "@sdxc/u/typography";

import { PlayingCard } from "~/resources/views/encore/parts";

/** Props of the page frame. */
export interface EncorePageProps {
	title: string;
	/** What sits under the title: an introduction, a format link. */
	intro: RemixNode;
	/** The page's body, under the header. */
	children: RemixNode;
	/** Which way the card beside the title leans, in degrees. */
	tilt?: number;
	/**
	 * The column's widest size: the default suits a form; a page of prose takes a narrower
	 * one so its lines stay near 65 characters.
	 * @default "46rem"
	 */
	width?: string;
}

/**
 * The page's `main`: one `h1`, a card back beside it, the intro under it and the body below,
 * at a measure that keeps lines short on any screen.
 *
 * @param handle Runtime handle carrying the title, the intro and the body.
 * @returns The render function producing the page.
 */
export function EncorePage(handle: Handle<EncorePageProps>) {
	return () => {
		let { children, intro, tilt = 6, title, width = "46rem" } = handle.props;
		return (
			<main
				mix={[grid(), gap(6), pi(4), pbe(8), maxIs(width), mi("auto"), is("full"), at("md", pi(6))]}
			>
				<header
					mix={[
						grid(),
						gap(3),
						pbs(8),
						raw({ gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }),
					]}
				>
					<h1
						mix={[
							m(0),
							font("display"),
							text("4xl"),
							weight("bold"),
							raw({ letterSpacing: "-0.015em", lineHeight: "1.1" }),
							overflowWrap("break-word"),
						]}
					>
						{title}
					</h1>
					<div
						aria-hidden="true"
						mix={[
							raw({
								gridColumn: "2",
								gridRow: "1",
								alignSelf: "start",
								inlineSize: "clamp(3.5rem, 14vw, 5.5rem)",
								rotate: `${tilt}deg`,
								"@media (min-width: 48rem)": { gridRow: "1 / span 2" },
							}),
						]}
					>
						<PlayingCard faceDown />
					</div>
					<div
						mix={[raw({ gridColumn: "1 / -1", "@media (min-width: 48rem)": { gridColumn: "1" } })]}
					>
						{intro}
					</div>
				</header>
				{children}
			</main>
		);
	};
}
