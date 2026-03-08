
CREATE OR REPLACE FUNCTION public.admin_change_user_role(_target_user_id uuid, _new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin_id UUID;
BEGIN
  _admin_id := auth.uid();
  
  -- Only admins can change roles
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  
  -- Prevent admin from changing their own role
  IF _target_user_id = _admin_id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;
  
  -- Delete existing roles for user
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  -- Insert new role
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _new_role);
  
  -- Notify the user
  PERFORM public.create_notification(
    _target_user_id, 
    'Role Updated', 
    'Your role has been changed to ' || _new_role::text || '.'
  );
END;
$$;
