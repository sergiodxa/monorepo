/**
 * The opening of `/api/ui`: brand, install, and a strip of frosted component faces — the
 * package shown as itself, not as a fact sheet or a decorative collage card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { LayoutGridIcon } from "sdxc/icons";
import { bg, border, fg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { raw } from "sdxc/u/general";
import { flexWrap, gap, grid, gridTemplate, hstack, repeat, vstack } from "sdxc/u/layout";
import { clip, overflow } from "sdxc/u/overflow";
import { media } from "sdxc/u/responsive";
import { bs, m, maxIs, minBs, p } from "sdxc/u/size";
import { font, leading, text, textTransform, tracking, weight } from "sdxc/u/typography";
import { Button, LinkButton } from "sdxc/ui";

import { componentFaceHref } from "~/app/services/ui-component-face";
import InstallCommand from "~/resources/components/install-command";
import PageActions from "~/resources/components/page-actions";
import { UI_EXPLORE_DIALOG_ID } from "~/resources/components/ui-explore-dialog";
import routes from "~/routes/web";

/**
 * Signature components whose faces open the landing. Each one already has a silhouette
 * in the face catalogue, so the strip matches the explorer tiles below.
 */
const FEATURED = [
	{ slug: "button", title: "Button" },
	{ slug: "badge", title: "Badge" },
	{ slug: "dialog", title: "Dialog" },
	{ slug: "command", title: "Command" },
] as const;

namespace UiPackageHero {
	export interface Props {
		/** The package name as npm publishes it. */
		name: string;
		/** One-line pitch for the package, drawn under the title. */
		description: string;
		/** How many components the explorer lists. */
		componentCount: number;
		/** Where the Open menu and its markdown twin point. */
		markdownHref: string;
		markdownUrl: string;
		sourceUrl: string;
	}
}

/** Renders the landing pitch, install strip and featured frosted faces. */
export default function UiPackageHero(handle: Handle<UiPackageHero.Props>) {
	return () => {
		let { componentCount, description, markdownHref, markdownUrl, name, sourceUrl } = handle.props;

		return (
			<header mix={[vstack({ gap: 10, align: "stretch" })]}>
				<div mix={[vstack({ gap: 6, align: "stretch" }), maxIs("40rem")]}>
					<div mix={[vstack({ gap: 4, align: "start" })]}>
						<p
							mix={[
								m(0),
								font("mono"),
								text("xs"),
								textTransform("uppercase"),
								tracking("widest"),
								fg("brand"),
							]}
						>
							[ Interface ]
						</p>

						<h1
							mix={[
								m(0),
								font("mono"),
								text("4xl"),
								weight("medium"),
								tracking("tight"),
								leading(1.05),
								fg("neutral.emphasis"),
								media("(min-width: 48rem)", text("5xl")),
							]}
						>
							{name}
						</h1>

						<p mix={[m(0), text("lg"), leading("relaxed"), fg("neutral")]}>{description}</p>
					</div>

					<div mix={[hstack({ gap: 3, align: "center" }), flexWrap()]}>
						<Button
							type="button"
							size="lg"
							color="brand"
							variant="solid"
							commandfor={UI_EXPLORE_DIALOG_ID}
							command="show-modal"
						>
							<LayoutGridIcon size={16} aria-hidden="true" />
							Explore components
						</Button>
						<LinkButton
							href={routes.api.component.href({ component: "theming" })}
							size="lg"
							color="neutral"
							variant="outline"
						>
							Theming
						</LinkButton>
						<LinkButton href="#components" size="lg" color="neutral" variant="ghost">
							{componentCount} on this page
						</LinkButton>
					</div>

					<InstallCommand command={`npm add ${name}`}>{null}</InstallCommand>

					<p mix={[m(0), text("sm"), leading("relaxed"), fg("neutral")]}>
						Built on native <code mix={[font("mono"), text("sm")]}>&lt;dialog&gt;</code>, the
						Popover API and Invoker Commands — pages render before any script loads.
					</p>

					<PageActions
						markdownHref={markdownHref}
						markdownUrl={markdownUrl}
						sourceUrl={sourceUrl}
					/>
				</div>

				<section mix={[vstack({ gap: 3, align: "stretch" })]} aria-label="Featured components">
					<p
						mix={[
							m(0),
							font("mono"),
							text("xs"),
							textTransform("uppercase"),
							tracking("widest"),
							fg("neutral"),
						]}
					>
						Gallery
					</p>

					<div
						mix={[
							grid(),
							gap(3),
							gridTemplate({ columns: "1fr" }),
							media("(min-width: 40rem)", gridTemplate({ columns: repeat(2, "1fr") })),
							media("(min-width: 64rem)", gridTemplate({ columns: repeat(4, "1fr") })),
						]}
					>
						{FEATURED.map((feature) => (
							<a
								key={feature.slug}
								href={routes.api.component.href({ component: feature.slug })}
								mix={[
									vstack({ gap: 2, align: "stretch" }),
									rounded("xl"),
									border({ color: "neutral.border", width: 1, style: "solid" }),
									bg(),
									overflow("hidden"),
									raw({ textDecoration: "none", color: "inherit" }),
								]}
							>
								<div mix={[clip(), minBs("9rem"), bs("9rem"), bg("neutral.tint")]}>
									<img
										src={componentFaceHref(feature.slug)}
										alt=""
										width={320}
										height={200}
										decoding="async"
										mix={[
											bs("100%"),
											raw({ objectFit: "cover", display: "block", inlineSize: "100%" }),
										]}
									/>
								</div>
								<span mix={[p(0, 3, 3, 3), font("mono"), text("sm"), weight("semibold")]}>
									{feature.title}
								</span>
							</a>
						))}
					</div>
				</section>
			</header>
		);
	};
}
