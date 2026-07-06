/**
 * Maps a monitor check's success rate (0-100, or null for no data) to a Tailwind
 * background-color class, including its dark-mode variant. It grades from primary green
 * for healthy rates down through warning amber to danger red, with a neutral color when
 * data is missing. Heatmap cells use it to visually convey uptime health at a glance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export default function getCellColor(successRate: number | null): string {
	if (!successRate) return "bg-neutral-300 dark:bg-neutral-700";
	if (successRate === 100) return "bg-primary-600 dark:bg-primary-500";
	if (successRate >= 90) return "bg-primary-500 dark:bg-primary-400";
	if (successRate >= 70) return "bg-primary-400 dark:bg-primary-300";
	if (successRate >= 40) return "bg-warning-400 dark:bg-warning-300";
	if (successRate >= 20) return "bg-danger-400 dark:bg-danger-300";
	if (successRate >= 0) return "bg-danger-500 dark:bg-danger-400";
	throw new Error("Invalid success rate");
}
