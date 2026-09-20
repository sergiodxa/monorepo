-- The per-tenant daily active user meter (see metering.ts): which subjects have
-- already authenticated today, and the one row per day the cap, the warning
-- path and the daily close all read and write.
CREATE TABLE dau_seen (day INTEGER, subject TEXT, PRIMARY KEY (day, subject)) WITHOUT ROWID;
CREATE TABLE dau_day (day INTEGER PRIMARY KEY, subjects INTEGER NOT NULL DEFAULT 0,
	sessions INTEGER NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0,
	notices INTEGER NOT NULL DEFAULT 0, closed INTEGER NOT NULL DEFAULT 0);
