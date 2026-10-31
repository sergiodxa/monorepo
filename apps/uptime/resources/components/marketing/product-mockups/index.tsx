/**
 * Product mockups for marketing heroes and media slots: the app's own UI drawn inline
 * with example data, one per product area, so each page shows the part of the product it
 * sells. Light and dark follow the page's theme, and phones see the desktop layout scaled.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import AlertsMockup from "~/resources/components/marketing/product-mockups/alerts";
import CronMockup from "~/resources/components/marketing/product-mockups/cron";
import DashboardMockup from "~/resources/components/marketing/product-mockups/dashboard";
import FlowMockup from "~/resources/components/marketing/product-mockups/flow";
import MaintenanceMockup from "~/resources/components/marketing/product-mockups/maintenance";
import MonitorMockup from "~/resources/components/marketing/product-mockups/monitor";
import NetworkMockup from "~/resources/components/marketing/product-mockups/network";
import ReportsMockup from "~/resources/components/marketing/product-mockups/reports";
import StatusPageMockup from "~/resources/components/marketing/product-mockups/status-page";
import TeamMockup from "~/resources/components/marketing/product-mockups/team";

/** The product area a mockup shows. */
export type MockupArea =
	| "dashboard"
	| "monitor"
	| "alerts"
	| "status-page"
	| "dns"
	| "tcp"
	| "ssl"
	| "cron"
	| "flow"
	| "maintenance"
	| "reports"
	| "team"
	| "api-keys";

/** The mockup each `/features/:slug` page shows; a slug missing here shows the dashboard. */
export const FEATURE_MOCKUPS: Readonly<Record<string, MockupArea>> = {
	monitors: "monitor",
	alerts: "alerts",
	"status-pages": "status-page",
	analytics: "reports",
	teams: "team",
	api: "api-keys",
	integrations: "alerts",
	maintenance: "maintenance",
	flows: "flow",
	dns: "dns",
	ssl: "ssl",
	"cron-jobs": "cron",
	"content-monitoring": "monitor",
};

/**
 * The mockup each `/for/:slug` page shows, the area that audience leans on most. A page
 * with a spotlight shows a different area here, so the two visuals never repeat.
 */
export const AUDIENCE_MOCKUPS: Readonly<Record<string, MockupArea>> = {
	"solo-devs": "reports",
	startups: "status-page",
	agencies: "reports",
	enterprises: "team",
	devops: "alerts",
	"indie-hackers": "monitor",
};

/** The mockup each `/use-cases/:slug` page shows, an area its spotlight leaves out. */
export const USE_CASE_MOCKUPS: Readonly<Record<string, MockupArea>> = {
	"website-monitoring": "monitor",
	"api-monitoring": "monitor",
	"login-flow-monitoring": "flow",
	"cron-jobs": "cron",
	healthcheck: "monitor",
	ecommerce: "flow",
	saas: "dashboard",
	microservices: "tcp",
};

/** The mockup each `/vs/:slug` page shows: the area the comparison turns on. */
export const COMPARISON_MOCKUPS: Readonly<Record<string, MockupArea>> = {
	uptimerobot: "dashboard",
	"better-uptime": "status-page",
	pingdom: "monitor",
	statuscake: "ssl",
	datadog: "alerts",
	site24x7: "reports",
	checkly: "flow",
	ohdear: "dns",
	cronitor: "cron",
	healthchecks: "cron",
};

namespace ProductMockup {
	export interface Props {
		area: MockupArea;
		/** The request's translator; every label is the app's own translation. */
		t: Translate;
	}
}

/** Draws the mockup for `area`, framed as an app window and named for assistive technology. */
export default function ProductMockup(handle: Handle<ProductMockup.Props>) {
	return () => {
		let { area, t } = handle.props;
		switch (area) {
			case "dashboard":
				return <DashboardMockup t={t} />;
			case "monitor":
				return <MonitorMockup t={t} />;
			case "alerts":
				return <AlertsMockup t={t} />;
			case "status-page":
				return <StatusPageMockup t={t} />;
			case "dns":
			case "tcp":
			case "ssl":
				return <NetworkMockup t={t} lead={area} />;
			case "cron":
				return <CronMockup t={t} />;
			case "flow":
				return <FlowMockup t={t} />;
			case "maintenance":
				return <MaintenanceMockup t={t} />;
			case "reports":
				return <ReportsMockup t={t} />;
			case "team":
				return <TeamMockup t={t} lead="members" />;
			case "api-keys":
				return <TeamMockup t={t} lead="keys" />;
		}
	};
}
