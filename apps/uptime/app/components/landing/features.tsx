/**
 * LandingFeatures component: a marketing section that renders a badged heading,
 * description, and a responsive grid of feature cards, each with an icon, title,
 * and description. It exists as a reusable presentation block that landing pages
 * feed with their own feature lists to showcase product capabilities.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ReactNode } from "react";

import { Badge, Card } from "@pkg/ui";

interface Feature {
	title: string;
	description: string;
	icon: ReactNode;
}

interface LandingFeaturesProps {
	badge?: string;
	title: string;
	description: string;
	features: Feature[];
}

export function LandingFeatures({
	badge = "Features",
	title,
	description,
	features,
}: LandingFeaturesProps) {
	return (
		<section id="features" className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						{badge}
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						{title}
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">{description}</p>
				</div>

				<div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
					{features.map((feature) => (
						<Card key={feature.title} className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400">
									{feature.icon}
								</div>
								<Card.Title className="text-xl">{feature.title}</Card.Title>
							</Card.Header>
							<Card.Content className="pt-0">
								<p className="text-neutral-600 dark:text-neutral-400">{feature.description}</p>
							</Card.Content>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}
