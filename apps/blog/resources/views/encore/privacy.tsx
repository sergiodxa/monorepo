/**
 * Encore's privacy policy in the app's own look: the policy's Markdown on a card over the
 * paper or the plum night, in the reading rhythm, with a link to the same policy as Markdown,
 * in the reader's language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Markdown } from "@sdxc/markdown";

import { toRemix } from "@sdxc/markdown/remix";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { flexWrap, hstack } from "@sdxc/u/layout";
import { m, minIs } from "@sdxc/u/size";
import { overflowWrap, text } from "@sdxc/u/typography";
import { Link, Typeset } from "@sdxc/ui";

import type { EncoreLocale } from "~/config/encore";

import { inLanguage } from "~/config/encore";
import { ENCORE_PAGES_COPY } from "~/resources/content/encore";
import { EncoreLayout } from "~/resources/layouts/encore";
import { EncorePage } from "~/resources/views/encore/page";
import routes from "~/routes/web";

/** Types used by the privacy page's renderer. */
export namespace EncorePrivacyView {
	/** Data required to render the page. */
	export interface Model {
		title: string;
		description: string;
		/** The policy's body, parsed from its Markdown source. */
		document: Markdown.Document;
		/** The language the policy is written in. English by default. */
		locale?: EncoreLocale;
	}
}

/**
 * The policy page: the title in the display serif, which devices it covers and the Markdown
 * link, then the body on a card.
 *
 * @returns View function rendering the policy.
 */
export function EncorePrivacyView() {
	return ({ model, assets }: { model: EncorePrivacyView.Model; assets: DocumentAssets }) => {
		let locale = model.locale ?? "en";
		let t = ENCORE_PAGES_COPY[locale].privacy;
		return (
			<EncoreLayout
				assets={assets}
				locale={locale}
				title={model.title}
				description={model.description}
				path={routes.encorePrivacy.href()}
			>
				<EncorePage
					title={model.title}
					tilt={-6}
					width="40rem"
					intro={
						<p mix={[m(0), hstack({ gap: 4, align: "center" }), flexWrap("wrap"), text("sm")]}>
							<span mix={[fg("neutral")]}>{t.forLine}</span>
							<Link href={inLanguage(routes.encorePrivacyMarkdown.href(), locale)}>
								{t.viewMarkdown}
							</Link>
						</p>
					}
				>
					<article
						mix={[
							rounded("xl"),
							minIs(0),
							overflowWrap("break-word"),
							raw({
								padding: "1.25rem",
								backgroundColor: "var(--app-card)",
								"@media (min-width: 48rem)": { padding: "2rem" },
							}),
						]}
					>
						<Typeset preset="reading">{toRemix(model.document)}</Typeset>
					</article>
				</EncorePage>
			</EncoreLayout>
		);
	};
}
