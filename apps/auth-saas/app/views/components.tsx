/**
 * Small reusable `remix/ui` view components for the platform dashboard: status/type/
 * role badges and a hidden method-override input, so the controllers stay declarative
 * and share the same styling and `_method` conventions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, Handle, RemixNode } from "remix/ui";

import * as s from "./styles";

/**
 * Client-side confirmation guard injected once by {@link Document}. Intercepts submits
 * from forms whose submitter carries the `js-confirm` class and confirms via the
 * button's `title`, so each button declares its confirmation prompt as a plain prop.
 */
export const CONFIRM_SCRIPT =
	"document.addEventListener('submit',function(e){" +
	"var b=e.submitter;" +
	"if(b&&b.classList.contains('js-confirm')&&!confirm(b.getAttribute('title')||'Are you sure?')){" +
	"e.preventDefault();}},true);";

/**
 * Renders a colored status badge (active vs. everything else), matching the previous
 * green/gray pill styling used for tenant and hostname status.
 *
 * @param handle - Component handle with the `status` string to display.
 * @returns A render function producing a `remix/ui` badge node.
 * @example
 * <StatusBadge status={tenant.status} />
 */
export function StatusBadge(handle: Handle<{ status: string }>): () => RemixNode {
	return () => {
		let { status } = handle.props;
		let color = status === "active" ? s.badgeGreen : s.badgeGray;
		return <span mix={[s.badge, color]}>{status}</span>;
	};
}

/**
 * Renders a colored badge for an OAuth client type (public/confidential/m2m),
 * preserving the blue/purple/orange palette from the original markup.
 *
 * @param handle - Component handle with the client `type`.
 * @returns A render function producing a `remix/ui` badge node.
 * @example
 * <ClientTypeBadge type={client.type} />
 */
export function ClientTypeBadge(handle: Handle<{ type: string }>): () => RemixNode {
	return () => {
		let { type } = handle.props;
		let color =
			type === "public" ? s.badgeBlue : type === "confidential" ? s.badgePurple : s.badgeOrange;
		return <span mix={[s.badge, color]}>{type}</span>;
	};
}

/**
 * Renders a colored badge for a user role (admin vs. other), preserving the
 * purple/gray palette from the original markup.
 *
 * @param handle - Component handle with the user `role`.
 * @returns A render function producing a `remix/ui` badge node.
 * @example
 * <RoleBadge role={user.role} />
 */
export function RoleBadge(handle: Handle<{ role: string }>): () => RemixNode {
	return () => {
		let { role } = handle.props;
		let color = role === "admin" ? s.badgePurple : s.badgeGray;
		return <span mix={[s.badge, color]}>{role}</span>;
	};
}

/**
 * Renders the hidden `_method` input used to override the HTTP method on a form
 * (e.g. to issue DELETE/PUT from an HTML `POST` form).
 *
 * @param handle - Component handle with the `value` for the `_method` field.
 * @returns A render function producing a hidden `<input name="_method">` node.
 * @example
 * <MethodInput value={routes.dashboard.tenants.users.destroy.method} />
 */
export function MethodInput(handle: Handle<{ value: string }>): () => RemixNode {
	return () => <input type="hidden" name="_method" value={handle.props.value} />;
}

/**
 * Renders a colored badge for a subscription status, mapping the status to the same
 * green/blue/gray/red palette the model's former Tailwind `getStatusColor` produced.
 * The label text is supplied as children (e.g. `Subscription.getStatusLabel(status)`).
 *
 * @param handle - Component handle with the subscription `status` and label children.
 * @returns A render function producing a `remix/ui` badge node.
 * @example
 * <SubscriptionBadge status={subscription.status}>
 *   {Subscription.getStatusLabel(subscription.status)}
 * </SubscriptionBadge>
 */
export function SubscriptionBadge(
	handle: Handle<{ status: string; children: RemixNode }>,
): () => RemixNode {
	return () => {
		let { status, children } = handle.props;
		let color =
			status === "active"
				? s.badgeGreen
				: status === "trialing"
					? s.badgeBlue
					: status === "past_due" || status === "unpaid"
						? s.badgeRed
						: s.badgeGray;
		return <span mix={[s.badge, color]}>{children}</span>;
	};
}

/** Props for {@link ConfirmButton}. */
export interface ConfirmButtonProps {
	/** Confirmation prompt shown before the form submits. */
	message: string;
	mix: CSSMixinDescriptor | CSSMixinDescriptor[];
	/** Button label. */
	children: RemixNode;
}

/**
 * A submit button that asks for confirmation before its form submits. Carries the
 * `js-confirm` class and its prompt in `title` so {@link CONFIRM_SCRIPT}, wired once
 * by {@link Document}, can confirm the submit declaratively.
 *
 * @param handle - Component handle with the prompt `message`, `mix` styling, and label.
 * @returns A render function producing the confirming submit button.
 * @example
 * <ConfirmButton mix={s.linkRed} message="Delete this user?">Delete</ConfirmButton>
 */
export function ConfirmButton(handle: Handle<ConfirmButtonProps>): () => RemixNode {
	return () => {
		let { message, mix, children } = handle.props;
		let mixes = (Array.isArray(mix) ? mix : [mix]).map((m) => s.mixFor<HTMLButtonElement>(m));
		return (
			<button mix={mixes} className="js-confirm" type="submit" title={message}>
				{children}
			</button>
		);
	};
}
