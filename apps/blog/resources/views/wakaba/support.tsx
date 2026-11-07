/**
 * View for the Wakaba support page, in the app's own look: what to include in a request,
 * the support form on a white card, and links to the policy and the landing. Each state the controller reaches — idle, sent, invalid, rate-limited,
 * failed, resubmit — renders here, and every state but `sent` keeps the visitor's values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Honeypot } from "@sdxc/honeypot";

import { raw } from "@sdxc/u/general";
import { gap, grid } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, pbe, pbs, pi } from "@sdxc/u/size";
import { font, overflowWrap, text } from "@sdxc/u/typography";
import { Form, Heading, Typeset } from "@sdxc/ui";

import type { PageLocale } from "~/app/services/page-locale";

import {
	WAKABA_SUPPORT_LIMITS as SUPPORT_LIMITS,
	WAKABA_SUPPORT_MESSAGE_MIN as SUPPORT_MESSAGE_MIN,
	WAKABA_SUPPORT_PLATFORMS as SUPPORT_PLATFORMS,
	WAKABA_SUPPORT_TOPICS as SUPPORT_TOPICS,
} from "~/app/http/validators/wakaba-support";
import { inLanguage, WAKABA_PAGES_COPY } from "~/resources/content/wakaba/pages";
import { WakabaLayout } from "~/resources/layouts/wakaba";
import { SupportForm } from "~/resources/views/app-pages/support-form";
import { Mascot, WAKABA_COPY } from "~/resources/views/wakaba/parts";
import routes from "~/routes/web";

/**
 * Types used by the Wakaba support page renderer.
 */
export namespace WakabaSupportView {
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
 * The page: the title with Tanuki listening, what to include in a request, and the support
 * form on a white card.
 *
 * @returns View function rendering the support page for the controller's state.
 */
export function WakabaSupportView() {
	return ({ model, assets }: { model: WakabaSupportView.Model; assets: DocumentAssets }) => {
		let { state, values, issues, honeypot } = model;
		let locale = model.locale ?? "en";
		let t = WAKABA_PAGES_COPY[locale].support;
		let action = inLanguage(routes.wakabaSupport.action.href(), locale);

		return (
			<WakabaLayout
				assets={assets}
				copy={WAKABA_COPY[locale]}
				bilingual
				title={t.title}
				description={t.description}
				path={routes.wakabaSupport.index.href()}
			>
				<main
					mix={[
						grid(),
						gap(6),
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
							{t.title}
						</Heading>
						<div
							mix={[
								raw({
									gridColumn: "2",
									gridRow: "1",
									alignSelf: "start",
									"@media (min-width: 48rem)": { gridRow: "1 / span 2" },
								}),
							]}
						>
							<Mascot pose="tanuki-listening" size="md" tilt={4} />
						</div>
						<Typeset
							preset="reading"
							mix={[
								raw({ gridColumn: "1 / -1", "@media (min-width: 48rem)": { gridColumn: "1" } }),
							]}
						>
							<p>{t.intro[0]}</p>
							<p>{t.intro[1]}</p>
						</Typeset>
					</header>

					<SupportForm
						state={state}
						values={values}
						issues={issues}
						honeypot={honeypot}
						labels={t}
						topics={SUPPORT_TOPICS.map((topic) => [topic, t.topics[topic]] as const)}
						platforms={SUPPORT_PLATFORMS.map(
							(platform) => [platform, t.platforms[platform]] as const,
						)}
						limits={SUPPORT_LIMITS}
						messageMin={SUPPORT_MESSAGE_MIN}
						action={action}
						againHref={inLanguage(routes.wakabaSupport.index.href(), locale)}
						privacyHref={inLanguage(routes.wakabaPrivacy.href(), locale)}
					/>
				</main>
			</WakabaLayout>
		);
	};
}
