
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE public.profile_status AS ENUM ('pending', 'approved', 'blocked');
CREATE TYPE public.material_type AS ENUM ('pdf', 'assignment', 'question_bank', 'worksheet', 'ppt');
CREATE TYPE public.test_type AS ENUM ('practice', 'weekly', 'monthly', 'scholarship');
CREATE TYPE public.question_type AS ENUM ('mcq', 'multi_correct', 'numerical', 'true_false');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent');
CREATE TYPE public.notice_target AS ENUM ('all', 'class', 'stream');

-- ============ CORE PROFILE ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  mobile TEXT,
  avatar_url TEXT,
  status public.profile_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ TAXONOMY ============
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.classes TO authenticated, anon;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classes readable to all" ON public.classes FOR SELECT TO authenticated, anon USING (true);

CREATE TABLE public.streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);
GRANT SELECT ON public.streams TO authenticated, anon;
GRANT ALL ON public.streams TO service_role;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streams readable to all" ON public.streams FOR SELECT TO authenticated, anon USING (true);

-- ============ STUDENT / TEACHER LINKS ============
CREATE TABLE public.student_details (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id),
  stream_id UUID REFERENCES public.streams(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_details TO authenticated;
GRANT ALL ON public.student_details TO service_role;
ALTER TABLE public.student_details ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  stream_id UUID REFERENCES public.streams(id),
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id),
  stream_id UUID REFERENCES public.streams(id),
  subject_id UUID REFERENCES public.subjects(id),
  UNIQUE (teacher_id, class_id, stream_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_assignments TO authenticated;
GRANT ALL ON public.teacher_assignments TO service_role;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- ============ CONTENT ============
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type public.material_type NOT NULL DEFAULT 'pdf',
  file_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- ============ TESTS ============
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  chapter_id UUID REFERENCES public.chapters(id),
  title TEXT NOT NULL,
  type public.test_type NOT NULL DEFAULT 'practice',
  duration_minutes INT NOT NULL DEFAULT 30,
  total_marks INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT ALL ON public.tests TO service_role;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  type public.question_type NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB NOT NULL,
  marks INT NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  score NUMERIC,
  accuracy NUMERIC,
  time_taken_seconds INT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_attempts TO authenticated;
GRANT ALL ON public.test_attempts TO service_role;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.test_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  student_answer JSONB,
  is_correct BOOLEAN
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_answers TO authenticated;
GRANT ALL ON public.test_answers TO service_role;
ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;

-- ============ ATTENDANCE / NOTICES / VIEWS ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id),
  date DATE NOT NULL,
  status public.attendance_status NOT NULL,
  marked_by UUID REFERENCES public.profiles(id),
  UNIQUE (student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type public.notice_target NOT NULL DEFAULT 'all',
  target_class_id UUID REFERENCES public.classes(id),
  target_stream_id UUID REFERENCES public.streams(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.material_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (material_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_views TO authenticated;
GRANT ALL ON public.material_views TO service_role;
ALTER TABLE public.material_views ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (material_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'approved')
$$;

CREATE OR REPLACE FUNCTION public.student_class(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT class_id FROM public.student_details WHERE profile_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.student_stream(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT stream_id FROM public.student_details WHERE profile_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access(_user_id UUID, _class_id UUID, _stream_id UUID, _subject_id UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments
    WHERE teacher_id = _user_id
      AND class_id = _class_id
      AND (stream_id IS NOT DISTINCT FROM _stream_id)
      AND (_subject_id IS NULL OR subject_id IS NULL OR subject_id = _subject_id)
  )
$$;

-- match helpers for content scoped by class/stream
CREATE OR REPLACE FUNCTION public.student_can_see_subject(_user_id UUID, _subject_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subjects s
    JOIN public.student_details sd ON sd.profile_id = _user_id
    WHERE s.id = _subject_id
      AND s.class_id = sd.class_id
      AND (s.stream_id IS NOT DISTINCT FROM sd.stream_id)
  )
$$;

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "profiles: self read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "profiles: self insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles: self update basic" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles: admin delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "roles: self read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- student_details
CREATE POLICY "student_details: self read" ON public.student_details FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "student_details: self insert" ON public.student_details FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "student_details: admin manage" ON public.student_details FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- subjects
CREATE POLICY "subjects: student scoped read" ON public.subjects FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'student')
      AND class_id = public.student_class(auth.uid())
      AND (stream_id IS NOT DISTINCT FROM public.student_stream(auth.uid()))
    )
    OR (
      public.has_role(auth.uid(), 'teacher')
      AND public.teacher_can_access(auth.uid(), class_id, stream_id, id)
    )
  );
CREATE POLICY "subjects: admin manage" ON public.subjects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- chapters (inherit through subject)
CREATE POLICY "chapters: scoped read" ON public.chapters FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id AND (
         (public.has_role(auth.uid(), 'student') AND s.class_id = public.student_class(auth.uid()) AND (s.stream_id IS NOT DISTINCT FROM public.student_stream(auth.uid())))
         OR (public.has_role(auth.uid(), 'teacher') AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id))
       ))
  );
CREATE POLICY "chapters: teacher/admin manage" ON public.chapters FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id))
  );

-- materials
CREATE POLICY "materials: scoped read" ON public.materials FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.chapters c JOIN public.subjects s ON s.id = c.subject_id
      WHERE c.id = chapter_id AND (
        (public.has_role(auth.uid(), 'student') AND s.class_id = public.student_class(auth.uid()) AND (s.stream_id IS NOT DISTINCT FROM public.student_stream(auth.uid())))
        OR (public.has_role(auth.uid(), 'teacher') AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id))
      )
    )
  );
CREATE POLICY "materials: teacher/admin write" ON public.materials FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.chapters c JOIN public.subjects s ON s.id = c.subject_id
            WHERE c.id = chapter_id AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (SELECT 1 FROM public.chapters c JOIN public.subjects s ON s.id = c.subject_id
            WHERE c.id = chapter_id AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id))
  );

-- tests
CREATE POLICY "tests: scoped read" ON public.tests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.subjects s WHERE s.id = subject_id AND (
        (public.has_role(auth.uid(), 'student') AND s.class_id = public.student_class(auth.uid()) AND (s.stream_id IS NOT DISTINCT FROM public.student_stream(auth.uid())) AND published_at IS NOT NULL)
        OR (public.has_role(auth.uid(), 'teacher') AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id))
      )
    )
  );
CREATE POLICY "tests: teacher/admin write" ON public.tests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id)))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_id AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id)));

-- questions
CREATE POLICY "questions: scoped read" ON public.questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_id));
CREATE POLICY "questions: teacher/admin write" ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.tests t JOIN public.subjects s ON s.id = t.subject_id WHERE t.id = test_id AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id)))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.tests t JOIN public.subjects s ON s.id = t.subject_id WHERE t.id = test_id AND public.teacher_can_access(auth.uid(), s.class_id, s.stream_id, s.id)));

-- test_attempts (student owns their attempts)
CREATE POLICY "attempts: self read" ON public.test_attempts FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "attempts: self write" ON public.test_attempts FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "attempts: self update" ON public.test_attempts FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

CREATE POLICY "answers: self read" ON public.test_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND (a.student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))));
CREATE POLICY "answers: self write" ON public.test_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_attempts a WHERE a.id = attempt_id AND a.student_id = auth.uid()));

-- attendance
CREATE POLICY "attendance: self read" ON public.attendance FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "attendance: teacher/admin write" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));

-- notifications
CREATE POLICY "notices: scoped read" ON public.notifications FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR target_type = 'all'
    OR (target_type = 'class' AND target_class_id = public.student_class(auth.uid()))
    OR (target_type = 'stream' AND target_stream_id = public.student_stream(auth.uid()))
    OR public.has_role(auth.uid(), 'teacher')
  );
CREATE POLICY "notices: admin write" ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));

-- material_views & bookmarks (self only)
CREATE POLICY "views: self" ON public.material_views FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "bookmarks: self" ON public.bookmarks FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- teacher_assignments
CREATE POLICY "assignments: read" ON public.teacher_assignments FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "assignments: admin write" ON public.teacher_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, mobile, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'mobile',
    'pending'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SEED ============
INSERT INTO public.classes (name, display_order) VALUES
  ('Class 9', 9), ('Class 10', 10), ('Class 11', 11), ('Class 12', 12);
INSERT INTO public.streams (name) VALUES ('Science'), ('Commerce');
