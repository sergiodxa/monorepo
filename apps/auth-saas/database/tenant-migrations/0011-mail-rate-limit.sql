-- One row per address, its running counts against the shared hourly and daily send
-- caps: a counter, not an audit log, so no kind or timestamp per send is kept.
CREATE TABLE IF NOT EXISTS mail_send_envelopes (
	address TEXT PRIMARY KEY,
	hour_window_start INTEGER NOT NULL,
	hour_count INTEGER NOT NULL,
	day_window_start INTEGER NOT NULL,
	day_count INTEGER NOT NULL
);
