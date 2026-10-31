/**
 * Maintenance windows as a mockup: the upcoming windows with their scope and schedule,
 * one recurring, over the same window as the public status page announces it. Alerts
 * stay quiet inside a window, which is what the page's two flags say.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { CalendarIcon, CheckIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";

import {
	DrawnButton,
	MockupWindow,
	Muted,
	Name,
	PageTitle,
	Panel,
	Rows,
} from "~/resources/components/marketing/product-mockups/parts";

/** Upcoming windows: name, start and end (UTC), scope, and whether it recurs. */
const WINDOWS = [
	["Database upgrade", "11-04 02:00", "04:00", "All", false],
	["Weekly patching", "11-07 01:00", "01:30", "api.example.com", true],
	["CDN migration", "11-12 22:00", "23:00", "cdn.example.com", false],
] as const;

/** Draws the upcoming maintenance windows and how the status page shows the next one. */
export default function MaintenanceMockup(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		let [next] = WINDOWS;
		return (
			<MockupWindow
				label={t("landing.mockups.maintenance")}
				title={t("page.maintenance.header.title")}
				active="maintenance"
			>
				<PageTitle
					title={t("page.maintenance.header.title")}
					end={<DrawnButton>{t("page.maintenance.header.action.create")}</DrawnButton>}
				/>
				<span mix={[hstack({ gap: 1, align: "center" }), text("xs")]}>
					{(["active", "upcoming", "past"] as const).map((tab) => (
						<span
							key={tab}
							mix={[
								p(1, 2.5),
								raw({ borderRadius: "0.375rem" }),
								tab === "upcoming"
									? [bg("neutral.bg-tint-hover"), fg("neutral.emphasis"), weight("medium")]
									: fg("neutral"),
							]}
						>
							{t(`page.maintenance.tabs.${tab}`)}
						</span>
					))}
				</span>
				<Panel flush>
					<Rows
						columns="minmax(0, 1fr) auto auto minmax(0, 0.9fr)"
						head={[
							t("page.maintenance.table.columns.name"),
							t("page.maintenance.table.columns.starts"),
							t("page.maintenance.table.columns.ends"),
							t("page.maintenance.table.columns.scope"),
						]}
						rows={WINDOWS.map(([name, starts, ends, scope, recurring]) => ({
							key: name,
							cells: [
								<span mix={[vstack({ gap: 1, align: "start" }), raw({ minInlineSize: "0" })]}>
									<Name>{name}</Name>
									{recurring ? (
										<Badge color="neutral" variant="secondary">
											{t("page.maintenance.table.recurring")}
										</Badge>
									) : (
										<Badge color="brand" variant="secondary">
											{t("page.maintenance.table.status.upcoming")}
										</Badge>
									)}
								</span>,
								<Muted>{starts}</Muted>,
								<Muted>{ends}</Muted>,
								<Muted>{scope === "All" ? t("page.maintenance.table.allMonitors") : scope}</Muted>,
							],
						}))}
					/>
				</Panel>
				<Panel title={t("statusPage.maintenance.title")}>
					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						<span mix={[hstack({ gap: 2, align: "center" })]}>
							<CalendarIcon size={16} strokeWidth={1.5} mix={[fg("brand")]} />
							<Name>{next[0]}</Name>
						</span>
						<Muted>{t("statusPage.maintenance.when", { range: `${next[1]} – ${next[2]}` })}</Muted>
						<span mix={[hstack({ gap: 4, align: "center" }), raw({ flexWrap: "wrap" })]}>
							<Flag>{t("page.maintenanceWindows.form.fields.suppressAlerts.label")}</Flag>
							<Flag>{t("page.maintenanceWindows.form.fields.showOnStatusPage.label")}</Flag>
						</span>
					</div>
				</Panel>
			</MockupWindow>
		);
	};
}

/** A setting the window has on, drawn as a checked line. */
function Flag(handle: Handle<{ children: string }>) {
	return () => (
		<span mix={[hstack({ gap: 1.5, align: "center" }), text("xs"), fg("neutral")]}>
			<CheckIcon size={14} strokeWidth={2} mix={[fg("success")]} />
			{handle.props.children}
		</span>
	);
}
