-- 070: rate_limit_buckets — per-IP secondary overlay (M9).
--
-- Closes docs/security/hardening/M9-per-ip-secondary-rate-limit.md. The
-- application layer (apps/server/src/http/rateLimit.ts) was extended in
-- the same change to compute TWO subjects per request:
--
--   primary   = `u:<userId>`   (authed)  | `ip:<ip>` (anon)
--   secondary = `ip:<ip>`      (authed)  | null      (anon — primary
--                                                     already keys on IP)
--
-- Both buckets share the existing rate_limit_buckets schema — a secondary
-- bucket is just a normal row whose `subject` happens to start with `ip:`.
-- No structural change is needed: the (rl_key, subject) primary key
-- already gives us atomic per-bucket UPSERTs, and the sweep index
-- (rate_limit_buckets_started_at_idx) keeps cleanup O(matched).
--
-- Why NOT a new `subject_kind` column or composite key:
--   1. The `subject` text already encodes the kind via its `u:` / `ip:`
--      prefix — splitting that into a typed column would force a write
--      across every existing application path that constructs a subject
--      string, for zero queryability gain (we never filter on kind today).
--   2. A composite (rl_key, subject_kind, subject) PK would silently
--      double-bucket rows mid-deploy: the new schema reads the old data
--      with subject_kind = '', producing a fresh (rl_key, '', subject)
--      row alongside whatever (rl_key, 'u', subject) the next request
--      writes — i.e. a hot user temporarily escapes their limit. Adding
--      a column with a backfill is more churn than the M9 fix needs.
--
-- What this migration DOES add: a partial index on `ip:`-prefixed subjects
-- so the "top-N abusing IPs over last hour" obs query stays sub-second
-- under churn. Without it, that query is a sequential scan of every active
-- bucket row — fine at 1k unique subjects, painful at 100k.
--
-- Partial index (rather than a full one) keeps the secondary overhead off
-- the `u:` primary-bucket writes, which are the bulk of insert/update
-- traffic. The text_pattern_ops opclass lets us cheaply LIKE-prefix
-- scan in dashboards: subject LIKE 'ip:%'.

CREATE INDEX IF NOT EXISTS rate_limit_buckets_ip_subject_idx
  ON rate_limit_buckets (subject text_pattern_ops, started_at DESC)
  WHERE subject LIKE 'ip:%';

COMMENT ON TABLE rate_limit_buckets IS
  'Fixed-window rate-limit buckets. One row per (rl_key, subject). Subject is u:<userId> (per-caller primary) or ip:<ip> (per-IP, used both as the anon primary and as the M9 secondary overlay for authed callers).';

COMMENT ON INDEX rate_limit_buckets_ip_subject_idx IS
  'M9 (docs/security/hardening/M9-per-ip-secondary-rate-limit.md): supports prefix scans on ip:-keyed buckets for top-abusing-IP obs queries without burdening the bulk of u:-keyed writes.';
