
-- 1. Extend analyses table
ALTER TABLE public.analyses
  ADD COLUMN couple_type_id integer,
  ADD COLUMN relationship_type text,
  ADD COLUMN subscription_tier_at_view text NOT NULL DEFAULT 'anonymous',
  ADD COLUMN is_paid boolean NOT NULL DEFAULT false;

ALTER TABLE public.analyses
  ADD CONSTRAINT analyses_relationship_type_check
    CHECK (relationship_type IS NULL OR relationship_type IN ('romantic', 'friend', 'family'));

ALTER TABLE public.analyses
  ADD CONSTRAINT analyses_subscription_tier_at_view_check
    CHECK (subscription_tier_at_view IN ('anonymous', 'free', 'paid'));

ALTER TABLE public.analyses
  ADD CONSTRAINT analyses_couple_type_id_range_check
    CHECK (couple_type_id IS NULL OR (couple_type_id BETWEEN 1 AND 13));

-- 2. couple_types reference table
CREATE TABLE public.couple_types (
  id integer PRIMARY KEY,
  romantic_name text NOT NULL,
  friend_name text NOT NULL,
  family_name text NOT NULL,
  romantic_tagline text NOT NULL,
  friend_tagline text NOT NULL,
  family_tagline text NOT NULL,
  romantic_superpower text NOT NULL,
  friend_superpower text NOT NULL,
  family_superpower text NOT NULL,
  romantic_description text NOT NULL,
  friend_description text NOT NULL,
  family_description text NOT NULL,
  background_color text NOT NULL,
  text_color text NOT NULL,
  decorative_element text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.couple_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read couple types"
  ON public.couple_types
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Optional FK from analyses to couple_types (nullable already)
ALTER TABLE public.analyses
  ADD CONSTRAINT analyses_couple_type_id_fkey
    FOREIGN KEY (couple_type_id) REFERENCES public.couple_types(id) ON DELETE SET NULL;

-- 3. user_subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  tier text NOT NULL CHECK (tier IN ('monthly', 'annual', 'lifetime')),
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_sub ON public.user_subscriptions(stripe_subscription_id);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies — writes only via SECURITY DEFINER functions / service role.

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. one_time_unlocks table
CREATE TABLE public.one_time_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, analysis_id)
);

CREATE INDEX idx_one_time_unlocks_user ON public.one_time_unlocks(user_id);
CREATE INDEX idx_one_time_unlocks_analysis ON public.one_time_unlocks(analysis_id);

ALTER TABLE public.one_time_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own unlocks"
  ON public.one_time_unlocks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies — writes only via SECURITY DEFINER / service role.

-- 5. Helper: user_has_paid_access
CREATE OR REPLACE FUNCTION public.user_has_paid_access(p_user_id uuid, p_analysis_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN p_user_id IS NULL OR p_analysis_id IS NULL THEN false
      WHEN EXISTS (
        SELECT 1 FROM public.user_subscriptions
        WHERE user_id = p_user_id
          AND status = 'active'
          AND (current_period_end IS NULL OR current_period_end > now())
      ) THEN true
      WHEN EXISTS (
        SELECT 1 FROM public.one_time_unlocks
        WHERE user_id = p_user_id
          AND analysis_id = p_analysis_id
      ) THEN true
      ELSE false
    END;
$$;

GRANT EXECUTE ON FUNCTION public.user_has_paid_access(uuid, uuid) TO anon, authenticated;
