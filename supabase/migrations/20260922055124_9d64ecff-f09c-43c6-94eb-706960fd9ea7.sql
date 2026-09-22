-- Derived observations are written by the synthesis job itself. Bumping the
-- data version on those writes made every build cancel itself as a late write.
-- Source-level changes (link, exclude, correct, delete) still bump the version,
-- which is the guard that must reject stale writes.
DROP TRIGGER IF EXISTS journey_observations_invalidate ON public.journey_observations;