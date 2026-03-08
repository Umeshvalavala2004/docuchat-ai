
-- Create default workspaces for existing users and assign data
DO $$
DECLARE
  _user RECORD;
  _ws_id uuid;
BEGIN
  FOR _user IN SELECT DISTINCT user_id FROM public.documents
    UNION SELECT DISTINCT user_id FROM public.chat_sessions
  LOOP
    INSERT INTO public.workspaces (user_id, name, icon, color, is_default)
    VALUES (_user.user_id, 'Default', 'home', '#6366f1', true)
    RETURNING id INTO _ws_id;

    UPDATE public.documents SET workspace_id = _ws_id WHERE user_id = _user.user_id AND workspace_id IS NULL;
    UPDATE public.chat_sessions SET workspace_id = _ws_id WHERE user_id = _user.user_id AND workspace_id IS NULL;
  END LOOP;
END $$;

-- Auto-create default workspace for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.workspaces (user_id, name, icon, color, is_default)
  VALUES (NEW.id, 'Default', 'home', '#6366f1', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();
