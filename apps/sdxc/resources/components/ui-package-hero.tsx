/**
 * The opening of `/api/ui`: a package pitch beside a live component stage, with the
 * install strip and destinations a catalogue landing needs, rather than the fact sheet
 * that frames every other package's README.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flexWrap, gap, grid, gridTemplate, hstack, items, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, maxIs } from "@sdxc/u/size";
import { font, leading, text, textTransform, tracking, weight } from "@sdxc/u/typography";
import { LinkButton } from "@sdxc/ui";

import InstallCommand from "~/resources/components/install-command";
import PageActions from "~/resources/components/page-actions";
import UiShowcase from "~/resources/components/ui-showcase";
import routes from "~/routes/web";

namespace UiPackageHero {
	export interface Props {
		/** The package name as npm publishes it. */
		name: string;
		/** One-line pitch for the package, drawn under the title. */
		description: string;
		/** Where the Open menu and its markdown twin point. */
		markdownHref: string;
		markdownUrl: string;
		sourceUrl: string;
	}
}

/** Renders the catalogue landing's pitch, install strip and live stage. */
export default function UiPackageHero(handle: Handle<UiPackageHero.Props>) {
	return () => {
		let { description, markdownHref, markdownUrl, name, sourceUrl } = handle.props;

		return (
			<header
				mix={[
					grid(),
					gap(10),
					items("start"),
					gridTemplate({ columns: "minmax(0, 1fr)" }),
					media(
						"(min-width: 56rem)",
						gridTemplate({ columns: "minmax(0, 1.05fr) minmax(0, 0.95fr)" }),
					),
				]}
			>
				<div mix={[vstack({ gap: 6, align: "stretch" }), maxIs("36rem")]}>
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
						<LinkButton href="#components" size="lg" color="brand" variant="solid">
							Browse components
							<ArrowRightIcon size={16} aria-hidden="true" />
						</LinkButton>
						<LinkButton
							href={routes.api.component.href({ component: "theming" })}
							size="lg"
							color="neutral"
							variant="outline"
						>
							Theming
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

				<UiShowcase />
			</header>
		);
	};
}
