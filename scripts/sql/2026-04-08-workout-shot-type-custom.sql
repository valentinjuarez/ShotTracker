-- Allow CUSTOM as a valid workout-level shot type.
-- Session spots keep their own per-spot shot_type (2PT/3PT).

DO $$
DECLARE
  c RECORD;
BEGIN
  -- Drop existing shot_type-related CHECK constraints on workouts
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'workouts'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%shot_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.workouts DROP CONSTRAINT %I', c.conname);
  END LOOP;

  -- Recreate canonical CHECK for workouts
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workouts'
      AND column_name = 'shot_type'
  ) THEN
    ALTER TABLE public.workouts
      ADD CONSTRAINT workouts_shot_type_check
      CHECK (shot_type IN ('2PT', '3PT', 'CUSTOM'));
  END IF;

  -- If team_workouts stores shot_type snapshot, keep it aligned
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_workouts'
      AND column_name = 'shot_type'
  ) THEN
    FOR c IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'team_workouts'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%shot_type%'
    LOOP
      EXECUTE format('ALTER TABLE public.team_workouts DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.team_workouts
      ADD CONSTRAINT team_workouts_shot_type_check
      CHECK (shot_type IN ('2PT', '3PT', 'CUSTOM'));
  END IF;
END $$;
