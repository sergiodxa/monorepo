/**
 * Wakaba's privacy policy in the app's own look: the policy's Markdown on a white card over
 * cream paper, in the reading rhythm, with a link to the same policy as Markdown.
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
import { flexWrap, gap, grid, hstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, minIs, p, pbe, pbs, pi } from "@sdxc/u/size";
import { font, overflowWrap, text, weight } from "@sdxc/u/typography";
import { Link, Typeset } from "@sdxc/ui";

import type { PageLocale } from "~/app/services/page-locale";

import { inLanguage, WAKABA_PAGES_COPY } from "~/resources/content/wakaba/pages";
import { WakabaLayout } from "~/resources/layouts/wakaba";
import { Mascot, WAKABA_COPY } from "~/resources/views/wakaba/parts";
import routes from "~/routes/web";

/** Types used by the privacy page's renderer. */
export namespace WakabaPrivacyView {
	/** Data required to render the page. */
	export interface Model {
		title: string;
		description: string;
		/** The policy's body, parsed from its Markdown source. */
		document: Markdown.Document;
		/** The language the policy is written in. English by default. */
		locale?: PageLocale;
	}
}

/**
 * The policy page. The title sits on the paper in the display face; the body reads on a
 * white card at a measure that keeps lines short on any screen.
 *
 * @returns View function rendering the policy.
 */
export function WakabaPrivacyView() {
	return ({ model, assets }: { model: WakabaPrivacyView.Model; assets: DocumentAssets }) => {
		let locale = model.locale ?? "en";
		let t = WAKABA_PAGES_COPY[locale].privacy;
		return (
			<WakabaLayout
				assets={assets}
				copy={WAKABA_COPY[locale]}
				bilingual
				title={model.title}
				description={model.description}
				path={routes.wakabaPrivacy.href()}
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
						<h1
							mix={[
								m(0),
								font("display"),
								text("4xl"),
								weight("bold"),
								raw({ letterSpacing: "-0.025em", lineHeight: "1.1" }),
								overflowWrap("break-word"),
							]}
						>
							{model.title}
						</h1>
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
							<Mascot pose="kitsune-study" size="md" tilt={4} />
						</div>
						<p
							mix={[
								m(0),
								hstack({ gap: 4, align: "center" }),
								flexWrap("wrap"),
								text("sm"),
								raw({ gridColumn: "1 / -1", "@media (min-width: 48rem)": { gridColumn: "1" } }),
							]}
						>
							<span mix={[fg("neutral")]}>{t.forLine}</span>
							<Link href={inLanguage(routes.wakabaPrivacyMarkdown.href(), locale)}>
								{t.viewMarkdown}
							</Link>
						</p>
					</header>
					<article
						mix={[
							p(5),
							rounded("xl"),
							minIs(0),
							overflowWrap("break-word"),
							raw({ backgroundColor: "var(--wakaba-card)" }),
							at("md", p(8)),
						]}
					>
						<Typeset preset="reading">{toRemix(model.document)}</Typeset>
					</article>
				</main>
			</WakabaLayout>
		);
	};
}
