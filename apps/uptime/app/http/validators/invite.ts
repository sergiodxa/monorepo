/**
 * Form validation schemas for the create/revoke invite actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

/** Validates the `create-invite` action form body. */
export const CreateInviteSchema = f.object({ email: f.field(s.string().pipe(checks.email())) });

/** Validates the `revoke-invite` action form body. */
export const RevokeInviteSchema = f.object({ invite_id: f.field(s.string()) });
