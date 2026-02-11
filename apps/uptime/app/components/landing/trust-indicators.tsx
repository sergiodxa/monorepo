import type { ReactNode } from "react";

interface Indicator {
	icon: ReactNode;
	value: string;
	label: string;
}

interface LandingTrustIndicatorsProps {
	indicators: Indicator[];
}

export function LandingTrustIndicators({ indicators }: LandingTrustIndicatorsProps) {
	return (
		<section className="border-y border-neutral-200 bg-neutral-50 py-8 dark:border-neutral-800 dark:bg-neutral-900/50">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="grid grid-cols-2 gap-8 md:grid-cols-4">
					{indicators.map((indicator) => (
						<div key={indicator.label} className="flex flex-col items-center gap-2 text-center">
							<div className="flex items-center gap-1 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
								{indicator.icon}
								<span className="font-mono">{indicator.value}</span>
							</div>
							<p className="text-sm text-neutral-600 dark:text-neutral-400">{indicator.label}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
