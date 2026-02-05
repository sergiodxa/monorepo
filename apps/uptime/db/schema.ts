import { uuid, pk, timestamp, url } from "@pkg/db-helpers";
import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = timestamp("created_at")
	.notNull()
	.$defaultFn(() => new Date());

const updatedAt = timestamp("updated_at")
	.notNull()
	.$defaultFn(() => new Date())
	.$onUpdateFn(() => new Date());

export const teams = sqliteTable("teams", {
	id: pk("id"),
	// Timestamps
	createdAt,
	updatedAt,
	// Relations
	ownerId: uuid("owner_id").notNull(),
	// Attributes
	name: text("name").notNull(),
	slug: text("slug", { mode: "text", length: 255 }).notNull(),
	logo: url("logo"),
});

export const memberships = sqliteTable(
	"memberships",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		subjectId: uuid("subject_id").notNull(),
		teamId: uuid("team_id").notNull(),
		// Attributes
		role: text("role", { enum: ["member", "admin"] })
			.notNull()
			.default("member"),
	},
	(table) => [
		index("memberships_team_idx").on(table.teamId),
		index("memberships_subject_idx").on(table.subjectId),
		index("memberships_subject_team_idx").on(table.subjectId, table.teamId),
	],
);

export const invites = sqliteTable("invites", {
	id: pk("id"),
	// Timestamps
	createdAt,
	updatedAt,
	acceptedAt: timestamp("accepted_at"),
	// Relations
	senderId: uuid("sender_id").notNull(),
	teamId: uuid("team_id").notNull(),
	// Attributes
	email: text("email").notNull(),
});

export const teamDomains = sqliteTable(
	"team_domains",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		verifiedAt: timestamp("verified_at"),
		// Relations
		teamId: uuid("team_id").notNull(),
		// Attributes
		hostname: text("hostname").notNull(),
	},
	(table) => [index("team_domains_verified_hostname_idx").on(table.verifiedAt, table.hostname)],
);

export const monitors = sqliteTable(
	"monitors",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		enabledAt: timestamp("enabled_at").$defaultFn(() => new Date()),
		// Relations
		teamId: uuid("team_id").notNull(),
		authorId: uuid("author_id").notNull(),
		// Attributes
		name: text("name").notNull(),
		url: url("url").notNull(),
		method: text("method", {
			enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
		})
			.default("HEAD")
			.notNull(),
		expectedStatus: integer("expected_status").default(200).notNull(),
		intervalSeconds: integer("interval_seconds").default(60).notNull(),
		degradedAfterMs: integer("degraded_after_ms").default(5000).notNull(),
		timeoutSeconds: integer("timeout_seconds").default(10).notNull(),
		locationHint: text("location_hint", {
			enum: ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"],
		})
			.default("wnam")
			.notNull(),
	},
	(table) => [
		index("monitors_created_at_idx").on(table.createdAt),
		index("monitors_team_idx").on(table.teamId),
	],
);

export const monitorResults = sqliteTable(
	"monitor_results",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		completedAt: timestamp("completed_at"),
		// Relations
		monitorId: uuid("monitor_id").notNull(),
		// Attributes
		responseStatus: integer("response_status"),
		responseTimeMs: integer("response_time_ms"),
	},
	(table) => [
		index("monitor_results_created_at_idx").on(table.createdAt),
		index("monitor_results_monitor_completed_at_response_status_response_time_idx").on(
			table.monitorId,
			table.completedAt,
			table.responseStatus,
			table.responseTimeMs,
		),
	],
);

export const alerts = sqliteTable("alerts", {
	id: pk("id"),
	// Timestamps
	createdAt,
	updatedAt,
	// Relations
	teamId: uuid("team_id").notNull(),
	monitorId: uuid("monitor_id"),
	// Attributes
	name: text("name").notNull(),
	config: text("config", { mode: "json" })
		.$type<
			| { strategy: "webhook"; config: { url: string; secret: string } }
			| { strategy: "email"; config: { to: string; subjectPrefix: string } }
		>()
		.notNull(),
});

// Relations

export const teamsRelations = relations(teams, ({ many }) => {
	return {
		memberships: many(memberships),
		invites: many(invites),
		domains: many(teamDomains),
		monitors: many(monitors),
		alerts: many(alerts),
	};
});

export const membershipsRelations = relations(memberships, ({ one }) => {
	return {
		team: one(teams, {
			fields: [memberships.teamId],
			references: [teams.id],
		}),
	};
});

export const invitesRelations = relations(invites, ({ one }) => {
	return {
		team: one(teams, {
			fields: [invites.teamId],
			references: [teams.id],
		}),
	};
});

export const teamDomainsRelations = relations(teamDomains, ({ one }) => {
	return {
		team: one(teams, {
			fields: [teamDomains.teamId],
			references: [teams.id],
		}),
	};
});

export const monitorsRelations = relations(monitors, ({ many, one }) => {
	return {
		team: one(teams, {
			fields: [monitors.teamId],
			references: [teams.id],
		}),
		results: many(monitorResults),
		alerts: many(alerts),
	};
});

export const monitorResultsRelations = relations(monitorResults, ({ one }) => {
	return {
		monitor: one(monitors, {
			fields: [monitorResults.monitorId],
			references: [monitors.id],
		}),
	};
});

export const alertsRelations = relations(alerts, ({ one }) => {
	return {
		team: one(teams, {
			fields: [alerts.teamId],
			references: [teams.id],
		}),
		monitor: one(monitors, {
			fields: [alerts.monitorId],
			references: [monitors.id],
		}),
	};
});

// Types

export type SelectTeam = typeof teams.$inferSelect;
export type SelectMembership = typeof memberships.$inferSelect;
export type SelectInvite = typeof invites.$inferSelect;
export type SelectTeamDomain = typeof teamDomains.$inferSelect;
export type SelectMonitor = typeof monitors.$inferSelect;
export type SelectMonitorResult = typeof monitorResults.$inferSelect;
export type SelectAlert = typeof alerts.$inferSelect;

export type InsertTeam = typeof teams.$inferInsert;
export type InsertMembership = typeof memberships.$inferInsert;
export type InsertInvite = typeof invites.$inferInsert;
export type InsertTeamDomain = typeof teamDomains.$inferInsert;
export type InsertMonitor = typeof monitors.$inferInsert;
export type InsertMonitorResult = typeof monitorResults.$inferInsert;
export type InsertAlert = typeof alerts.$inferInsert;
