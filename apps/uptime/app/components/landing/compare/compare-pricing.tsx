/**
 * Renders the pricing comparison section of a versus page, tabulating cost scenarios
 * for the competitor versus Uptime alongside the resulting savings, with a footnote on
 * the competitor's starting price. It exists to make the cost advantage of Uptime
 * concrete on each comparison page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge } from "@pkg/ui";

interface ComparePricingProps {
	competitor: string;
	competitorPrice: string;
	scenarios: Array<{
		scenario: string;
		competitorCost: string;
		uptimeCost: string;
		savings: string;
	}>;
}

export function ComparePricing({ competitor, competitorPrice, scenarios }: ComparePricingProps) {
	return (
		<section className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Pricing
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Real cost comparison
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						See how much you could save with Uptime for typical monitoring setups.
					</p>
				</div>

				<div className="mt-12 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
					<table className="w-full">
						<thead>
							<tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
								<th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900 dark:text-neutral-50">
									Use Case
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-neutral-600 dark:text-neutral-400">
									{competitor}
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-primary-600 dark:text-primary-400">
									Uptime
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-success-600 dark:text-success-400">
									Savings
								</th>
							</tr>
						</thead>
						<tbody>
							{scenarios.map((row, index) => (
								<tr
									key={row.scenario}
									className={
										index !== scenarios.length - 1
											? "border-b border-neutral-200 dark:border-neutral-800"
											: ""
									}
								>
									<td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-neutral-50">
										{row.scenario}
									</td>
									<td className="px-6 py-4 text-center font-mono text-sm text-neutral-600 dark:text-neutral-400">
										{row.competitorCost}
									</td>
									<td className="px-6 py-4 text-center font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">
										{row.uptimeCost}
									</td>
									<td className="px-6 py-4 text-center font-mono text-sm font-semibold text-success-600 dark:text-success-400">
										{row.savings}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
					* Estimates based on typical usage patterns. {competitor} pricing starts at{" "}
					<span className="font-mono">{competitorPrice}</span>. Actual costs may vary.
				</p>
			</div>
		</section>
	);
}
