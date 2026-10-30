/**
 * Rooftree's own header and footer. The header sticks under a frosted hairline and folds
 * its links into a native popover on phones; the footer closes the page with the
 * download badges, four link columns and the legal line. Every link stays on this page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MenuIcon, XIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, hstack, sticky, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { hover, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Button, LinkButton } from "@sdxc/ui";
import { marketingContainer, marketingCtaChrome } from "@sdxc/ui/styles";

import { Wordmark } from "~/resources/views/demos/app/brand";
import { StoreBadges } from "~/resources/views/demos/app/store-badges";

/** The header's sections, in the order the page reaches them. */
const NAV = [
	{ href: "#features", label: "Features" },
	{ href: "#privacy", label: "Privacy" },
	{ href: "#pricing", label: "Pricing" },
	{ href: "#faq", label: "FAQ" },
] as const;

/** The footer's columns, each a heading over links to this page's sections. */
const FOOTER_COLUMNS = [
	{
		title: "Product",
		links: [
			["Shared lists", "#features"],
			["Chore rota", "#features"],
			["Meal planning", "#features"],
			["Pricing", "#pricing"],
		],
	},
	{
		title: "Platforms",
		links: [
			["iPhone & iPad", "#download"],
			["Android", "#download"],
			["Mac & Windows", "#platforms"],
			["Apple Watch", "#platforms"],
		],
	},
	{
		title: "Trust",
		links: [
			["Privacy", "#privacy"],
			["Encryption", "#privacy"],
			["Reviews", "#stories"],
		],
	},
	{
		title: "Help",
		links: [
			["Questions", "#faq"],
			["Moving from paper", "#faq"],
			["Download", "#download"],
		],
	},
] as const;

/**
 * The sticky header: the wordmark, the section links and the download button from the
 * `lg` container up, and a menu button opening the same links in a popover below it,
 * so a phone keeps one row for the brand and the call.
 *
 * @returns The render function producing the header.
 */
export function SiteHeader() {
	return () => (
		<header
			mix={[
				sticky(),
				container("rooftree-header"),
				raw({
					insetBlockStart: "0",
					zIndex: "40",
					backgroundColor: "color-mix(in oklch, var(--ui-bg) 82%, transparent)",
					backdropFilter: "blur(14px) saturate(1.5)",
					borderBlockEnd: "1px solid var(--ui-marketing-hairline)",
				}),
			]}
		>
			<div
				mix={[
					marketingContainer(),
					hstack({ gap: 4, align: "center", justify: "between" }),
					raw({ blockSize: "4rem" }),
				]}
			>
				<a href="#top" aria-label="Rooftree, back to top" mix={[raw({ textDecoration: "none" })]}>
					<Wordmark />
				</a>

				<nav
					aria-label="Sections"
					mix={[
						combine([raw({ display: "none", gap: "2rem" }), at("lg", raw({ display: "flex" }))]),
					]}
				>
					{NAV.map((item) => (
						<a
							key={item.href}
							href={item.href}
							mix={[
								text("sm"),
								weight("medium"),
								fg("neutral"),
								raw({ textDecoration: "none" }),
								hover(fg("neutral.emphasis")),
							]}
						>
							{item.label}
						</a>
					))}
				</nav>

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<a
						href="#pricing"
						mix={[
							combine([raw({ display: "none" }), at("md", raw({ display: "inline" }))]),
							text("sm"),
							weight("medium"),
							fg("neutral"),
							raw({ textDecoration: "none", paddingInline: "0.75rem" }),
							hover(fg("neutral.emphasis")),
						]}
					>
						Sign in
					</a>
					<LinkButton href="#download" color="brand" size="sm" mix={[marketingCtaChrome()]}>
						Download
					</LinkButton>
					<Button
						variant="ghost"
						size="sm"
						commandfor="rooftree-menu"
						command="toggle-popover"
						aria-label="Open the menu"
						mix={[combine([raw({ display: "inline-flex" }), at("lg", raw({ display: "none" }))])]}
					>
						<MenuIcon size={20} />
					</Button>
				</div>
			</div>

			<nav
				id="rooftree-menu"
				popover="auto"
				aria-label="Sections"
				mix={[
					combine([
						raw({ display: "none", flexDirection: "column", gap: "0.25rem" }),
						when("&:popover-open", raw({ display: "flex" })),
					]),
					raw({
						position: "fixed",
						inset: "4.5rem 0.75rem auto",
						inlineSize: "auto",
						maxInlineSize: "none",
						margin: "0",
						padding: "0.75rem",
						border: "0",
						borderRadius: "1rem",
						backgroundColor: "var(--ui-surface-raised)",
						color: "inherit",
						boxShadow: "var(--ui-shadow-stage), 0 24px 48px -16px rgb(0 0 0 / 0.25)",
					}),
				]}
			>
				<div
					mix={[
						hstack({ gap: 2, align: "center", justify: "between" }),
						raw({ paddingInlineStart: "0.75rem" }),
					]}
				>
					<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Menu</span>
					<Button
						variant="ghost"
						size="sm"
						commandfor="rooftree-menu"
						command="hide-popover"
						aria-label="Close the menu"
					>
						<XIcon size={18} />
					</Button>
				</div>
				{NAV.map((item) => (
					<a
						key={item.href}
						href={item.href}
						mix={[
							text("base"),
							weight("medium"),
							fg("neutral.emphasis"),
							raw({ textDecoration: "none", padding: "0.75rem", borderRadius: "0.625rem" }),
							hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
						]}
					>
						{item.label}
					</a>
				))}
				<LinkButton
					href="#download"
					color="brand"
					mix={[marketingCtaChrome(), raw({ marginBlockStart: "0.5rem" })]}
				>
					Download Rooftree
				</LinkButton>
			</nav>
		</header>
	);
}

/**
 * The page footer: the wordmark, a line on what Rooftree is and the badges, beside four
 * link columns that reflow from two to four; the legal line sits under a hairline.
 *
 * @returns The render function producing the footer.
 */
export function SiteFooter() {
	return () => (
		<footer
			mix={[
				container("rooftree-footer"),
				raw({ borderBlockStart: "1px solid var(--ui-marketing-hairline)" }),
			]}
		>
			<div
				mix={[
					marketingContainer(),
					vstack({ gap: 12, align: "stretch" }),
					raw({ paddingBlock: "4rem 2.5rem" }),
				]}
			>
				<div
					mix={[
						combine([
							raw({ display: "grid", gap: "3rem", gridTemplateColumns: "1fr" }),
							at("lg", raw({ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.6fr)" })),
						]),
					]}
				>
					<div mix={[vstack({ gap: 5, align: "start" })]}>
						<Wordmark />
						<p
							mix={[text("sm"), fg("neutral"), raw({ maxInlineSize: "22rem", lineHeight: "1.6" })]}
						>
							One shared list, rota and calendar for everyone under your roof. Made by a small team
							in Lisbon.
						</p>
						<StoreBadges />
					</div>
					<div
						mix={[
							combine([
								raw({
									display: "grid",
									gap: "2.5rem 2rem",
									gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
								}),
								at("md", raw({ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" })),
							]),
						]}
					>
						{FOOTER_COLUMNS.map((column) => (
							<div key={column.title} mix={[vstack({ gap: 4, align: "start" })]}>
								<h2 mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
									{column.title}
								</h2>
								<ul
									mix={[
										vstack({ gap: 3, align: "start" }),
										raw({ listStyle: "none", margin: "0", padding: "0" }),
									]}
								>
									{column.links.map(([label, href]) => (
										<li key={label}>
											<a
												href={href}
												mix={[
													text("sm"),
													fg("neutral"),
													raw({ textDecoration: "none" }),
													hover(fg("neutral.emphasis")),
												]}
											>
												{label}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
				<div
					mix={[
						hstack({ gap: 4, align: "center", justify: "between" }),
						text("xs"),
						fg("neutral.muted"),
						raw({
							flexWrap: "wrap",
							paddingBlockStart: "2rem",
							borderBlockStart: "1px solid var(--ui-marketing-hairline)",
						}),
					]}
				>
					<span>© 2026 Rooftree Labs. A demo landing; Rooftree is not a real app.</span>
					<span mix={[hstack({ gap: 5, align: "center" })]}>
						<a
							href="#privacy"
							mix={[
								raw({ color: "inherit", textDecoration: "none" }),
								hover(fg("neutral.emphasis")),
							]}
						>
							Privacy
						</a>
						<a
							href="#faq"
							mix={[
								raw({ color: "inherit", textDecoration: "none" }),
								hover(fg("neutral.emphasis")),
							]}
						>
							Terms
						</a>
						<a
							href="#top"
							mix={[
								raw({ color: "inherit", textDecoration: "none" }),
								hover(fg("neutral.emphasis")),
							]}
						>
							Back to top
						</a>
					</span>
				</div>
			</div>
		</footer>
	);
}
