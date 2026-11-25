/**
 * View for the Malfoid Stickers support page, in the pack's own look: the fixes for the
 * problems people actually hit, then the support form on an ivory card. Each state the
 * controller reaches renders here, and every state but `sent` keeps the visitor's values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Honeypot } from "@sdxc/honeypot";

import { ChevronDownIcon } from "@sdxc/icons";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { gap, grid, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, pbe, pbs, pi } from "@sdxc/u/size";
import { font, overflowWrap, text } from "@sdxc/u/typography";
import { Accordion, Form, Heading, Link, Typeset } from "@sdxc/ui";

import type { PageLocale } from "~/app/services/page-locale";

import {
	MALFOID_SUPPORT_LIMITS,
	MALFOID_SUPPORT_MESSAGE_MIN,
	MALFOID_SUPPORT_PLATFORMS,
	MALFOID_SUPPORT_TOPICS,
} from "~/app/http/validators/malfoid-support";
import { SUPPORT_COPY } from "~/resources/content/malfoid/copy";
import { LANDING_COPY } from "~/resources/content/malfoid/landing";
import { MalfoidLayout } from "~/resources/layouts/malfoid";
import { SupportForm } from "~/resources/views/app-pages/support-form";
import { inLocale, landingHref, StickerImage } from "~/resources/views/malfoid/parts";
import routes from "~/routes/web";

/** Types used by the support page renderer. */
export namespace MalfoidSupportView {
	/** The state the controller reached, which picks the form's alert or the confirmation. */
	export type State = SupportForm.State;

	/** The form's values as the visitor typed them, keyed by field name. */
	export type Values = SupportForm.Values;

	/** Data required to render the page. */
	export interface Model {
		state: State;
		values: Values;
		/** Validation issues by field path, which the form hands each field by name. */
		issues: ReadonlyArray<Form.Issue>;
		/** Freshly issued trap fields; `sent` renders no form and needs none. */
		honeypot?: Honeypot.Fields;
		/** The language the page is written in. English by default. */
		locale?: PageLocale;
	}
}

/**
 * The page: the title beside a thinking Malfoid, the quick fixes as disclosures, and the
 * support form on an ivory card for anything they don't solve.
 *
 * @returns View function rendering the support page for the controller's state.
 */
export function MalfoidSupportView() {
	return ({ model, assets }: { model: MalfoidSupportView.Model; assets: DocumentAssets }) => {
		let { state, values, issues, honeypot } = model;
		let locale = model.locale ?? "en";
		let SUPPORT = SUPPORT_COPY[locale];

		return (
			<MalfoidLayout
				assets={assets}
				copy={LANDING_COPY[locale]}
				bilingual
				title={SUPPORT.title}
				description={SUPPORT.description}
				path={routes.malfoid.support.index.href()}
			>
				<main
					mix={[
						grid(),
						gap(8),
						pi(4),
						pbe(8),
						maxIs("46rem"),
						mi("auto"),
						is("full"),
						at("md", pi(6)),
					]}
				>
					<header
						mix={[
							grid(),
							gap(3),
							pbs(8),
							raw({ gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }),
						]}
					>
						<Heading
							level={1}
							mix={[m(0), font("display"), text("4xl"), overflowWrap("break-word")]}
						>
							{SUPPORT.title}
						</Heading>
						<div
							mix={[
								raw({
									gridColumn: "2",
									gridRow: "1",
									alignSelf: "start",
									inlineSize: "clamp(5rem, 22vw, 7.5rem)",
									rotate: "-4deg",
									"@media (min-width: 48rem)": { gridRow: "1 / span 2" },
								}),
							]}
						>
							<StickerImage id="thinking" sizes="120px" decorative eager />
						</div>
						<Typeset
							preset="reading"
							mix={[
								raw({ gridColumn: "1 / -1", "@media (min-width: 48rem)": { gridColumn: "1" } }),
							]}
						>
							<p>{SUPPORT.intro}</p>
						</Typeset>
					</header>

					<section aria-labelledby="quick-fixes" mix={[vstack({ gap: 4, align: "stretch" })]}>
						<Heading level={2} id="quick-fixes" mix={[m(0), font("display"), text("2xl")]}>
							{SUPPORT.quickFixes}
						</Heading>
						<Accordion
							mix={[vstack({ gap: 3, align: "stretch" }), raw({ borderBlockStartWidth: "0" })]}
						>
							{SUPPORT.troubleshooting.map(([problem, fix]) => (
								<Accordion.Item
									key={problem}
									mix={[
										raw({ paddingInline: "1.25rem", backgroundColor: "var(--app-card)" }),
										rounded("xl"),
									]}
								>
									<Accordion.Trigger>
										{problem}
										<ChevronDownIcon data-slot="icon" aria-hidden="true" />
									</Accordion.Trigger>
									<Accordion.Content>
										<p>{fix}</p>
									</Accordion.Content>
								</Accordion.Item>
							))}
						</Accordion>
						<p mix={[m(0), text("sm")]}>
							{SUPPORT.newToPack}{" "}
							<Link href={`${landingHref(locale)}#install`}>{SUPPORT.installLink}</Link>.
						</p>
					</section>

					<SupportForm
						state={state}
						values={values}
						issues={issues}
						honeypot={honeypot}
						labels={SUPPORT}
						topics={MALFOID_SUPPORT_TOPICS.map((topic) => [topic, SUPPORT.topics[topic]] as const)}
						platforms={MALFOID_SUPPORT_PLATFORMS.map(
							(platform) => [platform, SUPPORT.platforms[platform]] as const,
						)}
						limits={MALFOID_SUPPORT_LIMITS}
						messageMin={MALFOID_SUPPORT_MESSAGE_MIN}
						action={inLocale(routes.malfoid.support.action.href(), locale)}
						againHref={inLocale(routes.malfoid.support.index.href(), locale)}
						privacyHref={inLocale(routes.malfoid.privacy.href(), locale)}
					/>
				</main>
			</MalfoidLayout>
		);
	};
}
