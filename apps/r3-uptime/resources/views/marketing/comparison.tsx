/**
 * `/vs/:slug` comparison page view. Extends the generic marketing page shape
 * (hero, features, how it works, FAQ, final CTA) with a head-to-head comparison
 * table between Uptime and the named competitor, driven by
 * `resources/content/marketing.ts`'s `comparisons` record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { MarketingContent } from "~/resources/content/marketing";

import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import MarketingStep from "~/resources/components/marketing/step";
import * as s from "~/resources/styles";

namespace ComparisonPageView {
	export interface Props extends MarketingContent.ComparisonPage {
		isSignedIn: boolean;
	}
}

export default function ComparisonPageView(handle: Handle<ComparisonPageView.Props>) {
	return () => {
		let {
			isSignedIn,
			badge,
			title,
			highlight,
			description,
			highlights,
			competitor,
			summary,
			rows,
			features,
			steps,
			faqs,
		} = handle.props;

		return (
			<>
				<section mix={[s.marketingHero]}>
					<div mix={[s.marketingContainer]}>
						<span mix={[s.marketingBadge]}>{badge}</span>
						<h1 mix={[s.marketingHeroTitle]}>
							{title} <span mix={[s.marketingHeroHighlight]}>{highlight}</span>
						</h1>
						<p mix={[s.marketingLead]}>{description}</p>

						<div mix={[s.marketingHighlightRow]}>
							{highlights.map((item) => (
								<span key={item} mix={[s.marketingHighlightChip]}>
									✓ {item}
								</span>
							))}
						</div>

						<div mix={[s.marketingActions]}>
							<AuthCta isSignedIn={isSignedIn} />
						</div>
					</div>
				</section>

				<section mix={[s.marketingSection]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader title={`Uptime vs ${competitor}`} description={summary} />

						<div mix={[s.tableScroll]}>
							<table mix={[s.marketingComparisonTable]}>
								<thead>
									<tr>
										<th>Category</th>
										<th>Uptime</th>
										<th>{competitor}</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((row) => (
										<tr key={row.label}>
											<td>{row.label}</td>
											<td>{row.us}</td>
											<td>{row.them}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</section>

				<section mix={[s.marketingSectionAlt]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader title="Why teams switch to Uptime" />

						<div mix={[s.marketingGrid]}>
							{features.map((feature) => (
								<MarketingCard
									key={feature.title}
									title={feature.title}
									description={feature.description}
								/>
							))}
						</div>
					</div>
				</section>

				<section mix={[s.marketingSection]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader title="Getting started" />

						<div mix={[s.marketingSteps]}>
							{steps.map((step) => (
								<MarketingStep key={step.title} title={step.title} description={step.description} />
							))}
						</div>
					</div>
				</section>

				<section mix={[s.marketingSectionAlt]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader title="Frequently asked questions" />

						<FaqAccordion items={faqs.map((faq) => ({ ...faq }))} />
					</div>
				</section>

				<section mix={[s.marketingCtaSection]}>
					<h2>Switch to Uptime</h2>
					<p>Create your first monitor in under 2 minutes. No credit card required to start.</p>

					<div mix={[s.marketingActions]}>
						<AuthCta isSignedIn={isSignedIn} />
					</div>
				</section>
			</>
		);
	};
}
