
-- 1) Fix mutable search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 2) Restrict access to questions.correct_answer at the column level.
--    Authenticated/anon roles can no longer SELECT the correct_answer column.
--    RLS policies (security definer functions) still work; teacher/admin reads
--    of correct answers must go through SECURITY DEFINER RPCs.
REVOKE SELECT ON public.questions FROM anon, authenticated;
GRANT SELECT (id, test_id, type, question_text, options, display_order, marks)
  ON public.questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;

-- 3) Tighten 'questions: scoped read' to mirror tests scoping
DROP POLICY IF EXISTS "questions: scoped read" ON public.questions;
CREATE POLICY "questions: scoped read"
ON public.questions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.tests t
    JOIN public.subjects s ON s.id = t.subject_id
    WHERE t.id = questions.test_id
      AND (
        (has_role(auth.uid(), 'student'::app_role)
          AND s.class_id = student_class(auth.uid())
          AND NOT (s.stream_id IS DISTINCT FROM student_stream(auth.uid()))
          AND t.published_at IS NOT NULL)
        OR (has_role(auth.uid(), 'teacher'::app_role)
          AND teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id))
      )
  )
);

-- 4) SECURITY DEFINER RPC for teachers/admins to fetch correct answers
CREATE OR REPLACE FUNCTION public.get_question_answer(_question_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ans jsonb;
  _class uuid;
  _stream uuid;
  _subject uuid;
BEGIN
  SELECT q.correct_answer, s.class_id, s.stream_id, s.id
    INTO _ans, _class, _stream, _subject
  FROM public.questions q
  JOIN public.tests t ON t.id = q.test_id
  JOIN public.subjects s ON s.id = t.subject_id
  WHERE q.id = _question_id;

  IF _ans IS NULL THEN RETURN NULL; END IF;

  IF has_role(auth.uid(), 'admin'::app_role)
     OR (has_role(auth.uid(), 'teacher'::app_role)
         AND teacher_can_access(auth.uid(), _class, _stream, _subject))
  THEN
    RETURN _ans;
  END IF;

  RAISE EXCEPTION 'not authorized';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_question_answer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_question_answer(uuid) TO authenticated;

-- 5) Tighten storage policies on materials bucket: scope UPDATE/DELETE to
--    admins or teachers assigned to the material's class/subject.
DROP POLICY IF EXISTS "materials bucket: teacher/admin delete" ON storage.objects;
DROP POLICY IF EXISTS "materials bucket: teacher/admin update" ON storage.objects;

CREATE POLICY "materials bucket: scoped delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'materials'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.materials m
      JOIN public.chapters c ON c.id = m.chapter_id
      JOIN public.subjects s ON s.id = c.subject_id
      WHERE m.file_path = storage.objects.name
        AND teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id)
    )
  )
);

CREATE POLICY "materials bucket: scoped update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'materials'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.materials m
      JOIN public.chapters c ON c.id = m.chapter_id
      JOIN public.subjects s ON s.id = c.subject_id
      WHERE m.file_path = storage.objects.name
        AND teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id)
    )
  )
)
WITH CHECK (
  bucket_id = 'materials'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.materials m
      JOIN public.chapters c ON c.id = m.chapter_id
      JOIN public.subjects s ON s.id = c.subject_id
      WHERE m.file_path = storage.objects.name
        AND teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id)
    )
  )
);
