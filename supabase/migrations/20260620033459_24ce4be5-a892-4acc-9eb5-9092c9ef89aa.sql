
-- Allow admins to manage user roles
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "roles: admin manage"
ON public.user_roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Grade a test attempt server-side without exposing correct answers
CREATE OR REPLACE FUNCTION public.grade_attempt(_attempt_id uuid)
RETURNS TABLE(score numeric, accuracy numeric, total numeric, correct_count int, total_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid;
  _test uuid;
  _score numeric := 0;
  _max numeric := 0;
  _correct int := 0;
  _count int := 0;
BEGIN
  SELECT student_id, test_id INTO _student, _test FROM public.test_attempts WHERE id = _attempt_id;
  IF _student IS NULL THEN RAISE EXCEPTION 'attempt not found'; END IF;

  IF _student <> auth.uid()
     AND NOT has_role(auth.uid(), 'admin'::app_role)
     AND NOT has_role(auth.uid(), 'teacher'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Mark each answer correct/incorrect by direct jsonb compare
  UPDATE public.test_answers ta
  SET is_correct = (ta.student_answer IS NOT NULL AND ta.student_answer = q.correct_answer)
  FROM public.questions q
  WHERE ta.question_id = q.id AND ta.attempt_id = _attempt_id;

  SELECT
    COALESCE(SUM(CASE WHEN ta.is_correct THEN q.marks ELSE 0 END), 0),
    COALESCE(SUM(q.marks), 0),
    COUNT(*) FILTER (WHERE ta.is_correct),
    COUNT(*)
  INTO _score, _max, _correct, _count
  FROM public.questions q
  LEFT JOIN public.test_answers ta
    ON ta.question_id = q.id AND ta.attempt_id = _attempt_id
  WHERE q.test_id = _test;

  UPDATE public.test_attempts
  SET score = _score,
      accuracy = CASE WHEN _count > 0 THEN (_correct::numeric / _count) * 100 ELSE 0 END,
      submitted_at = COALESCE(submitted_at, now()),
      time_taken_seconds = COALESCE(time_taken_seconds, EXTRACT(EPOCH FROM (now() - started_at))::int)
  WHERE id = _attempt_id;

  RETURN QUERY SELECT _score, (CASE WHEN _count > 0 THEN (_correct::numeric / _count) * 100 ELSE 0 END), _max, _correct, _count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grade_attempt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_attempt(uuid) TO authenticated;

-- Keep tests.total_marks in sync with the sum of question marks
CREATE OR REPLACE FUNCTION public.sync_test_total_marks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _tid uuid;
BEGIN
  _tid := COALESCE(NEW.test_id, OLD.test_id);
  UPDATE public.tests
  SET total_marks = COALESCE((SELECT SUM(marks) FROM public.questions WHERE test_id = _tid), 0)
  WHERE id = _tid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS questions_sync_total_marks ON public.questions;
CREATE TRIGGER questions_sync_total_marks
AFTER INSERT OR UPDATE OR DELETE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.sync_test_total_marks();
