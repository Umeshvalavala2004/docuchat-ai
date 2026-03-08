
-- Fix the overly permissive notification insert policy
DROP POLICY "Service can insert notifications" ON public.notifications;

-- Allow users to receive notifications (inserted by edge functions using service role)
-- and allow admin to insert notifications for any user
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- Create a function for the edge function to insert notifications (service role)
CREATE OR REPLACE FUNCTION public.create_notification(_user_id UUID, _title TEXT, _message TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message)
  VALUES (_user_id, _title, _message);
END;
$$;

-- Admin approval function (sets role and updates request)
CREATE OR REPLACE FUNCTION public.approve_pro_request(_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _admin_id UUID;
BEGIN
  _admin_id := auth.uid();
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve requests';
  END IF;

  SELECT user_id INTO _user_id FROM public.pro_requests WHERE id = _request_id AND status = 'pending';
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Update request
  UPDATE public.pro_requests SET status = 'approved', reviewed_at = now(), reviewed_by = _admin_id WHERE id = _request_id;

  -- Update or insert pro role
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'pro_user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Remove free_user role
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'free_user';

  -- Notify user
  PERFORM public.create_notification(_user_id, 'Pro Access Approved', 'Your Pro access has been approved! You now have access to all Pro features.');
END;
$$;

-- Admin reject function
CREATE OR REPLACE FUNCTION public.reject_pro_request(_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _admin_id UUID;
BEGIN
  _admin_id := auth.uid();
  IF NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject requests';
  END IF;

  SELECT user_id INTO _user_id FROM public.pro_requests WHERE id = _request_id AND status = 'pending';
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  UPDATE public.pro_requests SET status = 'rejected', reviewed_at = now(), reviewed_by = _admin_id WHERE id = _request_id;

  PERFORM public.create_notification(_user_id, 'Pro Request Rejected', 'Your Pro access request has been reviewed and was not approved at this time.');
END;
$$;

-- Function to create a pro request with admin notification
CREATE OR REPLACE FUNCTION public.request_pro_upgrade()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _admin_id UUID;
  _existing UUID;
BEGIN
  _user_id := auth.uid();

  -- Check for existing pending request
  SELECT id INTO _existing FROM public.pro_requests WHERE user_id = _user_id AND status = 'pending';
  IF _existing IS NOT NULL THEN
    RAISE EXCEPTION 'You already have a pending request';
  END IF;

  -- Insert request
  INSERT INTO public.pro_requests (user_id) VALUES (_user_id);

  -- Notify all admins
  FOR _admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.create_notification(_admin_id, 'New Pro Request', 'A user has requested Pro access. Check the admin dashboard.');
  END LOOP;
END;
$$;
