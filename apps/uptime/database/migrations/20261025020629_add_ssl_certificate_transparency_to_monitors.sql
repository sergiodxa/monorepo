-- Certificate expiry read from Certificate Transparency logs
--
-- `ssl_expiry_source` says where `ssl_expires_at` comes from: `manual` is a date the
-- user typed, which overrides the logs, and `transparency` is the newest valid
-- certificate the daily check found for the monitor's host. Monitors that already
-- carry a typed date keep it as their override. `ssl_transparency_status` is the
-- last lookup's outcome (`found`, `not-found` or `unavailable`), null before the first.

ALTER TABLE "monitors" ADD COLUMN "ssl_expiry_source" TEXT NOT NULL DEFAULT 'transparency';

UPDATE "monitors" SET "ssl_expiry_source" = 'manual' WHERE "ssl_expires_at" IS NOT NULL;

ALTER TABLE "monitors" ADD COLUMN "ssl_transparency_status" TEXT;

ALTER TABLE "monitors" ADD COLUMN "ssl_transparency_checked_at" INTEGER;
