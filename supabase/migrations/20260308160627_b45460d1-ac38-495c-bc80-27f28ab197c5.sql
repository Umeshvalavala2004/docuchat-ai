
-- Create logos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow authenticated admins to upload logos
CREATE POLICY "Admins can upload logos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

-- Allow anyone to read logos (public bucket)
CREATE POLICY "Anyone can read logos" ON storage.objects
FOR SELECT USING (bucket_id = 'logos');

-- Allow admins to delete logos
CREATE POLICY "Admins can delete logos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to update logos
CREATE POLICY "Admins can update logos" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'));
