-- Internal tenants (e.g. sso.sergiodxa.com, sso.blog.sergiodxa.com) are exempt
-- from Polar billing: they are the platform owner's own tenants, not customers.
ALTER TABLE tenants ADD COLUMN internal INTEGER NOT NULL DEFAULT 0;
