
-- Daily usage tracking table
CREATE TABLE public.daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  questions_asked integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
  ON public.daily_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON public.daily_usage FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
  ON public.daily_usage FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage"
  ON public.daily_usage FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to check and increment usage, returns remaining questions (-1 = unlimited)
CREATE OR REPLACE FUNCTION public.check_and_increment_usage(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_premium boolean;
  _current_count integer;
  _max_questions integer := 5;
BEGIN
  -- Check if user is pro or admin (unlimited)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('pro_user', 'admin')
  ) INTO _is_premium;

  IF _is_premium THEN
    -- Still track usage but don't limit
    INSERT INTO public.daily_usage (user_id, usage_date, questions_asked)
    VALUES (_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET questions_asked = daily_usage.questions_asked + 1, updated_at = now();
    RETURN -1; -- unlimited
  END IF;

  -- Get or create today's usage
  INSERT INTO public.daily_usage (user_id, usage_date, questions_asked)
  VALUES (_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  SELECT questions_asked INTO _current_count
  FROM public.daily_usage
  WHERE user_id = _user_id AND usage_date = CURRENT_DATE;

  IF _current_count >= _max_questions THEN
    RETURN 0; -- no remaining
  END IF;

  -- Increment
  UPDATE public.daily_usage
  SET questions_asked = questions_asked + 1, updated_at = now()
  WHERE user_id = _user_id AND usage_date = CURRENT_DATE;

  RETURN _max_questions - _current_count - 1; -- remaining after this question
END;
$$;

-- Function to get today's usage without incrementing
CREATE OR REPLACE FUNCTION public.get_daily_usage(_user_id uuid)
RETURNS TABLE(questions_asked integer, max_questions integer, is_premium boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_premium boolean;
  _count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('pro_user', 'admin')
  ) INTO _is_premium;

  SELECT COALESCE(du.questions_asked, 0) INTO _count
  FROM public.daily_usage du
  WHERE du.user_id = _user_id AND du.usage_date = CURRENT_DATE;

  IF _count IS NULL THEN _count := 0; END IF;

  RETURN QUERY SELECT _count, 5, _is_premium;
END;
$$;

CREATE TRIGGER update_daily_usage_updated_at
  BEFORE UPDATE ON public.daily_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
