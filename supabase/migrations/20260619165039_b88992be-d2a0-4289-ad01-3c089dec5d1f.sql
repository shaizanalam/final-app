
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_class(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_stream(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.teacher_can_access(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_can_see_subject(uuid, uuid) FROM PUBLIC, anon;
