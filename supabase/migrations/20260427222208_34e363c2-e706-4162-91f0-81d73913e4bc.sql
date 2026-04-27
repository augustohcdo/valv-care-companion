
-- ============ ENUM DE PAPÉIS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'medico', 'paciente');

-- ============ FUNÇÃO updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  birth_date DATE,
  account_type TEXT NOT NULL CHECK (account_type IN ('medico', 'paciente')),
  terms_accepted_at TIMESTAMPTZ,
  lgpd_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Função de verificação de papel (security definer evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ DOCTORS ============
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  crm TEXT NOT NULL,
  crm_uf TEXT NOT NULL CHECK (char_length(crm_uf) = 2),
  specialty TEXT NOT NULL,
  rqe TEXT,
  institution TEXT,
  city TEXT,
  bio TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crm, crm_uf)
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Diretório público de médicos (para que pacientes possam buscar por CRM no cadastro)
CREATE POLICY "Doctors public directory"
  ON public.doctors FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Doctor inserts own record"
  ON public.doctors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'medico'));

CREATE POLICY "Doctor updates own record"
  ON public.doctors FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER doctors_updated_at
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_doctors_crm ON public.doctors (crm, crm_uf);

-- ============ PATIENTS ============
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  sex TEXT CHECK (sex IN ('masculino', 'feminino', 'outro', 'nao_informar')),
  city TEXT,
  uf TEXT,
  comorbidities TEXT[],
  linked_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient views own record"
  ON public.patients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Linked doctor views patient"
  ON public.patients FOR SELECT
  TO authenticated
  USING (
    linked_doctor_id IN (
      SELECT id FROM public.doctors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Patient inserts own record"
  ON public.patients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'paciente'));

CREATE POLICY "Patient updates own record"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRIGGER DE NOVO USUÁRIO ============
-- Cria profile + role automaticamente ao cadastrar, usando metadados do signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type TEXT;
  v_full_name TEXT;
BEGIN
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'paciente');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.profiles (user_id, full_name, account_type, terms_accepted_at, lgpd_accepted_at)
  VALUES (
    NEW.id,
    v_full_name,
    v_account_type,
    now(),
    now()
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_account_type::public.app_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
