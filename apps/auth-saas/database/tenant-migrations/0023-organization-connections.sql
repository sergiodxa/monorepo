-- An enterprise connection's optional owning organization (see organizations.ts,
-- saml-connections.ts): the `saml` connection a domain's verified organization
-- claims, so a sign-in page taking an address can route it to that organization's
-- own directory instead of a list every customer's entry appears on. Added to the
-- shared `connections` table rather than the SAML-only `connection_saml` table
-- because it is the record itself being scoped, not its protocol-specific
-- configuration; a social connection simply never sets it.
ALTER TABLE connections ADD COLUMN organization_id TEXT;

CREATE INDEX connections_by_organization ON connections (organization_id);
