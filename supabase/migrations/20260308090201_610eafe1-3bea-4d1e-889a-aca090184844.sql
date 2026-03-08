
-- Auto-assign admin role to the specific admin email via trigger
CREATE OR REPLACE FUNCTION public.assign_admin_if_needed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'umeshvalavala2004@gmail.com' THEN
    -- Remove default free role and add admin
    DELETE FROM public.user_roles WHERE user_id = NEW.id AND role = 'free_user';
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_admin_if_needed();
