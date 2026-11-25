/**
 * Malfoid Stickers' privacy policy in the pack's own look: the policy's Markdown on an ivory
 * card over the silver-mint ground, in the reading rhythm, with a link to the same policy as
 * Markdown.
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

import { MalfoidLayout } from "~/resources/layouts/malfoid";
import { StickerImage } from "~/resources/views/malfoid/parts";
import routes from "~/routes/web";

/** Types used by the privacy page's renderer. */
export namespace MalfoidPrivacyView {
	/** Data required to render the page. */
	export interface Model {
		title: string;
		description: string;
		/** The policy's body, parsed from its Markdown source. */
		document: Markdown.Document;
	}
}

/**
 * The policy page. The title sits on the ground in the display serif beside Malfoid holding
 * her tea, unbothered; the body reads on an ivory card at a measure that keeps lines short.
 *
 * @returns View function rendering the policy.
 */
export function MalfoidPrivacyView() {
	return ({ model, assets }: { model: MalfoidPrivacyView.Model; assets: DocumentAssets }) => (
		<MalfoidLayout
			assets={assets}
			title={model.title}
			description={model.description}
			path={routes.malfoid.privacy.href()}
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
							weight("semibold"),
							raw({ letterSpacing: "-0.02em", lineHeight: "1.1" }),
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
								inlineSize: "clamp(5rem, 22vw, 7.5rem)",
								rotate: "4deg",
								"@media (min-width: 48rem)": { gridRow: "1 / span 2" },
							}),
						]}
					>
						<StickerImage id="holding-tea" sizes="120px" decorative eager />
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
						<span mix={[fg("neutral")]}>For the iMessage sticker pack on iPhone and iPad.</span>
						<Link href={routes.malfoid.privacyMarkdown.href()}>View as Markdown</Link>
					</p>
				</header>
				<article
					mix={[
						p(5),
						rounded("xl"),
						minIs(0),
						overflowWrap("break-word"),
						raw({ backgroundColor: "var(--app-card)" }),
						at("md", p(8)),
					]}
				>
					<Typeset preset="reading">{toRemix(model.document)}</Typeset>
				</article>
			</main>
		</MalfoidLayout>
	);
}
