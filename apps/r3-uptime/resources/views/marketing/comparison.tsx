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

import * as s from "~/resources/styles";
import routes from "~/routes/web";

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
							{isSignedIn ? (
								<a href={routes.app.index.href()} mix={[s.buttonPrimary]}>
									Go to dashboard
								</a>
							) : (
								<form method="post" action={routes.auth.action.href()}>
									<button type="submit" mix={[s.buttonPrimary]}>
										Start Monitoring
									</button>
								</form>
							)}
						</div>
					</div>
				</section>

				<section mix={[s.marketingSection]}>
					<div mix={[s.marketingContainer]}>
						<div mix={[s.marketingSectionHeader]}>
							<h2>Uptime vs {competitor}</h2>
							<p mix={[s.marketingLead]}>{summary}</p>
						</div>

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
				</section>

				<section mix={[s.marketingSectionAlt]}>
					<div mix={[s.marketingContainer]}>
						<div mix={[s.marketingSectionHeader]}>
							<h2>Why teams switch to Uptime</h2>
						</div>

						<div mix={[s.marketingGrid]}>
							{features.map((feature) => (
								<div key={feature.title} mix={[s.marketingCard]}>
									<h3 mix={[s.marketingCardTitle]}>{feature.title}</h3>
									<p mix={[s.marketingCardDescription]}>{feature.description}</p>
								</div>
							))}
						</div>
					</div>
				</section>

				<section mix={[s.marketingSection]}>
					<div mix={[s.marketingContainer]}>
						<div mix={[s.marketingSectionHeader]}>
							<h2>Getting started</h2>
						</div>

						<div mix={[s.marketingSteps]}>
							{steps.map((step) => (
								<div key={step.title} mix={[s.marketingStep]}>
									<h3 mix={[s.marketingCardTitle]}>{step.title}</h3>
									<p mix={[s.marketingCardDescription]}>{step.description}</p>
								</div>
							))}
						</div>
					</div>
				</section>

				<section mix={[s.marketingSectionAlt]}>
					<div mix={[s.marketingContainer]}>
						<div mix={[s.marketingSectionHeader]}>
							<h2>Frequently asked questions</h2>
						</div>

						{faqs.map((faq) => (
							<details key={faq.question} mix={[s.marketingFaqItem]}>
								<summary mix={[s.marketingFaqQuestion]}>{faq.question}</summary>
								<p mix={[s.marketingFaqAnswer]}>{faq.answer}</p>
							</details>
						))}
					</div>
				</section>

				<section mix={[s.marketingCtaSection]}>
					<h2>Switch to Uptime</h2>
					<p>Create your first monitor in under 2 minutes. No credit card required to start.</p>

					<div mix={[s.marketingActions]}>
						{isSignedIn ? (
							<a href={routes.app.index.href()} mix={[s.buttonPrimary]}>
								Go to dashboard
							</a>
						) : (
							<form method="post" action={routes.auth.action.href()}>
								<button type="submit" mix={[s.buttonPrimary]}>
									Start Monitoring
								</button>
							</form>
						)}
					</div>
				</section>
			</>
		);
	};
}
