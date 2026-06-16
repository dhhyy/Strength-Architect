
DELETE FROM public.template_exercises WHERE template_day_id IN (
  SELECT id FROM public.template_days WHERE template_id IN (
    '48de7cd8-0280-4030-a9af-b990df97e228','82b423d8-417e-488c-ab6e-a664d2c0bcf9','014ae7de-6788-4466-b653-8e95e625b305',
    '1e2cf2e8-bf17-455f-959f-9e57f7c9dbfa','7183bdb3-dfac-4f8b-98b6-947ab18678cc','c11e84a3-330c-4c3c-b48f-2b4d222744c4',
    'ccb9b6b1-24d6-4403-bce8-6ecb51122c51','91f79288-57a4-417f-9ba4-630e4fa88fc9','bb391906-cf8f-42bc-9319-39c01a994a82'
  )
);
DELETE FROM public.template_days WHERE template_id IN (
  '48de7cd8-0280-4030-a9af-b990df97e228','82b423d8-417e-488c-ab6e-a664d2c0bcf9','014ae7de-6788-4466-b653-8e95e625b305',
  '1e2cf2e8-bf17-455f-959f-9e57f7c9dbfa','7183bdb3-dfac-4f8b-98b6-947ab18678cc','c11e84a3-330c-4c3c-b48f-2b4d222744c4',
  'ccb9b6b1-24d6-4403-bce8-6ecb51122c51','91f79288-57a4-417f-9ba4-630e4fa88fc9','bb391906-cf8f-42bc-9319-39c01a994a82'
);
DELETE FROM public.athlete_active_template WHERE template_id IN (
  '48de7cd8-0280-4030-a9af-b990df97e228','82b423d8-417e-488c-ab6e-a664d2c0bcf9','014ae7de-6788-4466-b653-8e95e625b305',
  '1e2cf2e8-bf17-455f-959f-9e57f7c9dbfa','7183bdb3-dfac-4f8b-98b6-947ab18678cc','c11e84a3-330c-4c3c-b48f-2b4d222744c4',
  'ccb9b6b1-24d6-4403-bce8-6ecb51122c51','91f79288-57a4-417f-9ba4-630e4fa88fc9','bb391906-cf8f-42bc-9319-39c01a994a82'
);
DELETE FROM public.routine_templates WHERE id IN (
  '48de7cd8-0280-4030-a9af-b990df97e228','82b423d8-417e-488c-ab6e-a664d2c0bcf9','014ae7de-6788-4466-b653-8e95e625b305',
  '1e2cf2e8-bf17-455f-959f-9e57f7c9dbfa','7183bdb3-dfac-4f8b-98b6-947ab18678cc','c11e84a3-330c-4c3c-b48f-2b4d222744c4',
  'ccb9b6b1-24d6-4403-bce8-6ecb51122c51','91f79288-57a4-417f-9ba4-630e4fa88fc9','bb391906-cf8f-42bc-9319-39c01a994a82'
);
