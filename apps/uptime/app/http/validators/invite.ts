/**
 * Form validation schemas for the create/revoke invite actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import { deliverableAddress, emailAddress } from "~/app/http/validators/email-address";

/** Validates the `create-invite` action form body; `email` comes out in its deliverable form. */
export const CreateInviteSchema = f.object({
	email: f.field(s.string().pipe(emailAddress()).transform(deliverableAddress)),
});

/** Validates the `revoke-invite` action form body. */
export const RevokeInviteSchema = f.object({ invite_id: f.field(s.string()) });
