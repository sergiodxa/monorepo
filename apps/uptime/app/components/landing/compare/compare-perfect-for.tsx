/**
 * Renders the "perfect for" callout on a comparison page, showing a gradient card with
 * a title, description, and an optional set of checkmarked highlight pills. It exists
 * to summarize which audiences or use cases Uptime is best suited for on each versus
 * page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CheckIcon } from "lucide-react";

interface ComparePerfectForProps {
	title: string;
	description: string;
	highlights: string[];
}

export function ComparePerfectFor({ title, description, highlights }: ComparePerfectForProps) {
	return (
		<section className="scroll-mt-20 bg-neutral-50 py-16 sm:py-24 lg:py-32 dark:bg-neutral-900/50">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
				<div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 p-8 text-center shadow-xl sm:p-12">
					<h2 className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">{description}</p>

					{highlights.length > 0 && (
						<div className="mt-8 flex flex-wrap justify-center gap-4">
							{highlights.map((highlight) => (
								<div
									key={highlight}
									className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-primary-100"
								>
									<CheckIcon className="size-4 text-primary-200" />
									<span>{highlight}</span>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
