import { fk, pk, timestamp, url } from "@pkg/db-helpers";
import { relations } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = timestamp("created_at")
	.notNull()
	.$defaultFn(() => new Date());

const updatedAt = timestamp("updated_at")
	.notNull()
	.$defaultFn(() => new Date())
	.$onUpdateFn(() => new Date());

export const subjects = sqliteTable("subjects", {
	id: pk("id"),
	// Timestamps
	createdAt,
	updatedAt,
	// Attributes
	displayName: text("display_name", { mode: "text" }).notNull(),
	avatar: url("avatar").notNull(),
	role: text("role", { enum: ["user", "admin"] })
		.notNull()
		.default("user"),
	// Unique attributes
	username: text("username", { mode: "text" }).unique().notNull(),
	emailAddress: text("email_address", { mode: "text" }).unique().notNull(),
});

export type SelectSubject = typeof subjects.$inferSelect;
export type InsertSubject = typeof subjects.$inferInsert;

export const credentials = sqliteTable(
	"credentials",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		verifiedAt: timestamp("verified_at"),
		// Relations
		subjectId: fk("subject_id", () => subjects.id)
			.unique()
			.notNull(),
		// Attributes
		passwordHash: text("password_hash", { mode: "text" }).notNull(),
	},
	(table) => [index("credentials_subject_verified_idx").on(table.subjectId, table.verifiedAt)],
);

export type SelectCredential = typeof credentials.$inferSelect;
export type InsertCredential = typeof credentials.$inferInsert;

export const connections = sqliteTable(
	"connections",
	{
		id: pk("id"),
		// Timestamps
		createdAt,
		updatedAt,
		// Relations
		subjectId: fk("subject_id", () => subjects.id).notNull(),
		// Attributes
		externalId: text("external_id", { mode: "text" }).notNull(),
		provider: text("provider", { mode: "text", length: 255 }).notNull(),
	},
	(table) => [uniqueIndex("idx_connections_subject_id").on(table.provider, table.externalId)],
);

export type SelectConnection = typeof connections.$inferSelect;
export type InsertConnection = typeof connections.$inferInsert;

export const sessions = sqliteTable(
	"sessions",
	{
		id: pk("id"), // This is the refresh token value
		// Timestamps
		createdAt,
		updatedAt,
		expiresAt: timestamp("expires_at")
			.notNull()
			.$defaultFn(() => {
				let date = new Date();
				date.setDate(date.getDate() + 30);
				return date;
			}),
		// Relations
		subjectId: fk("subject_id", () => subjects.id).notNull(),
		clientId: fk("client_id", () => clients.id).notNull(),
		// Attributes
		ua: text("user_agent", { length: 512 }),
		ip: text("ip_address", { length: 64 }),
	},
	(table) => [
		index("sessions_expires_at_idx").on(table.expiresAt),
		index("sessions_subject_id_idx").on(table.subjectId),
		index("sessions_client_id_idx").on(table.clientId),
	],
);

export type SelectSession = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export const clients = sqliteTable("clients", {
	id: pk("id"),
	// Timestamps
	createdAt,
	updatedAt,
	// Attributes
	name: text("name", { mode: "text", length: 255 }).notNull(),
	secret: text("secret", { mode: "text" }).notNull(),
	redirectUri: text("redirect_uri", { mode: "text" }).notNull().unique(),
	logoutUri: text("logout_uri", { mode: "text" }).notNull(),
});

export type SelectClient = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export const subjectRelations = relations(subjects, ({ many, one }) => {
	return {
		connections: many(connections),
		credential: one(credentials),
		sessions: many(sessions),
	};
});

export const credentialsRelations = relations(credentials, ({ one }) => {
	return {
		subject: one(subjects, {
			fields: [credentials.subjectId],
			references: [subjects.id],
		}),
	};
});

export const connectionsRelations = relations(connections, ({ one }) => {
	return {
		subject: one(subjects, {
			fields: [connections.subjectId],
			references: [subjects.id],
		}),
	};
});

export const sessionsRelations = relations(sessions, ({ one }) => {
	return {
		subject: one(subjects, {
			fields: [sessions.subjectId],
			references: [subjects.id],
		}),
		client: one(clients, {
			fields: [sessions.clientId],
			references: [clients.id],
		}),
	};
});

export const clientsRelations = relations(clients, ({ many }) => {
	return {
		sessions: many(sessions),
	};
});
