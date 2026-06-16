
-- Admin flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.board_category AS ENUM ('free','training_tip','question','review','recovery','nutrition','equipment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_target AS ENUM ('post','comment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('comment','like','answer','best','team_assign','competition_reminder','fatigue_alert','mention','template_assigned','coach_note','team_announcement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin helper (SECURITY DEFINER to avoid RLS recursion on profiles)
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _uid), false);
$$;

-- ========== board_posts ==========
CREATE TABLE public.board_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category public.board_category NOT NULL DEFAULT 'free',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_faq BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  views_count INT NOT NULL DEFAULT 0,
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  reports_count INT NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.board_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_posts TO authenticated;
GRANT ALL ON public.board_posts TO service_role;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts read" ON public.board_posts FOR SELECT TO anon, authenticated USING (NOT is_hidden OR public.is_admin(auth.uid()) OR author_id = auth.uid());
CREATE POLICY "posts insert own" ON public.board_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts update own or admin" ON public.board_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id OR public.is_admin(auth.uid()));
CREATE POLICY "posts delete own or admin" ON public.board_posts FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.is_admin(auth.uid()));
CREATE INDEX idx_board_posts_created ON public.board_posts (created_at DESC);
CREATE INDEX idx_board_posts_category ON public.board_posts (category);

-- ========== board_comments ==========
CREATE TABLE public.board_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  parent_comment_id UUID REFERENCES public.board_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INT NOT NULL DEFAULT 0,
  is_best BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.board_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_comments TO authenticated;
GRANT ALL ON public.board_comments TO service_role;
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments read" ON public.board_comments FOR SELECT TO anon, authenticated USING (NOT is_hidden OR public.is_admin(auth.uid()) OR author_id = auth.uid());
CREATE POLICY "comments insert own" ON public.board_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments update own or admin" ON public.board_comments FOR UPDATE TO authenticated USING (auth.uid() = author_id OR public.is_admin(auth.uid()));
CREATE POLICY "comments delete own or admin" ON public.board_comments FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.is_admin(auth.uid()));
CREATE INDEX idx_board_comments_post ON public.board_comments (post_id, created_at);

-- ========== board_post_likes ==========
CREATE TABLE public.board_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.board_post_likes TO authenticated;
GRANT ALL ON public.board_post_likes TO service_role;
ALTER TABLE public.board_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post likes read" ON public.board_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "post likes insert own" ON public.board_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post likes delete own" ON public.board_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========== board_comment_likes ==========
CREATE TABLE public.board_comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.board_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.board_comment_likes TO authenticated;
GRANT ALL ON public.board_comment_likes TO service_role;
ALTER TABLE public.board_comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment likes read" ON public.board_comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "comment likes insert own" ON public.board_comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment likes delete own" ON public.board_comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========== board_reports ==========
CREATE TABLE public.board_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type public.report_target NOT NULL,
  target_id UUID NOT NULL,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, reporter_id)
);
GRANT SELECT, INSERT ON public.board_reports TO authenticated;
GRANT ALL ON public.board_reports TO service_role;
ALTER TABLE public.board_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports admin read" ON public.board_reports FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR auth.uid() = reporter_id);
CREATE POLICY "reports insert own" ON public.board_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- ========== notifications ==========
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif own select" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif own insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "notif own update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif own delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_notif_user_read ON public.notifications (user_id, is_read, created_at DESC);

-- ========== team_announcements ==========
CREATE TABLE public.team_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_announcements TO authenticated;
GRANT ALL ON public.team_announcements TO service_role;
ALTER TABLE public.team_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announce coach all" ON public.team_announcements FOR ALL TO authenticated
  USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "announce team members read" ON public.team_announcements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_announcements.team_id AND tm.athlete_id = auth.uid() AND tm.is_active));

-- ========== Triggers ==========
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.board_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.board_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON public.board_post_likes
FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

CREATE OR REPLACE FUNCTION public.update_comment_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.board_comments
      SET likes_count = likes_count + 1,
          is_best = (likes_count + 1 >= 5)
      WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.board_comments
      SET likes_count = GREATEST(likes_count - 1, 0),
          is_best = (GREATEST(likes_count - 1, 0) >= 5)
      WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_comment_likes_count
AFTER INSERT OR DELETE ON public.board_comment_likes
FOR EACH ROW EXECUTE FUNCTION public.update_comment_likes_count();

CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.board_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.board_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_post_comments_count
AFTER INSERT OR DELETE ON public.board_comments
FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

CREATE OR REPLACE FUNCTION public.update_reports_hide()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt INT;
BEGIN
  IF NEW.target_type = 'post' THEN
    SELECT count(*) INTO cnt FROM public.board_reports WHERE target_type='post' AND target_id = NEW.target_id;
    UPDATE public.board_posts SET reports_count = cnt, is_hidden = (cnt >= 3) WHERE id = NEW.target_id;
  ELSE
    SELECT count(*) INTO cnt FROM public.board_reports WHERE target_type='comment' AND target_id = NEW.target_id;
    UPDATE public.board_comments SET is_hidden = (cnt >= 3) WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reports_hide AFTER INSERT ON public.board_reports
FOR EACH ROW EXECUTE FUNCTION public.update_reports_hide();

CREATE OR REPLACE FUNCTION public.update_board_post_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_board_post_updated BEFORE UPDATE ON public.board_posts
FOR EACH ROW EXECUTE FUNCTION public.update_board_post_updated_at();

-- ========== Storage bucket for board images ==========
INSERT INTO storage.buckets (id, name, public) VALUES ('board-images','board-images',true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "board images public read" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'board-images');
CREATE POLICY "board images user upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'board-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "board images user delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'board-images' AND auth.uid()::text = (storage.foldername(name))[1]);
