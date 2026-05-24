-- 070 down: drop the M9 per-IP partial index. Idempotent.
--
-- Local-only rollback. Production runs forward-only migrate (Railway).
-- COMMENTs on the table/index are dropped implicitly with the index;
-- the table itself stays (owned by migration 037).

DROP INDEX IF EXISTS rate_limit_buckets_ip_subject_idx;
