/**
 * Generic marketing page view shared by `/features/:slug`, `/for/:slug`, and
 * `/use-cases/:slug`. Renders a hero with highlight chips, a feature grid, a
 * numbered "how it works" list, an FAQ accordion (native `<details>`, no client
 * JS), and a final call to action. It exists so those three route families reuse
 * one view instead of near-duplicate ones, driven entirely by
 * `resources/content/marketing.ts` data.
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

namespace MarketingPageView {
	export interface Props extends MarketingContent.Page {
		isSignedIn: boolean;
	}
}

export default function MarketingPageView(handle: Handle<MarketingPageView.Props>) {
	return () => {
		let { isSignedIn, badge, title, highlight, description, highlights, features, steps, faqs } =
			handle.props;

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
						<SectionHeader title="Everything you need" />

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

				<section mix={[s.marketingSectionAlt]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader title="How it works" />

						<div mix={[s.marketingSteps]}>
							{steps.map((step) => (
								<MarketingStep key={step.title} title={step.title} description={step.description} />
							))}
						</div>
					</div>
				</section>

				<section mix={[s.marketingSection]}>
					<div mix={[s.marketingContainer]}>
						<SectionHeader title="Frequently asked questions" />

						<FaqAccordion items={faqs.map((faq) => ({ ...faq }))} />
					</div>
				</section>

				<section mix={[s.marketingCtaSection]}>
					<h2>Start monitoring your services</h2>
					<p>Create your first monitor in under 2 minutes. No credit card required to start.</p>

					<div mix={[s.marketingActions]}>
						<AuthCta isSignedIn={isSignedIn} />
					</div>
				</section>
			</>
		);
	};
}
