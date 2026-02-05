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
