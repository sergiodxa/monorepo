/**
 * The opening of `/api/ui`: brand and install — the package shown as itself, with the
 * component catalogue below rather than a featured strip that repeats the same faces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, maxIs } from "@sdxc/u/size";
import { font, leading, text, textTransform, tracking, weight } from "@sdxc/u/typography";
import { LinkButton } from "@sdxc/ui";
import { InstallCommand } from "@sdxc/ui/docs";

import { PACKAGE_MANAGER_KEY, REMEMBERED_TABS } from "~/app/services/remembered-tabs";
import { CODE_LABELS, TERMINAL_TITLE } from "~/resources/components/docs-labels";
import PageActions from "~/resources/components/page-actions";
import routes from "~/routes/web";

namespace UiPackageHero {
	export interface Props {
		/** The package name as npm publishes it. */
		name: string;
		/** One-line pitch for the package, drawn under the title. */
		description: string;
		/** Specifiers the install strip offers, peers included. */
		packages: string[];
		/** The package manager the cookie last remembered. */
		manager: string | undefined;
		/** Where the Open menu and its markdown twin point. */
		markdownHref: string;
		markdownUrl: string;
		sourceUrl: string;
	}
}

/** Renders the landing pitch and install strip. */
export default function UiPackageHero(handle: Handle<UiPackageHero.Props>) {
	return () => {
		let {
			description,
			manager,
			markdownHref,
			markdownUrl,
			name,
			packages: installPackages,
			sourceUrl,
		} = handle.props;

		return (
			<header mix={[vstack({ gap: 6, align: "stretch" }), maxIs("40rem")]}>
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
					<LinkButton
						href={routes.api.component.href({ component: "theming" })}
						size="lg"
						color="brand"
						variant="solid"
					>
						Theming
					</LinkButton>
				</div>

				<InstallCommand
					packages={installPackages}
					persist="cookie"
					selected={manager}
					title={TERMINAL_TITLE}
					labels={CODE_LABELS}
					aria-label={REMEMBERED_TABS[PACKAGE_MANAGER_KEY].label}
				/>

				<p mix={[m(0), text("sm"), leading("relaxed"), fg("neutral")]}>
					Built on native <code mix={[font("mono"), text("sm")]}>&lt;dialog&gt;</code>, the Popover
					API and Invoker Commands — pages render before any script loads.
				</p>

				<PageActions markdownHref={markdownHref} markdownUrl={markdownUrl} sourceUrl={sourceUrl} />
			</header>
		);
	};
}
