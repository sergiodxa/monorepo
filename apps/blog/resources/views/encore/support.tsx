/**
 * View for the Encore support page, in the app's own look and the reader's language: what to
 * include in a request, then the support form on a card. Each state the controller reaches —
 * idle, sent, invalid, rate-limited, failed, resubmit — renders the form's matching alert.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Honeypot } from "@sdxc/honeypot";
import type { Form } from "@sdxc/ui";

import { Typeset } from "@sdxc/ui";

import type { EncoreLocale } from "~/config/encore";

import {
	SUPPORT_LIMITS,
	SUPPORT_MESSAGE_MIN,
	SUPPORT_PLATFORMS,
	SUPPORT_TOPICS,
} from "~/app/http/validators/encore-support";
import { inLanguage } from "~/config/encore";
import { ENCORE_PAGES_COPY } from "~/resources/content/encore";
import { EncoreLayout } from "~/resources/layouts/encore";
import { SupportForm } from "~/resources/views/app-pages/support-form";
import { EncorePage } from "~/resources/views/encore/page";
import routes from "~/routes/web";

/** Types used by the Encore support page renderer. */
export namespace EncoreSupportView {
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
		locale?: EncoreLocale;
	}
}

/**
 * The page: the title beside a card back, what to include in a request, and the form.
 *
 * @returns View function rendering the support page for the controller's state.
 */
export function EncoreSupportView() {
	return ({ model, assets }: { model: EncoreSupportView.Model; assets: DocumentAssets }) => {
		let { honeypot, issues, state, values } = model;
		let locale = model.locale ?? "en";
		let t = ENCORE_PAGES_COPY[locale].support;

		return (
			<EncoreLayout
				assets={assets}
				locale={locale}
				title={t.title}
				description={t.description}
				path={routes.encoreSupport.index.href()}
			>
				<EncorePage
					title={t.title}
					intro={
						<Typeset preset="reading">
							<p>{t.intro[0]}</p>
							<p>{t.intro[1]}</p>
						</Typeset>
					}
				>
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
						action={inLanguage(routes.encoreSupport.action.href(), locale)}
						againHref={inLanguage(routes.encoreSupport.index.href(), locale)}
						privacyHref={inLanguage(routes.encorePrivacy.href(), locale)}
					/>
				</EncorePage>
			</EncoreLayout>
		);
	};
}
