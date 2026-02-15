import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export function MonitorsTableError() {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<TriangleAlertIcon className="mb-4 size-12 text-warning-500" />
			<p className="text-neutral-600 dark:text-neutral-400">{t("error.table.message")}</p>
		</div>
	);
}
