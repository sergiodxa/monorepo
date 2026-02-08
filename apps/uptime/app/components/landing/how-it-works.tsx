import type { ReactNode } from "react";

import { Badge } from "@pkg/ui";

interface Step {
	title: string;
	description: string;
	icon?: ReactNode;
}

interface LandingHowItWorksProps {
	badge?: string;
	title: string;
	description: string;
	steps: Step[];
}

export function LandingHowItWorks({
	badge = "How it works",
	title,
	description,
	steps,
}: LandingHowItWorksProps) {
	return (
		<section className="scroll-mt-20 bg-neutral-50 py-16 sm:py-24 lg:py-32 dark:bg-neutral-900/50">
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

				<div className="mt-16 grid gap-8 md:grid-cols-3">
					{steps.map((step, index) => (
						<div key={step.title} className="relative flex flex-col items-center text-center">
							<div className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary-600 text-2xl font-bold text-white">
								{step.icon ?? index + 1}
							</div>
							{index < steps.length - 1 && (
								<div className="absolute top-8 left-[calc(50%+2rem)] hidden h-0.5 w-[calc(100%-4rem)] bg-primary-200 md:block dark:bg-primary-800" />
							)}
							<h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
								{step.title}
							</h3>
							<p className="mt-2 text-neutral-600 dark:text-neutral-400">{step.description}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
