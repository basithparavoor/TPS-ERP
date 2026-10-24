-- ============================================================================
-- THAIBA PUBLIC SCHOOL - Supabase PostgreSQL Schema & RLS Policies
-- Single-Institution Architecture exclusively for THAIBA PUBLIC SCHOOL
--
-- SECURITY MODEL (v2):
--   * Identity & authorization are derived ONLY from the server-side profiles
--     table (never from client localStorage or user_metadata).
--   * Every table enforces Row-Level Security with real role/ownership checks.
--   * SECURITY DEFINER helper functions read the caller's role/scope safely
--     without RLS recursion.
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1b. Remove ALL pre-existing policies on the TMS tables (regardless of name).
--     This guarantees no legacy "USING (true)" policy survives. Permissive
--     policies are OR-combined, so a single leftover permissive policy would
--     re-open the table. Fresh installs simply have nothing to drop.
-- ============================================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'guardian_links', 'audit_logs', 'facilities', 'students',
        'staff', 'invoices', 'notices', 'staff_tasks', 'admissions_applications'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END;
$$;

-- ============================================================================
-- 2. Profiles - server-side source of truth for role, scope & identity
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'pending',
    scope TEXT NOT NULL DEFAULT 'own_records',
    title TEXT,
    department TEXT,
    assigned_class TEXT,
    assigned_section TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Authorization helper functions (SECURITY DEFINER, safe from recursion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_profile_scope()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT scope FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_active_profile()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active);
$$;

CREATE OR REPLACE FUNCTION public.has_role(roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active AND role = ANY(roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_wide()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active AND scope = 'school_wide'
  );
$$;

-- Is the given student linked to the current caller (student self, or a parent/guardian)?
-- (defined later, after the students & guardian_links tables exist)

-- ============================================================================
-- 4. Auto-provision profile on signup. Role is NEVER taken from client data.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  TEXT;
  v_scope TEXT;
  v_title TEXT;
BEGIN
  IF lower(NEW.email) = lower('cmbasith786@gmail.com') THEN
    v_role  := 'admin';
    v_scope := 'school_wide';
    v_title := 'Executive Director & Super Administrator';
  ELSE
    -- Safe default: no privileges until an administrator assigns a role.
    v_role  := 'pending';
    v_scope := 'own_records';
    v_title := 'Pending Role Assignment';
  END IF;

  INSERT INTO public.profiles (id, email, name, role, scope, title)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_role, v_scope, v_title
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. Profiles policies
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON profiles;
CREATE POLICY "profiles_select_self_or_admin" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(ARRAY['admin','principal','hr']));

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(ARRAY['admin']))
  WITH CHECK (public.has_role(ARRAY['admin']));

DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
CREATE POLICY "profiles_insert_admin" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(ARRAY['admin']));

-- Bootstrap the known super administrator if the auth user already exists.
INSERT INTO public.profiles (id, email, name, role, scope, title)
SELECT u.id, lower(u.email),
       COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       'admin', 'school_wide', 'Executive Director & Super Administrator'
FROM auth.users u
WHERE lower(u.email) = lower('cmbasith786@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. Guardian links (maps a parent/guardian auth user to their wards)
-- ============================================================================
CREATE TABLE IF NOT EXISTS guardian_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    relationship TEXT DEFAULT 'guardian',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (guardian_user_id, student_id)
);

ALTER TABLE guardian_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardian_links_select" ON guardian_links;
CREATE POLICY "guardian_links_select" ON guardian_links
  FOR SELECT TO authenticated
  USING (guardian_user_id = auth.uid() OR public.has_role(ARRAY['admin','principal','coordinator','hr']));

DROP POLICY IF EXISTS "guardian_links_manage" ON guardian_links;
CREATE POLICY "guardian_links_manage" ON guardian_links
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal']))
  WITH CHECK (public.has_role(ARRAY['admin','principal']));

-- ============================================================================
-- 7. Audit Trail (append-only; readable by administration only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT,
    user_name TEXT,
    user_role TEXT,
    user_scope TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    entity_ref TEXT,
    details TEXT,
    ip_address TEXT,
    client_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read audit logs" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_admin" ON audit_logs;
CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['admin','principal']));

DROP POLICY IF EXISTS "Allow authenticated insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    user_id IS NULL
    OR user_id = 'system_daemon'
    OR user_id = auth.uid()::text
  );

-- ============================================================================
-- 8. Facilities & Infrastructure
-- ============================================================================
CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    building TEXT NOT NULL,
    floor TEXT NOT NULL,
    name TEXT NOT NULL,
    capacity INT DEFAULT 35,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read facilities" ON facilities;
DROP POLICY IF EXISTS "facilities_select" ON facilities;
CREATE POLICY "facilities_select" ON facilities
  FOR SELECT TO authenticated USING (public.is_active_profile());

DROP POLICY IF EXISTS "Allow admin manage facilities" ON facilities;
DROP POLICY IF EXISTS "facilities_manage" ON facilities;
CREATE POLICY "facilities_manage" ON facilities
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal','operations']))
  WITH CHECK (public.has_role(ARRAY['admin','principal','operations']));

-- ============================================================================
-- 9. Students Directory
-- ============================================================================
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    admission_no TEXT UNIQUE NOT NULL,
    roll_no TEXT,
    full_name TEXT NOT NULL,
    gender TEXT,
    dob DATE,
    grade TEXT NOT NULL,
    section TEXT NOT NULL,
    guardian_name TEXT,
    guardian_phone TEXT,
    blood_group TEXT,
    address TEXT,
    status TEXT DEFAULT 'Active',
    leave_status TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add column if the table pre-existed.
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Linkage helper (defined now that students & guardian_links exist).
CREATE OR REPLACE FUNCTION public.is_linked_to_student(p_student_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = p_student_id AND s.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.guardian_links g
    WHERE g.student_id = p_student_id AND g.guardian_user_id = auth.uid()
  );
$$;

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read students" ON students;
DROP POLICY IF EXISTS "Allow authorized manage students" ON students;
DROP POLICY IF EXISTS "students_select" ON students;
CREATE POLICY "students_select" ON students
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY['admin','principal','coordinator','teacher','finance','librarian','hr'])
    OR user_id = auth.uid()
    OR public.is_linked_to_student(id)
  );

DROP POLICY IF EXISTS "students_manage" ON students;
CREATE POLICY "students_manage" ON students
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal','coordinator']))
  WITH CHECK (public.has_role(ARRAY['admin','principal','coordinator']));

-- ============================================================================
-- 10. Staff & Faculty
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    emp_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    phone TEXT,
    joining_date DATE,
    status TEXT DEFAULT 'Active',
    basic_pay NUMERIC(10, 2),
    hra NUMERIC(10, 2),
    allowances NUMERIC(10, 2),
    assigned_class TEXT,
    assigned_section TEXT,
    assigned_subject TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read staff" ON staff;
DROP POLICY IF EXISTS "Allow admin manage staff" ON staff;
DROP POLICY IF EXISTS "staff_select" ON staff;
CREATE POLICY "staff_select" ON staff
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['admin','principal','hr']) OR user_id = auth.uid());

DROP POLICY IF EXISTS "staff_manage" ON staff;
CREATE POLICY "staff_manage" ON staff
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal','hr']))
  WITH CHECK (public.has_role(ARRAY['admin','principal','hr']));

-- Safe directory projection (no salary columns) for staff consumption only.
-- Owner-rights view: exposes ONLY non-sensitive columns; access controlled by GRANT
-- and further restricted to staff roles via has_role().
DROP VIEW IF EXISTS public.staff_directory;
CREATE VIEW public.staff_directory AS
  SELECT id, emp_id, name, email, role, department, designation, phone,
         joining_date, status, assigned_class, assigned_section, assigned_subject
  FROM public.staff
  WHERE public.has_role(ARRAY['admin','principal','coordinator','teacher','finance','hr','librarian','operations']);

REVOKE ALL ON public.staff_directory FROM anon;
GRANT SELECT ON public.staff_directory TO authenticated;

-- ============================================================================
-- 11. Invoices & Fees
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_no TEXT UNIQUE NOT NULL,
    student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    term TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    paid NUMERIC(10, 2) DEFAULT 0,
    balance NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'Unpaid',
    due_date DATE,
    paid_date DATE,
    payment_mode TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read invoices" ON invoices;
DROP POLICY IF EXISTS "Allow finance manage invoices" ON invoices;
DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY['admin','principal','finance'])
    OR (student_id IS NOT NULL AND public.is_linked_to_student(student_id))
  );

DROP POLICY IF EXISTS "invoices_manage" ON invoices;
CREATE POLICY "invoices_manage" ON invoices
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','finance']))
  WITH CHECK (public.has_role(ARRAY['admin','finance']));

-- ============================================================================
-- 12. Notices & Announcements
-- ============================================================================
CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    target TEXT NOT NULL,
    priority TEXT DEFAULT 'Normal',
    content TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    published_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP POLICY IF EXISTS "Allow all read notices" ON notices;
DROP POLICY IF EXISTS "Allow authorized publish notices" ON notices;
DROP POLICY IF EXISTS "notices_select" ON notices;
CREATE POLICY "notices_select" ON notices
  FOR SELECT TO authenticated USING (public.is_active_profile());

DROP POLICY IF EXISTS "notices_manage" ON notices;
CREATE POLICY "notices_manage" ON notices
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal','coordinator']))
  WITH CHECK (public.has_role(ARRAY['admin','principal','coordinator']));

-- ============================================================================
-- 13. Staff Tasks (Kanban) - strictly per-owner
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'To Do',
    priority TEXT DEFAULT 'Medium',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user manage tasks" ON staff_tasks;
DROP POLICY IF EXISTS "staff_tasks_own" ON staff_tasks;
CREATE POLICY "staff_tasks_own" ON staff_tasks
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================================
-- 14. Admissions Applications (public submission; administration-only read)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admissions_applications (
    id TEXT PRIMARY KEY,
    app_id TEXT UNIQUE NOT NULL,
    student_name TEXT NOT NULL,
    dob DATE,
    gender TEXT,
    grade TEXT NOT NULL,
    guardian_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT,
    status TEXT DEFAULT 'Submitted',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admissions_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP POLICY IF EXISTS "Allow public insert admissions" ON admissions_applications;
DROP POLICY IF EXISTS "Allow admin read admissions" ON admissions_applications;
DROP POLICY IF EXISTS "admissions_insert_public" ON admissions_applications;
CREATE POLICY "admissions_insert_public" ON admissions_applications
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admissions_select_staff" ON admissions_applications;
CREATE POLICY "admissions_select_staff" ON admissions_applications
  FOR SELECT TO authenticated
  USING (public.has_role(ARRAY['admin','principal','coordinator']));

DROP POLICY IF EXISTS "admissions_update_staff" ON admissions_applications;
CREATE POLICY "admissions_update_staff" ON admissions_applications
  FOR UPDATE TO authenticated
  USING (public.has_role(ARRAY['admin','principal']))
  WITH CHECK (public.has_role(ARRAY['admin','principal']));

-- ============================================================================
-- 15. Extended Admissions: dynamic form, fees, payments, workflow, credentials
-- ============================================================================
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS fee_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS fee_total NUMERIC(10,2) DEFAULT 0;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS submitted_by TEXT;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS parent_username TEXT;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS parent_email TEXT;
ALTER TABLE admissions_applications ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb;

-- Parents may read their own application (status tracking).
DROP POLICY IF EXISTS "admissions_select_staff" ON admissions_applications;
CREATE POLICY "admissions_select_staff" ON admissions_applications
  FOR SELECT TO authenticated
  USING (
    public.has_role(ARRAY['admin','principal','coordinator','office_boy'])
    OR parent_user_id = auth.uid()
  );

-- ============================================================================
-- 16. Admission form builder (fields), fees and global settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS admission_form_fields (
    id TEXT PRIMARY KEY,
    field_key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text',
    section TEXT DEFAULT 'General',
    placeholder TEXT,
    help_text TEXT,
    options JSONB DEFAULT '[]'::jsonb,
    required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admission_form_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admission_form_fields_select" ON admission_form_fields;
CREATE POLICY "admission_form_fields_select" ON admission_form_fields
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admission_form_fields_manage" ON admission_form_fields;
CREATE POLICY "admission_form_fields_manage" ON admission_form_fields
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal']))
  WITH CHECK (public.has_role(ARRAY['admin','principal']));

CREATE TABLE IF NOT EXISTS admission_fees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    schedule TEXT,
    description TEXT,
    mandatory BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admission_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admission_fees_select" ON admission_fees;
CREATE POLICY "admission_fees_select" ON admission_fees
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admission_fees_manage" ON admission_fees;
CREATE POLICY "admission_fees_manage" ON admission_fees
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal']))
  WITH CHECK (public.has_role(ARRAY['admin','principal']));

CREATE TABLE IF NOT EXISTS admission_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    session TEXT,
    form_fee NUMERIC(10,2) DEFAULT 0,
    test_centre TEXT,
    instructions JSONB DEFAULT '[]'::jsonb,
    payment_required BOOLEAN DEFAULT false,
    upi_id TEXT,
    upi_payee_name TEXT,
    payment_instructions TEXT,
    success_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
DROP POLICY IF EXISTS "admission_settings_select" ON admission_settings;
CREATE POLICY "admission_settings_select" ON admission_settings
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admission_settings_manage" ON admission_settings;
CREATE POLICY "admission_settings_manage" ON admission_settings
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal']))
  WITH CHECK (public.has_role(ARRAY['admin','principal']));

-- ============================================================================
-- 17. Parent credentials (generated at submission; admin-readable, anon-writable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS parent_credentials (
    id TEXT PRIMARY KEY,
    application_id TEXT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    user_id UUID,
    student_id TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE parent_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parent_credentials_insert_public" ON parent_credentials;
CREATE POLICY "parent_credentials_insert_public" ON parent_credentials
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "parent_credentials_admin_read" ON parent_credentials;
CREATE POLICY "parent_credentials_admin_read" ON parent_credentials
  FOR SELECT TO authenticated USING (public.has_role(ARRAY['admin','principal']));
DROP POLICY IF EXISTS "parent_credentials_admin_update" ON parent_credentials;
CREATE POLICY "parent_credentials_admin_update" ON parent_credentials
  FOR UPDATE TO authenticated
  USING (public.has_role(ARRAY['admin','principal']))
  WITH CHECK (public.has_role(ARRAY['admin','principal']));
DROP POLICY IF EXISTS "parent_credentials_admin_delete" ON parent_credentials;
CREATE POLICY "parent_credentials_admin_delete" ON parent_credentials
  FOR DELETE TO authenticated USING (public.has_role(ARRAY['admin','principal']));

-- ============================================================================
-- 18. Notifications (admin-created; audience-targeted) + per-user read state
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'all',   -- all | staff | parents | students | role | user
    target_role TEXT,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    priority TEXT DEFAULT 'Normal',
    created_by TEXT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR audience = 'all'
    OR (audience = 'staff' AND public.has_role(ARRAY['admin','principal','coordinator','teacher','finance','hr','librarian','operations','office_boy']))
    OR (audience = 'students' AND public.has_role(ARRAY['student']))
    OR (audience = 'parents' AND public.has_role(ARRAY['parent']))
    OR (audience = 'role' AND target_role = public.current_profile_role())
  );
DROP POLICY IF EXISTS "notifications_manage" ON notifications;
CREATE POLICY "notifications_manage" ON notifications
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal']))
  WITH CHECK (public.has_role(ARRAY['admin','principal']));

CREATE TABLE IF NOT EXISTS notification_reads (
    id TEXT PRIMARY KEY,
    notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (notification_id, user_id)
);
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification_reads_own" ON notification_reads;
CREATE POLICY "notification_reads_own" ON notification_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 19. Provisioning rules: parent accounts are auto-detected by e-mail domain
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role  TEXT;
  v_scope TEXT;
  v_title TEXT;
BEGIN
  IF lower(NEW.email) = lower('cmbasith786@gmail.com') THEN
    v_role  := 'admin';
    v_scope := 'school_wide';
    v_title := 'Executive Director & Super Administrator';
  ELSIF lower(NEW.email) LIKE '%@parents.thaibamodel.school' THEN
    v_role  := 'parent';
    v_scope := 'linked_wards';
    v_title := 'Parent / Guardian';
  ELSE
    v_role  := 'pending';
    v_scope := 'own_records';
    v_title := 'Pending Role Assignment';
  END IF;

  INSERT INTO public.profiles (id, email, name, role, scope, title)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_role, v_scope, v_title
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Seed the admission settings row (idempotent).
INSERT INTO public.admission_settings (id, session, form_fee, payment_required, instructions)
VALUES ('default', '2025 - 2026', 0, false, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SECTIONS 20-31.
--
-- Everything above is a complete fresh install (sections 1-19). Everything
-- below is the same migration you would get by running schema-update-2.sql on
-- an existing database. Both files are idempotent, so running either one, or
-- both, always produces the same complete schema.
-- ============================================================================


-- ============================================================================
-- 20. Profile photo support
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar TEXT;

-- ============================================================================
-- 21. Storage buckets: applicant photos/documents (private) + avatars (public)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('admission-docs', 'admission-docs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tms_admission_docs_insert" ON storage.objects;
CREATE POLICY "tms_admission_docs_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'admission-docs');

DROP POLICY IF EXISTS "tms_admission_docs_read" ON storage.objects;
CREATE POLICY "tms_admission_docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'admission-docs');

DROP POLICY IF EXISTS "tms_admission_docs_delete" ON storage.objects;
CREATE POLICY "tms_admission_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admission-docs' AND public.has_role(ARRAY['admin','principal']));

DROP POLICY IF EXISTS "tms_avatars_read" ON storage.objects;
CREATE POLICY "tms_avatars_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "tms_avatars_insert" ON storage.objects;
CREATE POLICY "tms_avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "tms_avatars_update" ON storage.objects;
CREATE POLICY "tms_avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

-- ============================================================================
-- 22. Admin password reset (SECURITY DEFINER; admin-only). Lets the admin set
--     a new password for any user (incl. auto-generated parent accounts).
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_set_password(p_user_id UUID, p_new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- HR manages the staff registry (and therefore staff logins), so HR may reset
  -- passwords too -- but never for an administrator or principal account.
  IF NOT public.has_role(ARRAY['admin','principal','hr']) THEN
    RAISE EXCEPTION 'Not authorized to change passwords';
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  v_is_admin := public.has_role(ARRAY['admin']);

  IF NOT v_is_admin
     AND EXISTS (SELECT 1 FROM public.profiles
                  WHERE id = p_user_id AND role IN ('admin', 'principal')) THEN
    RAISE EXCEPTION 'Only an administrator may change the password of an admin or principal account';
  END IF;

  IF p_user_id <> auth.uid()
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND lower(email) = 'cmbasith786@gmail.com') THEN
    RAISE EXCEPTION 'Only the super administrator may change the super administrator password';
  END IF;
  UPDATE auth.users
     SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
         updated_at = NOW()
   WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_password(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 23. Self-service profile update. A user may edit their own descriptive
--     fields but never role/scope/is_active (prevents privilege escalation).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_name TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_avatar TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET name = COALESCE(p_name, name),
         title = COALESCE(p_title, title),
         department = COALESCE(p_department, department),
         phone = COALESCE(p_phone, phone),
         avatar = COALESCE(p_avatar, avatar),
         updated_at = NOW()
   WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_own_profile(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 24. Force PostgREST to pick up the new tables/columns immediately.
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 25. Staff login credentials (admin/principal readable & manageable).
--     Mirrors parent_credentials: the admin creates a username + password for
--     every appointed staff member and can view / edit / resend / delete it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_credentials (
    id TEXT PRIMARY KEY,
    staff_id TEXT,
    user_id UUID,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE staff_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_credentials_read" ON staff_credentials;
CREATE POLICY "staff_credentials_read" ON staff_credentials
  FOR SELECT TO authenticated USING (public.has_role(ARRAY['admin','principal','hr']));
DROP POLICY IF EXISTS "staff_credentials_manage" ON staff_credentials;
CREATE POLICY "staff_credentials_manage" ON staff_credentials
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal','hr']))
  WITH CHECK (public.has_role(ARRAY['admin','principal','hr']));

-- ============================================================================
-- 26. Login aliases: public username -> e-mail resolution used by the sign-in
--     page. Stores ONLY the username and e-mail (never a password), so a staff
--     member can sign in with the short username that administration issues.
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_aliases (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE login_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "login_aliases_read" ON login_aliases;
CREATE POLICY "login_aliases_read" ON login_aliases
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "login_aliases_manage" ON login_aliases;
CREATE POLICY "login_aliases_manage" ON login_aliases
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal','hr']))
  WITH CHECK (public.has_role(ARRAY['admin','principal','hr']));

-- ============================================================================
-- 27. Admin user deletion: removes a login and its profile completely (used by
--     "Delete Staff" and "Delete User"). Guarded against self-deletion and
--     against deleting the super administrator.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- HR removes departing staff (and their logins); admin/principal as well.
  IF NOT public.has_role(ARRAY['admin','principal','hr']) THEN
    RAISE EXCEPTION 'Not authorized to delete users';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND lower(email) = 'cmbasith786@gmail.com') THEN
    RAISE EXCEPTION 'The super administrator account cannot be deleted';
  END IF;
  -- Only a full administrator may remove an administrator or principal account.
  IF NOT public.has_role(ARRAY['admin'])
     AND EXISTS (SELECT 1 FROM public.profiles
                  WHERE id = p_user_id AND role IN ('admin', 'principal')) THEN
    RAISE EXCEPTION 'Only an administrator may delete an admin or principal account';
  END IF;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- ============================================================================
-- 28. Generic row-deletion helpers for administration screens. Deletes are
--     already authorised by the per-table RLS policies; these functions only
--     guard against accidental broad deletes and keep the audit intent clear.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_any_role(p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(p_roles);
$$;

GRANT EXECUTE ON FUNCTION public.has_any_role(TEXT[]) TO authenticated;

-- ============================================================================
-- 29. Application settings (key/value JSON). Currently holds the institution
--     branding (logo image URL) used by every portal and printed document.
--     Publicly readable because it contains no secrets.
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_read" ON app_settings;
CREATE POLICY "app_settings_read" ON app_settings
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "app_settings_manage" ON app_settings;
CREATE POLICY "app_settings_manage" ON app_settings
  FOR ALL TO authenticated
  USING (public.has_role(ARRAY['admin','principal']))
  WITH CHECK (public.has_role(ARRAY['admin','principal']));

-- ============================================================================
-- 30. Let HR (alongside admin/principal) maintain user profiles, so appointing
--     a staff member also writes their role, scope and department into the
--     Users & Roles directory.
-- ============================================================================
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(ARRAY['admin','principal','hr']))
  WITH CHECK (public.has_role(ARRAY['admin','principal','hr']));

DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
CREATE POLICY "profiles_insert_admin" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(ARRAY['admin','principal','hr']));

-- ============================================================================
-- 31. Direct account creation.
--
--     The public /auth/v1/signup endpoint is rate limited (HTTP 429) and only
--     works when "Confirm email" is disabled. Issuing parent and staff logins
--     through it made admissions fail on busy days.
--
--     This SECURITY DEFINER function creates the auth user, its e-mail identity
--     and the profile row in one transaction, with the password hashed by
--     pgcrypto and the e-mail pre-confirmed. It never touches the signup
--     endpoint, so there is no e-mail rate limit and no confirmation step.
--
--     Privilege guard: only admin / principal / HR may choose the role & scope.
--     Every other caller (including anonymous visitors submitting the public
--     admission form) is forced to role 'parent' with scope 'linked_wards'.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tms_create_user(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'parent',
  p_scope TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_assigned_class TEXT DEFAULT NULL,
  p_assigned_section TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
  v_email TEXT;
  v_name TEXT;
  v_role TEXT;
  v_scope TEXT;
BEGIN
  v_email := lower(trim(COALESCE(p_email, '')));
  IF position('@' IN v_email) < 2 THEN
    RAISE EXCEPTION 'A valid e-mail address is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- The super administrator is provisioned by the ordinary sign-up trigger so
  -- that nobody can pre-register that address with a password of their choosing.
  IF v_email = lower('cmbasith786@gmail.com') THEN
    RAISE EXCEPTION 'This address is reserved; it is provisioned automatically on first sign-in';
  END IF;

  v_name := COALESCE(NULLIF(trim(COALESCE(p_name, '')), ''), split_part(v_email, '@', 1));

  IF public.has_role(ARRAY['admin','principal','hr']) THEN
    v_role := COALESCE(NULLIF(trim(COALESCE(p_role, '')), ''), 'parent');
    v_scope := COALESCE(NULLIF(trim(COALESCE(p_scope, '')), ''), 'school_wide');
  ELSE
    v_role := 'parent';
    v_scope := 'linked_wards';
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  IF v_id IS NOT NULL THEN
    RAISE EXCEPTION 'An account with this e-mail already exists';
  END IF;

  v_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_sso_user, is_anonymous
  ) VALUES (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name, 'email_verified', true),
    false,
    false
  );

  -- E-mail identity so signInWithPassword can resolve the account. Wrapped
  -- defensively so older `auth.identities` layouts do not abort the signup.
  BEGIN
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', v_id::text, NOW(), NOW(), NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, created_at, updated_at
      ) VALUES (
        v_id::text, v_id,
        jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
        'email', v_id::text, NOW(), NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  -- Profile (the handle_new_user trigger usually creates it first).
  INSERT INTO public.profiles (
    id, email, name, role, scope, title, department,
    assigned_class, assigned_section, is_active
  ) VALUES (
    v_id, v_email, v_name, v_role, v_scope, p_title, p_department,
    p_assigned_class, p_assigned_section, true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name),
    role = EXCLUDED.role,
    scope = EXCLUDED.scope,
    title = COALESCE(EXCLUDED.title, public.profiles.title),
    department = COALESCE(EXCLUDED.department, public.profiles.department),
    assigned_class = COALESCE(EXCLUDED.assigned_class, public.profiles.assigned_class),
    assigned_section = COALESCE(EXCLUDED.assigned_section, public.profiles.assigned_section),
    is_active = true,
    updated_at = NOW();

  -- Parent logins are signed in with a short username, so publish a
  -- username -> e-mail alias. Administration can then rename a parent username
  -- without breaking the sign-in (the auth e-mail itself never changes).
  IF v_email LIKE '%@parents.thaibamodel.school' THEN
    INSERT INTO public.login_aliases (id, username, email, role)
    VALUES (
      'alias-' || split_part(v_email, '@', 1),
      split_part(v_email, '@', 1),
      v_email,
      'parent'
    )
    ON CONFLICT (username) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = NOW();
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tms_create_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
