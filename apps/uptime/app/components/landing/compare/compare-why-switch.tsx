/**
 * Renders the "why switch" section of a comparison page, laying out a grid of reason
 * cards each with an icon, title, and description under a heading. It exists to present
 * the key selling points that motivate teams to move to Uptime from a competitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ReactNode } from "react";

import { Badge, Card } from "@pkg/ui";

interface CompareWhySwitchProps {
	title?: string;
	reasons: Array<{
		icon: ReactNode;
		title: string;
		description: string;
	}>;
}

export function CompareWhySwitch({
	title = "Why teams are switching to Uptime",
	reasons,
}: CompareWhySwitchProps) {
	return (
		<section className="scroll-mt-20 bg-neutral-50 py-16 sm:py-24 lg:py-32 dark:bg-neutral-900/50">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="success" variant="secondary" className="mb-4">
						Why Switch
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						{title}
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						See why teams are making the switch to simpler, more affordable monitoring.
					</p>
				</div>

				<div className="mt-12 grid gap-6 md:grid-cols-2">
					{reasons.map((reason) => (
						<Card key={reason.title} className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600 dark:bg-success-900/50 dark:text-success-400">
									{reason.icon}
								</div>
								<Card.Title className="text-xl">{reason.title}</Card.Title>
							</Card.Header>
							<Card.Content className="pt-0">
								<p className="text-neutral-600 dark:text-neutral-400">{reason.description}</p>
							</Card.Content>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}
