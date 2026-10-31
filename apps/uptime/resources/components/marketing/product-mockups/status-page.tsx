/**
 * A public status page as a mockup: the overall banner, each service with its badge and
 * 90-day uptime bar, and the next maintenance window. It is the page a team's customers
 * see, so it draws without the app's rail, at its own address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { CircleCheckIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";

import { badgeVariant } from "~/resources/components/badge";
import { MockupWindow, Name, Panel } from "~/resources/components/marketing/product-mockups/parts";
import { sampleDailyStats } from "~/resources/components/marketing/product-mockups/sample-data";
import UptimeBar from "~/resources/views/shared/uptime-bar";

/** The page's services and the days, counted back from today, each had trouble. */
const SERVICES = [
	{ name: "API", degraded: [52], down: [] },
	{ name: "Dashboard", degraded: [19, 18], down: [] },
	{ name: "Webhooks", degraded: [], down: [] },
] as const;

/** Draws a status page with every service operational. */
export default function StatusPageMockup(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		let labels = {
			daysAgo: t("statusPage.uptimeBar.daysAgo"),
			today: t("statusPage.uptimeBar.today"),
			legend: {
				full: t("statusPage.uptimeBar.legend.full"),
				partial: t("statusPage.uptimeBar.legend.partial"),
				down: t("statusPage.uptimeBar.legend.down"),
				noData: t("statusPage.uptimeBar.legend.noData"),
			},
		};
		return (
			<MockupWindow
				label={t("landing.mockups.statusPage")}
				title="Example"
				url="status.example.com"
			>
				<span mix={[text("xl"), weight("bold"), fg("neutral.emphasis")]}>Example</span>
				<span
					mix={[
						hstack({ gap: 2, align: "center" }),
						p(3, 4),
						weight("semibold"),
						raw({
							borderRadius: "0.5rem",
							color: "var(--ui-success-fg)",
							backgroundColor: "var(--ui-success-bg-tint)",
						}),
					]}
				>
					<CircleCheckIcon size={18} strokeWidth={1.75} />
					{t("statusPage.banner.operational")}
				</span>
				{SERVICES.map((service) => (
					<Panel key={service.name}>
						<div mix={[vstack({ gap: 3, align: "stretch" })]}>
							<span mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
								<Name>{service.name}</Name>
								<Badge {...badgeVariant("up")}>{t("statusPage.status.operational")}</Badge>
							</span>
							<UptimeBar
								days={sampleDailyStats(service.name, service)}
								labels={labels}
								formatUptime={(percentage) =>
									t("statusPage.uptimeBar.tooltip.uptime", { percentage })
								}
							/>
						</div>
					</Panel>
				))}
			</MockupWindow>
		);
	};
}
