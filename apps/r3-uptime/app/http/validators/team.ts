/**
 * Form validation schemas for team settings, membership, and lifecycle actions:
 * update/delete a team, remove/promote/demote a member, create an additional team,
 * and leave a team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

const TEAM_ROLES = ["member", "admin"] as const;

/** Validates the `update-team` action form body. */
export const UpdateTeamSchema = f.object({
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	logo: f.field(s.optional(s.string())),
});

export type UpdateTeamValues = s.InferOutput<typeof UpdateTeamSchema>;

/** Validates the `delete-team` action form body: a typed "DELETE" confirmation. */
export const DeleteTeamSchema = f.object({ confirmation: f.field(s.literal("DELETE")) });

/** Validates the `remove-member` action form body. */
export const RemoveMemberSchema = f.object({
	subject_id: f.field(s.string()),
	email: f.field(s.string()),
});

/** Validates the `change-role` action form body. */
export const ChangeRoleSchema = f.object({
	subject_id: f.field(s.string()),
	role: f.field(s.enum_(TEAM_ROLES)),
});

/** Validates the `create-team` action form body. */
export const CreateTeamSchema = f.object({
	name: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
});

/** Validates the `leave-team` action form body. */
export const LeaveTeamSchema = f.object({ team_id: f.field(s.string()) });
