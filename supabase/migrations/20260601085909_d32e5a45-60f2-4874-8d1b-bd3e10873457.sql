DO $$
DECLARE
  tmpl_id uuid := '48edcd0f-7db8-4a4d-8886-2fe0dcfbce62';
  weeks int[] := ARRAY[1,2,3,4,5,6,7,8];
  w int;
  d_mon uuid; d_wed uuid; d_fri uuid;
  main_int int; main_sets int; main_reps int;
  acc_w numeric;
BEGIN
  DELETE FROM public.template_exercises WHERE template_day_id IN (
    SELECT id FROM public.template_days WHERE template_id = tmpl_id
  );
  DELETE FROM public.template_days WHERE template_id = tmpl_id;

  FOREACH w IN ARRAY weeks LOOP
    main_int := CASE w WHEN 1 THEN 60 WHEN 2 THEN 65 WHEN 3 THEN 70 WHEN 4 THEN 75
                       WHEN 5 THEN 78 WHEN 6 THEN 83 WHEN 7 THEN 88 WHEN 8 THEN 55 END;
    main_sets := CASE WHEN w <= 4 THEN 5 WHEN w IN (5,6) THEN 4 ELSE 3 END;
    main_reps := CASE WHEN w <= 4 THEN 5 WHEN w IN (5,6) THEN 4 WHEN w = 7 THEN 3 ELSE 5 END;
    acc_w := CASE WHEN w <= 2 THEN 0 WHEN w <= 4 THEN 5 WHEN w <= 6 THEN 7 WHEN w = 7 THEN 10 ELSE 0 END;

    INSERT INTO public.template_days(template_id, week_number, day_of_week, day_title, is_rest_day)
      VALUES (tmpl_id, w, 1, w || '주차 월요일 - 스쿼트/벤치/풀업', false) RETURNING id INTO d_mon;
    INSERT INTO public.template_exercises(template_day_id, exercise_name, lift_type, base_sets, base_reps, base_intensity_percent, fixed_weight, order_index, priority) VALUES
      (d_mon, '스쿼트', 'squat', main_sets, main_reps, main_int, NULL, 0, 3),
      (d_mon, '벤치프레스', 'bench', main_sets, main_reps, main_int, NULL, 1, 3),
      (d_mon, '풀업', 'pullup', 3, 8, NULL, acc_w, 2, 2);

    INSERT INTO public.template_days(template_id, week_number, day_of_week, day_title, is_rest_day)
      VALUES (tmpl_id, w, 3, w || '주차 수요일 - 데드리프트/오버헤드프레스/딥스', false) RETURNING id INTO d_wed;
    INSERT INTO public.template_exercises(template_day_id, exercise_name, lift_type, base_sets, base_reps, base_intensity_percent, fixed_weight, order_index, priority) VALUES
      (d_wed, '데드리프트', 'deadlift', main_sets, main_reps, main_int, NULL, 0, 3),
      (d_wed, '오버헤드프레스', 'ohp', main_sets, main_reps, main_int, NULL, 1, 3),
      (d_wed, '딥스', 'dips', 3, 8, NULL, acc_w, 2, 2);

    INSERT INTO public.template_days(template_id, week_number, day_of_week, day_title, is_rest_day)
      VALUES (tmpl_id, w, 5, w || '주차 금요일 - 파워클린/스쿼트 보조/벤치 보조', false) RETURNING id INTO d_fri;
    INSERT INTO public.template_exercises(template_day_id, exercise_name, lift_type, base_sets, base_reps, base_intensity_percent, fixed_weight, order_index, priority) VALUES
      (d_fri, '파워클린', 'power_clean', main_sets, main_reps, main_int, NULL, 0, 3),
      (d_fri, '스쿼트 (보조)', 'squat', 5, 5, GREATEST(main_int - 10, 40), NULL, 1, 2),
      (d_fri, '벤치프레스 (보조)', 'bench', 5, 5, GREATEST(main_int - 10, 40), NULL, 2, 2);
  END LOOP;
END $$;