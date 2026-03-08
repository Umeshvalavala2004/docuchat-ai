
-- Branding settings table (single-row config)
CREATE TABLE public.branding_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name text NOT NULL DEFAULT 'Interface_IQ',
  subtitle text NOT NULL DEFAULT 'Powered by Interface_IQ',
  copyright_year text NOT NULL DEFAULT '2026',
  copyright_text text NOT NULL DEFAULT 'Interface_IQ. All rights reserved.',
  logo_url text DEFAULT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read branding
CREATE POLICY "Anyone can read branding" ON public.branding_settings
  FOR SELECT TO authenticated USING (true);

-- Only admins can update
CREATE POLICY "Admins can update branding" ON public.branding_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert
CREATE POLICY "Admins can insert branding" ON public.branding_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default row
INSERT INTO public.branding_settings (app_name, subtitle, copyright_year, copyright_text)
VALUES ('Interface_IQ', 'Powered by Interface_IQ', '2026', 'Interface_IQ. All rights reserved.');
