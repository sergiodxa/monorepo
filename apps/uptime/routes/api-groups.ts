/**
 * Groups the JSON API's route leaves into the maps `router.map()` takes, one per
 * controller. They live beside the route table rather than inside each controller
 * so the bootstrap can map a group without importing the module behind it, which
 * is what lets every API controller arrive with the first request that needs it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import routes from "~/routes/web";

export const monitorsRoutes = {
	monitorsIndex: routes.api.v1.monitors.index,
	monitorsCreate: routes.api.v1.monitors.create,
	monitorsStats: routes.api.v1.monitors.stats,
};

export const monitorRoutes = {
	monitorShow: routes.api.v1.monitors.show,
	monitorUpdate: routes.api.v1.monitors.update,
	monitorDestroy: routes.api.v1.monitors.destroy,
	monitorStats: routes.api.v1.monitors.itemStats,
	monitorResults: routes.api.v1.monitors.results,
	monitorAlertEvents: routes.api.v1.monitors.alertEvents,
};

export const monitorContentChecksRoutes = {
	monitorContentChecksIndex: routes.api.v1.monitors.contentChecks.index,
	monitorContentChecksCreate: routes.api.v1.monitors.contentChecks.create,
	monitorContentCheckDestroy: routes.api.v1.monitors.contentChecks.destroy,
};

export const dnsMonitorsRoutes = {
	dnsMonitorsIndex: routes.api.v1.dnsMonitors.index,
	dnsMonitorsCreate: routes.api.v1.dnsMonitors.create,
};

export const dnsMonitorRoutes = {
	dnsMonitorShow: routes.api.v1.dnsMonitors.show,
	dnsMonitorUpdate: routes.api.v1.dnsMonitors.update,
	dnsMonitorDestroy: routes.api.v1.dnsMonitors.destroy,
	dnsMonitorResults: routes.api.v1.dnsMonitors.results,
};

export const dnsMonitorRecordsRoutes = {
	dnsMonitorRecordsIndex: routes.api.v1.dnsMonitors.records.index,
	dnsMonitorRecordUpdate: routes.api.v1.dnsMonitors.records.update,
};

export const tcpMonitorsRoutes = {
	tcpMonitorsIndex: routes.api.v1.tcpMonitors.index,
	tcpMonitorsCreate: routes.api.v1.tcpMonitors.create,
};

export const tcpMonitorRoutes = {
	tcpMonitorShow: routes.api.v1.tcpMonitors.show,
	tcpMonitorUpdate: routes.api.v1.tcpMonitors.update,
	tcpMonitorDestroy: routes.api.v1.tcpMonitors.destroy,
	tcpMonitorResults: routes.api.v1.tcpMonitors.results,
};

export const flowMonitorsRoutes = {
	flowMonitorsIndex: routes.api.v1.flowMonitors.index,
	flowMonitorsCreate: routes.api.v1.flowMonitors.create,
	flowMonitorShow: routes.api.v1.flowMonitors.show,
	flowMonitorUpdate: routes.api.v1.flowMonitors.update,
	flowMonitorDestroy: routes.api.v1.flowMonitors.destroy,
	flowMonitorResults: routes.api.v1.flowMonitors.results,
};

export const cronJobsRoutes = {
	cronJobsIndex: routes.api.v1.cronJobs.index,
	cronJobsCreate: routes.api.v1.cronJobs.create,
};

export const cronJobRoutes = {
	cronJobShow: routes.api.v1.cronJobs.show,
	cronJobUpdate: routes.api.v1.cronJobs.update,
	cronJobDestroy: routes.api.v1.cronJobs.destroy,
};

export const alertsRoutes = {
	alertsIndex: routes.api.v1.alerts.index,
	alertsCreate: routes.api.v1.alerts.create,
};

export const alertRoutes = {
	alertShow: routes.api.v1.alerts.show,
	alertUpdate: routes.api.v1.alerts.update,
	alertDestroy: routes.api.v1.alerts.destroy,
	alertEvents: routes.api.v1.alerts.events,
};

export const maintenanceRoutes = {
	maintenanceIndex: routes.api.v1.maintenance.index,
	maintenanceCreate: routes.api.v1.maintenance.create,
};

export const maintenanceWindowRoutes = {
	maintenanceShow: routes.api.v1.maintenance.show,
	maintenanceUpdate: routes.api.v1.maintenance.update,
	maintenanceDestroy: routes.api.v1.maintenance.destroy,
	maintenanceEnd: routes.api.v1.maintenance.end,
};

export const statusPagesRoutes = {
	statusPagesIndex: routes.api.v1.statusPages.index,
	statusPagesCreate: routes.api.v1.statusPages.create,
};

export const statusPageRoutes = {
	statusPageShow: routes.api.v1.statusPages.show,
	statusPageUpdate: routes.api.v1.statusPages.update,
	statusPageDestroy: routes.api.v1.statusPages.destroy,
	statusPageMonitors: routes.api.v1.statusPages.monitors,
};

export const invitesRoutes = {
	invitesIndex: routes.api.v1.invites.index,
	invitesCreate: routes.api.v1.invites.create,
};

export const teamRoutes = {
	teamShow: routes.api.v1.teamShow,
	teamUpdate: routes.api.v1.teamUpdate,
};

export const teamDomainsRoutes = {
	teamDomainsIndex: routes.api.v1.teamDomains.index,
	teamDomainsCreate: routes.api.v1.teamDomains.create,
	teamDomainsDestroy: routes.api.v1.teamDomains.destroy,
};

export const apiKeysRoutes = {
	apiKeysIndex: routes.api.v1.apiKeys.index,
	apiKeysCreate: routes.api.v1.apiKeys.create,
};
