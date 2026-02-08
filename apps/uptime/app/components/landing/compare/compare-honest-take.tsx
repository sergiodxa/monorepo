import { Badge } from "@pkg/ui";
import { AlertTriangleIcon } from "lucide-react";

interface CompareHonestTakeProps {
	competitor: string;
	reasons: Array<{
		title: string;
		description: string;
	}>;
}

export function CompareHonestTake({ competitor, reasons }: CompareHonestTakeProps) {
	return (
		<section className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="warning" variant="secondary" className="mb-4">
						Honest Take
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						When {competitor} might be better
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						We believe in being transparent. Here's when {competitor} could be the right choice.
					</p>
				</div>

				<div className="mt-12 space-y-6">
					{reasons.map((reason) => (
						<div
							key={reason.title}
							className="flex gap-4 rounded-xl border border-warning-200 bg-warning-50 p-6 dark:border-warning-800/50 dark:bg-warning-900/20"
						>
							<AlertTriangleIcon className="size-6 shrink-0 text-warning-600 dark:text-warning-400" />
							<div>
								<h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
									{reason.title}
								</h3>
								<p className="mt-2 text-neutral-600 dark:text-neutral-400">{reason.description}</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
