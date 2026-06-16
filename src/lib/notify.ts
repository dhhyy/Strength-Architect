import { supabase } from "@/integrations/supabase/client";

export async function notify(
  userId: string,
  type: string,
  title: string,
  content?: string,
  link?: string,
) {
  await supabase.from("notifications").insert({
    user_id: userId,
    type: type as never,
    title,
    content: content ?? null,
    link: link ?? null,
  });
}
