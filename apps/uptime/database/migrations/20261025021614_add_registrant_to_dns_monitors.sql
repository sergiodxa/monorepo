-- The registrant and the fields the registry withheld, from each RDAP lookup
--
-- `registrant` is the registrant contact's organization, or its name when it has none.
-- `registration_redacted` is a JSON array of the RFC 9537 fields the registry redacted,
-- such as `registrant.name`, so the page can say a value is hidden rather than missing.
-- Both stay NULL until the next lookup of each monitor.

ALTER TABLE "dns_monitors" ADD COLUMN "registrant" TEXT;

ALTER TABLE "dns_monitors" ADD COLUMN "registration_redacted" TEXT;
