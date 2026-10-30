/**
 * The book page's sticky bar: the mark, the page's sections and a buy button. From the `lg`
 * container down the sections fold into a native popover, opened by a button the browser
 * wires itself, so the menu works before and without any script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MenuIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { backdropBlur, rounded } from "@sdxc/u/effects";
import { combine, raw } from "@sdxc/u/general";
import { container, flex, hidden, hstack, inlineFlex, insBs, sticky, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, p } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { hover } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Button, LinkButton, NavLink } from "@sdxc/ui";
import { marketingContainer, marketingCtaChrome, marketingSurface } from "@sdxc/ui/styles";

import BookLogo from "~/resources/views/demos/book/logo";

/** The sections the bar links to, in page order. */
const SECTIONS = [
	["#learn", "What you’ll learn"],
	["#contents", "Contents"],
	["#sample", "Free chapter"],
	["#author", "Author"],
	["#pricing", "Pricing"],
] as const;

/** Id the phone menu's trigger and popover share. */
const MENU_ID = "book-menu";

/**
 * Renders the bar over a blurred, translucent page colour, so the band beneath shows
 * through as the reader scrolls and the bar still reads above it.
 *
 * @returns The render function producing the header.
 */
export default function BookHeader() {
	return () => (
		<header
			mix={[
				sticky(),
				insBs(0),
				z(20),
				container("book-header"),
				backdropBlur("md"),
				raw({
					backgroundColor: "color-mix(in oklch, var(--ui-bg) 84%, transparent)",
					borderBlockEnd: "1px solid var(--ui-marketing-hairline)",
				}),
			]}
		>
			<div
				mix={[
					marketingContainer(),
					hstack({ gap: 6, align: "center", justify: "between" }),
					bs("4rem"),
				]}
			>
				<BookLogo />

				<nav
					aria-label="Sections"
					mix={[combine([hidden(), at("lg", [flex(), hstack({ gap: 7, align: "center" })])])]}
				>
					{SECTIONS.map(([href, label]) => (
						<NavLink key={href} href={href} mix={[text("sm")]}>
							{label}
						</NavLink>
					))}
				</nav>

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<LinkButton href="#pricing" color="brand" size="sm" mix={[marketingCtaChrome()]}>
						Buy the book
					</LinkButton>
					<span mix={[combine([inlineFlex(), at("lg", hidden())])]}>
						<Button
							popovertarget={MENU_ID}
							color="neutral"
							variant="ghost"
							size="sm"
							aria-label="Open the section menu"
						>
							<MenuIcon aria-hidden="true" />
						</Button>
					</span>
				</div>
			</div>

			<div
				id={MENU_ID}
				popover="auto"
				mix={[
					marketingSurface(),
					raw({
						position: "fixed",
						inset: "4.5rem 1rem auto",
						margin: "0",
						border: "0",
						inlineSize: "auto",
						color: "inherit",
					}),
					p(2),
				]}
			>
				<nav aria-label="Sections" mix={[vstack({ gap: 0, align: "stretch" })]}>
					{SECTIONS.map(([href, label]) => (
						<a
							key={href}
							href={href}
							mix={[
								p(3, 4),
								rounded("md"),
								text("base"),
								weight("medium"),
								fg("neutral.emphasis"),
								is("100%"),
								hover(bg("neutral.bg-tint-hover")),
							]}
						>
							{label}
						</a>
					))}
				</nav>
			</div>
		</header>
	);
}
