-- Prep antes de unique em appointment_id (DentalEncounter / Encounter).
-- PostgreSQL: vários NULL são OK em UNIQUE; só valores não-nulos colidem.
-- Mantém o encounter mais recente por appointment_id; nullifica duplicatas antigas.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dental_encounters'
      AND column_name = 'appointment_id'
  ) THEN
    WITH dups AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY appointment_id
               ORDER BY created_at DESC NULLS LAST, id DESC
             ) AS rn
      FROM dental_encounters
      WHERE appointment_id IS NOT NULL
    )
    UPDATE dental_encounters de
    SET appointment_id = NULL,
        updated_at = NOW()
    FROM dups
    WHERE de.id = dups.id AND dups.rn > 1;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'encounters'
      AND column_name = 'appointment_id'
  ) THEN
    WITH dups AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY appointment_id
               ORDER BY created_at DESC NULLS LAST, id DESC
             ) AS rn
      FROM encounters
      WHERE appointment_id IS NOT NULL
    )
    UPDATE encounters e
    SET appointment_id = NULL,
        updated_at = NOW()
    FROM dups
    WHERE e.id = dups.id AND dups.rn > 1;
  END IF;
END $$;
