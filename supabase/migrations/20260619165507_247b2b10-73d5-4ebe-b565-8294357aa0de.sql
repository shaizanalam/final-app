
CREATE POLICY "materials bucket: scoped read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'materials' AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.materials m
      JOIN public.chapters c ON c.id = m.chapter_id
      JOIN public.subjects s ON s.id = c.subject_id
      WHERE m.file_path = storage.objects.name AND (
        (public.has_role(auth.uid(), 'student') AND s.class_id = public.student_class(auth.uid()) AND (s.stream_id IS NOT DISTINCT FROM public.student_stream(auth.uid())))
        OR (public.has_role(auth.uid(), 'teacher') AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id))
      )
    )
  )
);

CREATE POLICY "materials bucket: teacher/admin write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')));

CREATE POLICY "materials bucket: teacher/admin update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')))
WITH CHECK (bucket_id = 'materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')));

CREATE POLICY "materials bucket: teacher/admin delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')));
