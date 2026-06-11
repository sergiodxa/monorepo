import { isSameDay } from "date-fns";
import { useTranslation } from "react-i18next";

import * as BetterHeatmap from "~/components/heatmap-composable";
import { useHints } from "~/utils/client-hints";

interface HeatmapPoint {
	date: Date;
	total: number;
	successRate: number;
}

export function Heatmap(props: {
	points: HeatmapPoint[];
	size: BetterHeatmap.Cell.Size;
	weeks: Date[][];
}) {
	let { t, i18n } = useTranslation("translation", {
		keyPrefix: "components.heatmap",
	});
	let hints = useHints();

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-row gap-2 overflow-x-auto pb-2">
				<BetterHeatmap.DayLabels />

				<BetterHeatmap.Table dates={props.weeks}>
					{(date) => {
						let point = props.points.find((point) => isSameDay(point.date, date));

						if (!point) {
							return <BetterHeatmap.Cell size={props.size} successRate={null} />;
						}

						let successRate = point.successRate * 100;

						return (
							<BetterHeatmap.CellTooltip
								message={t("tooltip", {
									successRate: ((successRate ?? 0) / 100).toLocaleString(i18n.language, {
										style: "percent",
										minimumFractionDigits: 0,
										maximumFractionDigits: 3,
									}),
									date: date.toLocaleDateString(i18n.language, {
										month: "short",
										day: "numeric",
										year: "numeric",
										timeZone: hints?.timeZone ?? "UTC",
									}),
									checks: point.total,
								})}
							>
								<BetterHeatmap.Cell size={props.size} successRate={successRate} />
							</BetterHeatmap.CellTooltip>
						);
					}}
				</BetterHeatmap.Table>
			</div>

			<BetterHeatmap.Legend size={props.size} />
		</div>
	);
}
