/**
 * The showcase page's two views of the same list: a window charting how many packages
 * each application installs against the whole collection, and one card per application
 * saying what reading its source is worth. Both read the counted showcase entries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowUpRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, leading, text, weight } from "@sdxc/u/typography";
import { Badge, Feature, LinkButton } from "@sdxc/ui";

import type { ShowcaseEntry } from "~/app/services/showcase";

import FramedPanel from "~/resources/components/framed-panel";

/** The ruling between chart rows, the hairline every marketing surface uses. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

namespace ShowcaseDepth {
	export interface Props {
		applications: ShowcaseEntry[];
		/** How many packages the collection publishes, which every bar is drawn against. */
		published: number;
	}
}

/**
 * Charts each application's package count as a bar measured against every published
 * package, so how deep into the set an application goes reads at a glance. Each row
 * links to that application's card further down the page.
 */
export function ShowcaseDepth(handle: Handle<ShowcaseDepth.Props>) {
	return () => {
		let { applications, published } = handle.props;

		return (
			<FramedPanel
				title="@sdxc/* installed, per app"
				label="Packages each application installs"
				footer={`Each bar is drawn against all ${published} published packages.`}
			>
				<ol mix={[m(0), p(0), raw({ listStyle: "none", marginBlockEnd: "-1px" })]}>
					{applications.map((application) => (
						<li key={application.directory} mix={[raw({ boxShadow: `0 1px 0 ${HAIRLINE}` })]}>
							<a
								href={`#app-${application.directory}`}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "6.5rem minmax(0, 1fr) 2rem",
										alignItems: "center",
										columnGap: "0.75rem",
										boxSizing: "border-box",
										minBlockSize: "2.75rem",
										paddingInline: "1rem",
										paddingBlock: "0.5rem",
										textDecoration: "none",
										outlineOffset: "-2px",
									}),
									when(
										"&:hover",
										raw({ backgroundColor: "color-mix(in oklch, CanvasText 3%, transparent)" }),
									),
								]}
							>
								<span
									mix={[
										font("mono"),
										text("sm"),
										weight("medium"),
										fg("neutral.emphasis"),
										raw({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
									]}
								>
									{application.title}
								</span>
								<span
									aria-hidden="true"
									mix={[
										raw({
											display: "block",
											blockSize: "0.5rem",
											borderRadius: "9999px",
											backgroundColor: "color-mix(in oklch, CanvasText 7%, transparent)",
											overflow: "hidden",
										}),
									]}
								>
									<span
										mix={[
											raw({
												display: "block",
												blockSize: "100%",
												inlineSize: `${Math.min(100, (application.packageCount / Math.max(1, published)) * 100)}%`,
												borderRadius: "inherit",
												backgroundColor: "var(--ui-brand-bg-solid)",
											}),
										]}
									/>
								</span>
								<span
									mix={[
										font("mono"),
										text("sm"),
										fg("neutral.emphasis"),
										raw({ textAlign: "end", fontVariantNumeric: "tabular-nums" }),
									]}
								>
									{application.packageCount}
								</span>
							</a>
						</li>
					))}
				</ol>
			</FramedPanel>
		);
	};
}

namespace ShowcaseCard {
	export interface Props {
		application: ShowcaseEntry;
	}
}

/**
 * One application's card: its name and package count, what it does, what reading it is
 * worth, and where to open it. An application with no deployment carries a "Source only"
 * badge and links its source alone, so unshipped code stays listed and says so.
 */
export function ShowcaseCard(handle: Handle<ShowcaseCard.Props>) {
	return () => {
		let { application } = handle.props;

		return (
			<Feature id={`app-${application.directory}`} mix={[raw({ scrollMarginBlockStart: "6rem" })]}>
				<div mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
					<Feature.Title mix={[font("mono")]}>{application.title}</Feature.Title>
					<Badge color="brand">{application.packageCount} packages</Badge>
					{application.href === null ? <Badge color="neutral">Source only</Badge> : null}
				</div>

				<Feature.Description mix={[raw({ flexGrow: 1 })]}>
					<p mix={[m(0), fg("neutral.emphasis"), leading("snug")]}>{application.summary}</p>
					<p mix={[m(0)]}>{application.study}</p>
				</Feature.Description>

				<Feature.Action mix={[raw({ flexWrap: "wrap" })]}>
					{application.href ? (
						<LinkButton
							href={application.href}
							rel="noreferrer"
							size="sm"
							color="neutral"
							variant="outline"
						>
							Open it
							<ArrowUpRightIcon size={14} aria-hidden="true" />
						</LinkButton>
					) : null}
					<LinkButton
						href={application.sourceHref}
						rel="noreferrer"
						size="sm"
						color="neutral"
						variant="outline"
					>
						Read the source
						<ArrowUpRightIcon size={14} aria-hidden="true" />
					</LinkButton>
				</Feature.Action>
			</Feature>
		);
	};
}
