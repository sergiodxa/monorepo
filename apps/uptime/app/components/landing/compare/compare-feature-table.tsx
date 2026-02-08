import { Badge } from "@pkg/ui";
import { CheckIcon, XIcon } from "lucide-react";

interface CompareFeatureTableProps {
	competitor: string;
	features: Array<{
		feature: string;
		uptime: string | boolean;
		competitor: string | boolean;
		highlight?: boolean;
	}>;
}

function FeatureCell({ value }: { value: string | boolean }) {
	if (typeof value === "boolean") {
		return value ? (
			<CheckIcon className="mx-auto size-5 text-success-500" />
		) : (
			<XIcon className="mx-auto size-5 text-neutral-400" />
		);
	}
	return <span>{value}</span>;
}

export function CompareFeatureTable({ competitor, features }: CompareFeatureTableProps) {
	return (
		<section id="comparison" className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Comparison
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Feature by feature
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						See how Uptime and {competitor} stack up across key features.
					</p>
				</div>

				<div className="mt-12 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
					<table className="w-full">
						<thead>
							<tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
								<th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900 dark:text-neutral-50">
									Feature
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-primary-600 dark:text-primary-400">
									Uptime
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-neutral-600 dark:text-neutral-400">
									{competitor}
								</th>
							</tr>
						</thead>
						<tbody>
							{features.map((row, index) => (
								<tr
									key={row.feature}
									className={[
										index !== features.length - 1
											? "border-b border-neutral-200 dark:border-neutral-800"
											: "",
										row.highlight ? "bg-primary-50/50 dark:bg-primary-900/10" : "",
									]
										.filter(Boolean)
										.join(" ")}
								>
									<td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-neutral-50">
										{row.feature}
									</td>
									<td className="px-6 py-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
										<FeatureCell value={row.uptime} />
									</td>
									<td className="px-6 py-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
										<FeatureCell value={row.competitor} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	);
}
