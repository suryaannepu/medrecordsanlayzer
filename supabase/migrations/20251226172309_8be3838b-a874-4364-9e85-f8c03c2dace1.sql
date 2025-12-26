-- Create role enum
CREATE TYPE public.app_role AS ENUM ('student', 'doctor', 'admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  UNIQUE (user_id, role)
);

-- Create medical_reports table
CREATE TABLE public.medical_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  document_type TEXT DEFAULT 'blood-report',
  extracted_data JSONB,
  ocr_text TEXT,
  report_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create prescriptions table
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  medicines JSONB NOT NULL DEFAULT '[]',
  diagnosis TEXT,
  notes TEXT,
  hospital_name TEXT DEFAULT 'University Hospital',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  urgency TEXT DEFAULT 'normal',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create announcement_responses table
CREATE TABLE public.announcement_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (announcement_id, student_id)
);

-- Create rooms table for doctor-patient chat
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_messages table
CREATE TABLE public.room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create patient_visits table for queue
CREATE TABLE public.patient_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symptoms TEXT,
  risk_score INTEGER DEFAULT 0,
  queue_position INTEGER,
  status TEXT DEFAULT 'waiting',
  doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create app_config table for admin settings
CREATE TABLE public.app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  is_secret BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Create has_role function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Default role is student
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Doctors can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for medical_reports
CREATE POLICY "Students can view own reports" ON public.medical_reports
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own reports" ON public.medical_reports
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can delete own reports" ON public.medical_reports
  FOR DELETE USING (auth.uid() = student_id);

CREATE POLICY "Doctors can view all reports" ON public.medical_reports
  FOR SELECT USING (public.has_role(auth.uid(), 'doctor'));

-- RLS Policies for prescriptions
CREATE POLICY "Students can view own prescriptions" ON public.prescriptions
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Doctors can manage prescriptions" ON public.prescriptions
  FOR ALL USING (public.has_role(auth.uid(), 'doctor'));

-- RLS Policies for announcements
CREATE POLICY "Anyone can view active announcements" ON public.announcements
  FOR SELECT USING (active = true);

CREATE POLICY "Doctors can manage announcements" ON public.announcements
  FOR ALL USING (public.has_role(auth.uid(), 'doctor'));

-- RLS Policies for announcement_responses
CREATE POLICY "Students can respond to announcements" ON public.announcement_responses
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Users can view own responses" ON public.announcement_responses
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Doctors can view all responses" ON public.announcement_responses
  FOR SELECT USING (public.has_role(auth.uid(), 'doctor'));

-- RLS Policies for rooms
CREATE POLICY "Users can view own rooms" ON public.rooms
  FOR SELECT USING (auth.uid() = doctor_id OR auth.uid() = student_id);

CREATE POLICY "Doctors can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "Doctors can update rooms" ON public.rooms
  FOR UPDATE USING (auth.uid() = doctor_id);

-- RLS Policies for room_messages
CREATE POLICY "Room participants can view messages" ON public.room_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rooms 
      WHERE rooms.id = room_messages.room_id 
      AND (rooms.doctor_id = auth.uid() OR rooms.student_id = auth.uid())
    )
  );

CREATE POLICY "Room participants can send messages" ON public.room_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.rooms 
      WHERE rooms.id = room_messages.room_id 
      AND (rooms.doctor_id = auth.uid() OR rooms.student_id = auth.uid())
    )
  );

-- RLS Policies for patient_visits
CREATE POLICY "Students can view own visits" ON public.patient_visits
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can create visits" ON public.patient_visits
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Doctors can view all visits" ON public.patient_visits
  FOR SELECT USING (public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "Doctors can update visits" ON public.patient_visits
  FOR UPDATE USING (public.has_role(auth.uid(), 'doctor'));

-- RLS Policies for app_config
CREATE POLICY "Admins can manage config" ON public.app_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;