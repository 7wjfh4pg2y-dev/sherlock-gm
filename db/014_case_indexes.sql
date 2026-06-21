-- ── Foreign-key / lookup indexes ──
-- Every per-case table is fetched and realtime-filtered by case_id
-- (filter: case_id=eq.{caseId}), but Postgres does not auto-index foreign-key
-- columns. These indexes keep per-case loads and cascading deletes cheap as the
-- data grows. Idempotent and safe to run on an existing database.

create index if not exists case_questions_case_id_idx
  on public.case_questions (case_id);

create index if not exists question_answers_case_id_idx
  on public.question_answers (case_id);

create index if not exists map_strokes_case_id_idx
  on public.map_strokes (case_id);

-- case_newspapers' case_id is already covered by the leading column of its
-- (case_id, newspaper_id) primary key; index the other FK for delete cascades.
create index if not exists case_newspapers_newspaper_id_idx
  on public.case_newspapers (newspaper_id);
