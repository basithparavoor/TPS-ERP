-- ============================================================================
-- TMS ERP - ADMISSION WORKFLOW, PAYMENTS, NOTIFICATIONS (UPDATE 2)
-- Safe to run repeatedly on an existing database. ASCII only.
-- Run this after the initial schema. It adds: dynamic admission form
-- builder, fee items, UPI payment settings, parent credentials,
-- notifications and the parent/office-boy access policies.
-- ============================================================================

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
