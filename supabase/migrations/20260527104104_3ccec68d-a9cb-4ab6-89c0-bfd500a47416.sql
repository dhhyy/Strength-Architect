
CREATE TYPE public.body_part AS ENUM ('chest','back','legs','shoulders','arms','core','full_body');
CREATE TYPE public.qna_category AS ENUM ('training','nutrition','recovery','equipment','other');
CREATE TYPE public.comp_importance AS ENUM ('A','B','C');

ALTER TABLE public.workout_logs ADD COLUMN IF NOT EXISTS sport_training_done BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.routine_templates ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- LIFESTYLE
CREATE TABLE public.lifestyle_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '✅',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifestyle_habits TO authenticated;
GRANT ALL ON public.lifestyle_habits TO service_role;
ALTER TABLE public.lifestyle_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own habits all" ON public.lifestyle_habits FOR ALL TO authenticated USING (auth.uid() = athlete_id) WITH CHECK (auth.uid() = athlete_id);

CREATE TABLE public.lifestyle_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES public.lifestyle_habits(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  checked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifestyle_checks TO authenticated;
GRANT ALL ON public.lifestyle_checks TO service_role;
ALTER TABLE public.lifestyle_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checks all" ON public.lifestyle_checks FOR ALL TO authenticated USING (auth.uid() = athlete_id) WITH CHECK (auth.uid() = athlete_id);

-- EXERCISE LIBRARY
CREATE TABLE public.exercise_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_name TEXT NOT NULL,
  body_part body_part NOT NULL,
  difficulty difficulty_level NOT NULL DEFAULT 'beginner',
  description TEXT,
  youtube_url TEXT,
  youtube_video_id TEXT,
  thumbnail_url TEXT,
  is_main_lift BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercise_library TO anon, authenticated;
GRANT ALL ON public.exercise_library TO service_role;
ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public exercise library" ON public.exercise_library FOR SELECT TO anon, authenticated USING (true);

-- Q&A
CREATE TABLE public.qna_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category qna_category NOT NULL DEFAULT 'training',
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qna_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qna_posts TO authenticated;
GRANT ALL ON public.qna_posts TO service_role;
ALTER TABLE public.qna_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qna posts read" ON public.qna_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qna posts insert" ON public.qna_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "qna posts update own" ON public.qna_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "qna posts delete own" ON public.qna_posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE public.qna_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.qna_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_best BOOLEAN NOT NULL DEFAULT false,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.qna_answers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qna_answers TO authenticated;
GRANT ALL ON public.qna_answers TO service_role;
ALTER TABLE public.qna_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qna answers read" ON public.qna_answers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "qna answers insert" ON public.qna_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "qna answers update own" ON public.qna_answers FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "qna answers delete own" ON public.qna_answers FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE public.qna_answer_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES public.qna_answers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(answer_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.qna_answer_likes TO authenticated;
GRANT ALL ON public.qna_answer_likes TO service_role;
ALTER TABLE public.qna_answer_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes read" ON public.qna_answer_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes insert own" ON public.qna_answer_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes delete own" ON public.qna_answer_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_answer_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.qna_answers SET likes_count = likes_count + 1,
      is_best = (likes_count + 1 >= 5) WHERE id = NEW.answer_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.qna_answers SET likes_count = GREATEST(likes_count - 1, 0),
      is_best = (likes_count - 1 >= 5) WHERE id = OLD.answer_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;$$;
CREATE TRIGGER trg_answer_likes AFTER INSERT OR DELETE ON public.qna_answer_likes
FOR EACH ROW EXECUTE FUNCTION public.update_answer_likes_count();

-- TEAMS
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random()*length(chars))::int + 1, 1);
  END LOOP;
  RETURN result;
END;$$;

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  sport TEXT,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT public.gen_invite_code(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(team_id, athlete_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach teams all" ON public.teams FOR ALL TO authenticated
  USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
CREATE POLICY "auth lookup teams" ON public.teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "athlete own membership" ON public.team_members FOR ALL TO authenticated
  USING (auth.uid() = athlete_id) WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "coach view team members" ON public.team_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.coach_id = auth.uid()));
CREATE POLICY "coach delete team members" ON public.team_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.coach_id = auth.uid()));

-- coach cross-table read for team members
CREATE POLICY "coach view member profiles" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON tm.team_id = t.id WHERE tm.athlete_id = profiles.id AND t.coach_id = auth.uid() AND tm.is_active));
CREATE POLICY "coach view member lifts" ON public.athlete_lifts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON tm.team_id = t.id WHERE tm.athlete_id = athlete_lifts.athlete_id AND t.coach_id = auth.uid() AND tm.is_active));
CREATE POLICY "coach view member checkins" ON public.daily_checkins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON tm.team_id = t.id WHERE tm.athlete_id = daily_checkins.athlete_id AND t.coach_id = auth.uid() AND tm.is_active));
CREATE POLICY "coach view member logs" ON public.workout_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON tm.team_id = t.id WHERE tm.athlete_id = workout_logs.athlete_id AND t.coach_id = auth.uid() AND tm.is_active));
CREATE POLICY "coach view member habits" ON public.lifestyle_habits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON tm.team_id = t.id WHERE tm.athlete_id = lifestyle_habits.athlete_id AND t.coach_id = auth.uid() AND tm.is_active));
CREATE POLICY "coach view member checks" ON public.lifestyle_checks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON tm.team_id = t.id WHERE tm.athlete_id = lifestyle_checks.athlete_id AND t.coach_id = auth.uid() AND tm.is_active));

-- COMPETITIONS
CREATE TABLE public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  competition_name TEXT NOT NULL,
  competition_date DATE NOT NULL,
  importance comp_importance NOT NULL DEFAULT 'B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (athlete_id IS NOT NULL OR team_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitions all" ON public.competitions FOR ALL TO authenticated
  USING (
    auth.uid() = athlete_id
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = competitions.team_id AND t.coach_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = competitions.team_id AND tm.athlete_id = auth.uid() AND tm.is_active)
  )
  WITH CHECK (
    auth.uid() = athlete_id
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = competitions.team_id AND t.coach_id = auth.uid())
  );

-- COACH NOTES
CREATE TABLE public.coach_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_notes TO authenticated;
GRANT ALL ON public.coach_notes TO service_role;
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach own notes" ON public.coach_notes FOR ALL TO authenticated
  USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);

-- SEED EXERCISE LIBRARY
INSERT INTO public.exercise_library (exercise_name, body_part, difficulty, description, youtube_url, youtube_video_id, thumbnail_url, is_main_lift) VALUES
('백스쿼트','legs','intermediate','하체 전반의 기본 컴파운드. 무릎과 고관절을 함께 사용하는 다관절 운동.','https://www.youtube.com/watch?v=ultWZbUMPL8','ultWZbUMPL8','https://img.youtube.com/vi/ultWZbUMPL8/hqdefault.jpg',true),
('데드리프트','back','advanced','후면사슬 발달의 왕. 햄스트링, 둔근, 척주기립근 동원.','https://www.youtube.com/watch?v=op9kVnSso6Q','op9kVnSso6Q','https://img.youtube.com/vi/op9kVnSso6Q/hqdefault.jpg',true),
('벤치프레스','chest','intermediate','상체 미는 힘의 대표 종목. 가슴, 삼두, 전면 삼각근.','https://www.youtube.com/watch?v=rT7DgCr-3pg','rT7DgCr-3pg','https://img.youtube.com/vi/rT7DgCr-3pg/hqdefault.jpg',true),
('오버헤드프레스','shoulders','intermediate','어깨 전체와 코어 안정성을 키우는 스탠딩 프레스.','https://www.youtube.com/watch?v=2yjwXTZQDDI','2yjwXTZQDDI','https://img.youtube.com/vi/2yjwXTZQDDI/hqdefault.jpg',true),
('파워클린','full_body','advanced','폭발적인 파워 발달. 운동선수 핵심 종목.','https://www.youtube.com/watch?v=KwYJTpQ_x5A','KwYJTpQ_x5A','https://img.youtube.com/vi/KwYJTpQ_x5A/hqdefault.jpg',true),
('풀업','back','intermediate','자체중량 등 운동의 대표. 광배근 발달.','https://www.youtube.com/watch?v=eGo4IYlbE5g','eGo4IYlbE5g','https://img.youtube.com/vi/eGo4IYlbE5g/hqdefault.jpg',true),
('딥스','chest','intermediate','가슴과 삼두를 동시에 발달시키는 자체중량 종목.','https://www.youtube.com/watch?v=2z8JmcrW-As','2z8JmcrW-As','https://img.youtube.com/vi/2z8JmcrW-As/hqdefault.jpg',true),
('프론트 스쿼트','legs','intermediate','대퇴사두와 코어를 강조하는 스쿼트 변형.','https://www.youtube.com/watch?v=tlfahNdNPPI','tlfahNdNPPI','https://img.youtube.com/vi/tlfahNdNPPI/hqdefault.jpg',false),
('루마니안 데드리프트','legs','intermediate','햄스트링과 둔근에 집중하는 힌지 운동.','https://www.youtube.com/watch?v=jEy_czb3RKA','jEy_czb3RKA','https://img.youtube.com/vi/jEy_czb3RKA/hqdefault.jpg',false),
('불가리안 스플릿 스쿼트','legs','intermediate','단측성 하체 강화 및 균형 발달.','https://www.youtube.com/watch?v=2C-uNgKwPLE','2C-uNgKwPLE','https://img.youtube.com/vi/2C-uNgKwPLE/hqdefault.jpg',false),
('인클라인 벤치프레스','chest','intermediate','상부 가슴 발달에 집중.','https://www.youtube.com/watch?v=DbFgADa2PL8','DbFgADa2PL8','https://img.youtube.com/vi/DbFgADa2PL8/hqdefault.jpg',false),
('클로즈 그립 벤치프레스','arms','intermediate','삼두근 발달에 집중한 벤치프레스 변형.','https://www.youtube.com/watch?v=nEF0bv2FW94','nEF0bv2FW94','https://img.youtube.com/vi/nEF0bv2FW94/hqdefault.jpg',false),
('바벨 로우','back','intermediate','등 두께 발달의 핵심 운동.','https://www.youtube.com/watch?v=9efgcAjQe7E','9efgcAjQe7E','https://img.youtube.com/vi/9efgcAjQe7E/hqdefault.jpg',false),
('시티드 로우','back','beginner','등 중부 발달. 머신/케이블 사용.','https://www.youtube.com/watch?v=GZbfZ033f74','GZbfZ033f74','https://img.youtube.com/vi/GZbfZ033f74/hqdefault.jpg',false),
('친업','back','intermediate','이두근과 광배근을 동시에 자극.','https://www.youtube.com/watch?v=brhRXlOhsAM','brhRXlOhsAM','https://img.youtube.com/vi/brhRXlOhsAM/hqdefault.jpg',false),
('측면 레이즈','shoulders','beginner','어깨 측면(중삼각근) 고립 운동.','https://www.youtube.com/watch?v=3VcKaXpzqRo','3VcKaXpzqRo','https://img.youtube.com/vi/3VcKaXpzqRo/hqdefault.jpg',false),
('페이스 풀','shoulders','beginner','후면 삼각근과 회전근개 강화.','https://www.youtube.com/watch?v=rep-qVOkqgk','rep-qVOkqgk','https://img.youtube.com/vi/rep-qVOkqgk/hqdefault.jpg',false),
('바이셉스 컬','arms','beginner','이두근 고립 운동.','https://www.youtube.com/watch?v=ykJmrZ5v0Oo','ykJmrZ5v0Oo','https://img.youtube.com/vi/ykJmrZ5v0Oo/hqdefault.jpg',false),
('트라이셉스 익스텐션','arms','beginner','삼두근 고립 운동.','https://www.youtube.com/watch?v=YbX7Wd8jQ-Q','YbX7Wd8jQ-Q','https://img.youtube.com/vi/YbX7Wd8jQ-Q/hqdefault.jpg',false),
('카프 레이즈','legs','beginner','종아리 발달.','https://www.youtube.com/watch?v=gwLzBJYoWlI','gwLzBJYoWlI','https://img.youtube.com/vi/gwLzBJYoWlI/hqdefault.jpg',false),
('레그 컬','legs','beginner','햄스트링 고립 운동.','https://www.youtube.com/watch?v=ELOCsoDSmrg','ELOCsoDSmrg','https://img.youtube.com/vi/ELOCsoDSmrg/hqdefault.jpg',false),
('행잉 레그 레이즈','core','intermediate','복부 하부 강화.','https://www.youtube.com/watch?v=Pr1ieGZ5atk','Pr1ieGZ5atk','https://img.youtube.com/vi/Pr1ieGZ5atk/hqdefault.jpg',false),
('박스 점프','legs','intermediate','폭발력 발달 플라이오메트릭.','https://www.youtube.com/watch?v=52r_Ul5k03g','52r_Ul5k03g','https://img.youtube.com/vi/52r_Ul5k03g/hqdefault.jpg',false),
('케틀벨 스윙','full_body','intermediate','후면사슬 폭발력 발달.','https://www.youtube.com/watch?v=YSxHifyI6s8','YSxHifyI6s8','https://img.youtube.com/vi/YSxHifyI6s8/hqdefault.jpg',false),
('런지','legs','beginner','단측성 하체 운동.','https://www.youtube.com/watch?v=QOVaHwm-Q6U','QOVaHwm-Q6U','https://img.youtube.com/vi/QOVaHwm-Q6U/hqdefault.jpg',false),
('플랭크','core','beginner','코어 안정성 기본 종목.','https://www.youtube.com/watch?v=ASdvN_XEl_c','ASdvN_XEl_c','https://img.youtube.com/vi/ASdvN_XEl_c/hqdefault.jpg',false),
('사이드 플랭크','core','beginner','측면 코어 강화.','https://www.youtube.com/watch?v=K2VljzCC16g','K2VljzCC16g','https://img.youtube.com/vi/K2VljzCC16g/hqdefault.jpg',false),
('푸쉬업','chest','beginner','자체중량 가슴 운동.','https://www.youtube.com/watch?v=IODxDxX7oi4','IODxDxX7oi4','https://img.youtube.com/vi/IODxDxX7oi4/hqdefault.jpg',false),
('인버티드 로우','back','beginner','자체중량 당기기. 풀업 대체 가능.','https://www.youtube.com/watch?v=KOaCM1HMwU8','KOaCM1HMwU8','https://img.youtube.com/vi/KOaCM1HMwU8/hqdefault.jpg',false),
('굿모닝','back','intermediate','척추기립근과 햄스트링 강화.','https://www.youtube.com/watch?v=YuWS7WUKxK0','YuWS7WUKxK0','https://img.youtube.com/vi/YuWS7WUKxK0/hqdefault.jpg',false);
