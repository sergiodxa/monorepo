/**
 * Pulse, an invented ops dashboard for Northwind's services, deployments and incidents. Dense
 * and technical: graphite slate neutrals, an electric cyan signal, tight 4px corners and mono
 * figures. Every screen reads fixtures, and every form answers with a redirect and a toast.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { SearchIcon } from "@sdxc/icons";
import { LinkButton } from "@sdxc/ui";
import { APP_SHELL_COOKIE } from "@sdxc/ui/app/app-shell";
import { Empty } from "@sdxc/ui/app/empty";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

import type { DemoApp, DemoAppRedirect, DemoAppRequest } from "~/resources/views/demo-apps";

import type { PulseSettingsSection } from "./shell";

import { actionHref, findService, href, SERVICES } from "./data";
import { Deployments, StatusPages } from "./deployments";
import { pulseFrame } from "./frames";
import Incidents from "./incidents";
import { COPY } from "./labels";
import Overview from "./overview";
import ServicePage from "./service";
import Services from "./services";
import Settings, { WORKSPACE_SLUG } from "./settings";
import PulseShell from "./shell";
import { thumbnail } from "./thumbnail";

/** An electric cyan at hue 215, bright enough to read as a live signal on graphite. */
const BRAND = [
	"oklch(0.97 0.02 215)",
	"oklch(0.94 0.045 215)",
	"oklch(0.89 0.08 215)",
	"oklch(0.82 0.12 215)",
	"oklch(0.74 0.15 215)",
	"oklch(0.66 0.16 220)",
	"oklch(0.56 0.15 225)",
	"oklch(0.47 0.125 228)",
	"oklch(0.39 0.1 230)",
	"oklch(0.31 0.075 232)",
	"oklch(0.22 0.05 235)",
] as const;

/** Graphite slate leaning blue, with a deep 950 so the dark frame reads as an instrument panel. */
const NEUTRAL = [
	"oklch(0.982 0.003 255)",
	"oklch(0.955 0.006 255)",
	"oklch(0.905 0.01 255)",
	"oklch(0.82 0.014 255)",
	"oklch(0.69 0.018 255)",
	"oklch(0.56 0.02 257)",
	"oklch(0.46 0.02 258)",
	"oklch(0.37 0.019 260)",
	"oklch(0.28 0.017 262)",
	"oklch(0.2 0.014 264)",
	"oklch(0.145 0.012 265)",
] as const;

/** A grotesk for the interface, a mono for every figure, and corners kept to 2–6px. */
const TOKENS = {
	"--ui-font-sans":
		"'Inter Tight', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
	"--ui-font-mono": "'JetBrains Mono', 'IBM Plex Mono', 'SF Mono', ui-monospace, Menlo, monospace",
	"--ui-radius-sm": "0.125rem",
	"--ui-radius-md": "0.25rem",
	"--ui-radius-lg": "0.375rem",
	"--ui-app-inset-radius": "0.375rem",
	"--ui-app-sidebar-width": "14.5rem",
	"--ui-app-nav-row-size": "1.875rem",
	"--ui-chart-1": "var(--ui-brand-fg)",
} as const;

/** The redirect a form that asks for something Pulse never offered answers with. */
type Answer = DemoAppRedirect | null;

/** The bulk bar's post: what to do, and to which services. */
const BULK = f.object({
	intent: f.field(s.enum_(["pause", "resume", "delete"])),
	service: f.fields(s.array(s.string())),
});

/** The toast each bulk action answers with. */
const BULK_TOASTS = {
	pause: "services-paused",
	resume: "services-resumed",
	delete: "services-deleted",
} as const;

/** A row or header action's post, which may name the list view to return to. */
const RETURN = f.object({ next: f.field(s.optional(s.string())) });

/** The service settings form. */
const SERVICE_SETTINGS = f.object({
	name: f.field(s.string().pipe(checks.minLength(1))),
	interval: f.field(s.enum_(["30", "60", "300", "3600"])),
	timeoutMs: f.field(s.string().pipe(checks.minLength(1))),
});

/** The general settings form. */
const GENERAL = f.object({
	name: f.field(s.string().pipe(checks.minLength(1))),
	slug: f.field(s.string().pipe(checks.minLength(1))),
	timezone: f.field(s.string()),
});

/** The escalation form. */
const ESCALATION = f.object({
	email: f.field(s.string().pipe(checks.email())),
	after: f.field(s.enum_(["5", "15", "30"])),
});

/** The workspace delete confirmation, which must repeat the slug. */
const DELETE_WORKSPACE = f.object({ confirmation: f.field(s.defaulted(s.string(), "")) });

/**
 * The list view a row action returns to: the `next` field when it names the services list,
 * else the service's own page, so a post can never bounce the visitor somewhere unexpected.
 */
function returnTo(form: FormData, fallback: string): string {
	let parsed = s.parseSafe(RETURN, form);
	let next = parsed.success ? parsed.value.next : undefined;
	if (next === "services" || next?.startsWith("services?")) return next;
	return fallback;
}

/** Answers a post on one service's page path (`services/<id>/<verb>`). */
function submitService(id: string, verb: string, form: FormData): Answer {
	let service = findService(id);
	if (service === undefined) return null;
	let page = `services/${service.id}`;
	if (verb === "pause") return { page: returnTo(form, page), toast: "service-paused" };
	if (verb === "resume") return { page: returnTo(form, page), toast: "service-resumed" };
	if (verb === "check") return { page, toast: "check-started" };
	if (verb === "delete") return { page: returnTo(form, "services"), toast: "service-deleted" };
	if (verb === "restore") return { page: "services", toast: "service-restored" };
	if (verb === "settings") {
		let parsed = s.parseSafe(SERVICE_SETTINGS, form);
		return {
			page: `${page}?tab=settings`,
			toast: parsed.success ? "service-saved" : "not-saved",
		};
	}
	return null;
}

/** Answers a post on a settings path. */
function submitSettings(section: string | undefined, form: FormData): Answer {
	if (section === undefined) {
		return {
			page: "settings",
			toast: s.parseSafe(GENERAL, form).success ? "settings-saved" : "not-saved",
		};
	}
	if (section === "notifications") return { page: "settings/notifications", toast: "alerts-saved" };
	if (section === "escalation") {
		let parsed = s.parseSafe(ESCALATION, form);
		return {
			page: "settings/notifications",
			toast: parsed.success ? "escalation-saved" : "not-saved",
		};
	}
	if (section === "transfer") return { page: "settings", toast: "ownership-transferred" };
	if (section === "delete") {
		let parsed = s.parseSafe(DELETE_WORKSPACE, form);
		let confirmed = parsed.success && parsed.value.confirmation.trim() === WORKSPACE_SLUG;
		return confirmed
			? { page: "", toast: "workspace-deleted" }
			: { page: "settings", toast: "not-deleted" };
	}
	return null;
}

/** The app's own 404, inside its frame, with the way back to the overview. */
function NotFound() {
	return () => (
		<Empty icon={<SearchIcon />}>
			<Empty.Title>{COPY.notFound.title}</Empty.Title>
			<Empty.Description>{COPY.notFound.description}</Empty.Description>
			<Empty.Action>
				<LinkButton href={href()} size="sm">
					{COPY.notFound.back}
				</LinkButton>
			</Empty.Action>
		</Empty>
	);
}

/**
 * Picks the screen a page path names; every path Pulse lacks gets its own 404 inside the
 * frame, so a mistyped address still shows where the visitor is.
 */
function route(request: DemoAppRequest) {
	let [first = "", second, third] = request.page.split("/");
	if (first === "" && second === undefined) {
		return {
			title: COPY.overview.title,
			body: (
				<PulseShell request={request} section="overview">
					<Overview request={request} />
				</PulseShell>
			),
		};
	}
	if (first === "services" && second === undefined) {
		return {
			title: COPY.services.title,
			body: (
				<PulseShell request={request} section="services">
					<Services request={request} />
				</PulseShell>
			),
		};
	}
	let service = first === "services" && third === undefined ? findService(second ?? "") : undefined;
	if (service !== undefined) {
		return {
			title: service.name,
			body: (
				<PulseShell request={request} section="services">
					<ServicePage request={request} service={service} />
				</PulseShell>
			),
		};
	}
	if (first === "deployments" && second === undefined) {
		return {
			title: COPY.deployments.title,
			body: (
				<PulseShell request={request} section="deployments">
					<Deployments />
				</PulseShell>
			),
		};
	}
	if (first === "incidents" && second === undefined) {
		return {
			title: COPY.incidents.title,
			body: (
				<PulseShell request={request} section="incidents">
					<Incidents request={request} />
				</PulseShell>
			),
		};
	}
	if (first === "status-pages" && second === undefined) {
		return {
			title: COPY.statusPages.title,
			body: (
				<PulseShell request={request} section="status-pages">
					<StatusPages />
				</PulseShell>
			),
		};
	}
	let settings = first === "settings" && third === undefined ? settingsSection(second) : undefined;
	if (settings !== undefined) {
		return {
			title: COPY.settings[settings].title,
			body: (
				<PulseShell request={request} settings={settings}>
					<Settings request={request} section={settings} />
				</PulseShell>
			),
		};
	}
	return {
		title: COPY.notFound.title,
		status: 404,
		body: (
			<PulseShell request={request}>
				<NotFound />
			</PulseShell>
		),
	};
}

/** The settings section a path segment names, or `undefined` for one Pulse lacks. */
function settingsSection(segment: string | undefined): PulseSettingsSection | undefined {
	if (segment === undefined) return "general";
	if (segment === "notifications" || segment === "billing") return segment;
	return undefined;
}

export default {
	name: "Pulse",
	kind: "Ops dashboard",
	tagline: "Services, deploys and incidents at a glance.",
	artDirection: "Graphite slate, electric cyan, mono figures.",
	description:
		"Pulse, an invented ops dashboard: Northwind's services with live filters, a peek sheet and a bulk bar, metrics that switch one chart, incidents, deploys and settings.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail,
	screens: [
		"",
		"?metric=latency",
		"?metric=errors",
		"?metric=incidents",
		"?range=7d",
		"?metric=latency&range=90d",
		"?state=loading",
		"?state=error",
		"services",
		"services?show=failing",
		"services?status=down&status=degraded",
		"services?region=sin&sort=latency",
		"services?q=billing",
		"services?peek=checkout-api",
		"services?density=comfortable",
		"services?state=loading",
		"services?state=error",
		...SERVICES.map((service) => `services/${service.id}`),
		"services/checkout-api?tab=checks",
		"services/checkout-api?tab=incidents",
		"services/auth-service?tab=incidents",
		"services/checkout-api?tab=settings",
		"deployments",
		"incidents",
		"incidents?view=resolved",
		"incidents?view=mine",
		"status-pages",
		"settings",
		"settings/notifications",
		"settings/billing",
	],
	cookies: [APP_SHELL_COOKIE],
	toasts: {
		"services-paused": { color: "neutral", title: "Services paused" },
		"services-resumed": { color: "success", title: "Services resumed" },
		"services-deleted": {
			color: "neutral",
			title: "Services deleted",
			action: { label: "Undo", form: { action: actionHref("services/restore") } },
		},
		"services-restored": { color: "success", title: "Services restored" },
		"service-paused": { color: "neutral", title: "Service paused" },
		"service-resumed": { color: "success", title: "Service resumed" },
		"service-deleted": {
			color: "neutral",
			title: "Service deleted",
			action: { label: "Undo", form: { action: actionHref("services/restore") } },
		},
		"service-restored": { color: "success", title: "Service restored" },
		"service-saved": { color: "success", title: "Service saved" },
		"check-started": { color: "brand", title: "Check started" },
		"settings-saved": { color: "success", title: "Settings saved" },
		"alerts-saved": { color: "success", title: "Alerts saved" },
		"escalation-saved": { color: "success", title: "Escalation saved" },
		"ownership-transferred": { color: "success", title: "Ownership transferred" },
		"workspace-deleted": {
			color: "neutral",
			title: "Workspace deleted",
			description: "A demo keeps nothing, so Northwind is back.",
		},
		"not-saved": {
			color: "danger",
			title: "Changes not saved",
			description: "Fill in every field and try again.",
		},
		"not-deleted": {
			color: "danger",
			title: "Workspace not deleted",
			description: `Type "${WORKSPACE_SLUG}" exactly to confirm.`,
		},
		"status-page-created": {
			color: "success",
			title: "Status page created",
			description: "A demo keeps nothing, so the list stays empty.",
		},
	},
	frame: (part, request) => pulseFrame(part, request),
	render: (request) => route(request),
	submit(page, form) {
		let [first, second, third, extra] = page.split("/");
		if (extra !== undefined) return null;
		if (first === "services" && second === undefined) {
			let parsed = s.parseSafe(BULK, form);
			if (!parsed.success) return null;
			let next = returnTo(form, "services");
			return { page: next, toast: BULK_TOASTS[parsed.value.intent] };
		}
		if (first === "services" && second === "restore" && third === undefined) {
			return { page: "services", toast: "services-restored" };
		}
		if (first === "services" && second !== undefined && third !== undefined) {
			return submitService(second, third, form);
		}
		if (first === "settings" && third === undefined) return submitSettings(second, form);
		if (first === "status-pages" && second === undefined) {
			return { page: "status-pages", toast: "status-page-created" };
		}
		return null;
	},
} satisfies DemoApp;
