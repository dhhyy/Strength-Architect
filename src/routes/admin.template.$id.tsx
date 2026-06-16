import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LIFT_LABELS, LIFT_TYPES, type LiftType } from "@/lib/types";
import { ArrowLeft, Plus, Trash2, Copy, X, Eye, ClipboardPaste, ClipboardCopy } from "lucide-react";

export const Route = createFileRoute("/admin/template/$id")({
  component: TemplateEditor,
});

const DOW_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
const DOW_TO_NUM: Record<string, number> = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6, 일: 7 };

// 운동명 → lift_type 자동 매핑 (메모장 업로드용)
const LIFT_NAME_TO_TYPE: Record<string, LiftType> = {};
(Object.keys(LIFT_LABELS) as LiftType[]).forEach((k) => {
  LIFT_NAME_TO_TYPE[LIFT_LABELS[k]] = k;
  LIFT_NAME_TO_TYPE[k] = k;
});

interface ParsedRow {
  exercise_name: string;
  lift_type: string;
  base_sets: number;
  base_reps: number;
  base_intensity_percent: number | null;
  priority: number;
  note: string | null;
}

function parseBulkText(text: string): { rows: ParsedRow[]; errors: { line: number; msg: string }[] } {
  const errors: { line: number; msg: string }[] = [];
  const rows: ParsedRow[] = [];
  const lines = text.split("\n");
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 4) {
      errors.push({ line: i + 1, msg: `필드 부족 (최소 4개 필요): "${line}"` });
      return;
    }
    const [name, kindRaw, setsStr, repsStr, intensityStr, priorityStr, note] = parts;
    if (!name) {
      errors.push({ line: i + 1, msg: `운동명 비어있음` });
      return;
    }
    const kind = (kindRaw || "assist").toLowerCase();
    const isMain = kind === "main" || kind === "메인";
    const sets = parseInt(setsStr);
    const reps = parseInt(repsStr);
    if (!sets || !reps) {
      errors.push({ line: i + 1, msg: `세트/횟수 숫자 오류: "${line}"` });
      return;
    }
    let intensity: number | null = null;
    if (intensityStr && intensityStr !== "0" && intensityStr !== "-") {
      const v = parseFloat(intensityStr);
      if (isNaN(v)) {
        errors.push({ line: i + 1, msg: `퍼센트 숫자 오류: "${intensityStr}"` });
        return;
      }
      intensity = v;
    }
    const priority = priorityStr ? Math.min(3, Math.max(1, parseInt(priorityStr) || 2)) : isMain ? 3 : 2;
    const liftType = isMain ? LIFT_NAME_TO_TYPE[name] ?? "accessory" : "accessory";
    rows.push({
      exercise_name: name,
      lift_type: liftType,
      base_sets: sets,
      base_reps: reps,
      base_intensity_percent: isMain ? intensity : null,
      priority,
      note: note || null,
    });
  });
  return { rows, errors };
}

function serializeDay(exs: { exercise_name: string; lift_type: string; base_sets: number; base_reps: number; base_intensity_percent: number | null; priority: number; note: string | null }[]): string {
  if (!exs.length) return "# 예시\n백스쿼트|main|5|5|75|3|기본 강도\n루마니안 데드리프트|assist|3|8|0|2|보조 운동";
  return exs
    .map((e) => {
      const kind = e.lift_type !== "accessory" ? "main" : "assist";
      const pct = e.base_intensity_percent ?? 0;
      return `${e.exercise_name}|${kind}|${e.base_sets}|${e.base_reps}|${pct}|${e.priority}|${e.note ?? ""}`;
    })
    .join("\n");
}

// ====== 전체 주차 일괄 업로드 ======
interface FullParsed {
  // week -> dow -> rows
  weeks: Map<number, Map<number, ParsedRow[]>>;
  errors: { line: number; msg: string }[];
  totalRows: number;
}

function parseFullTemplateText(text: string): FullParsed {
  const errors: { line: number; msg: string }[] = [];
  const weeks = new Map<number, Map<number, ParsedRow[]>>();
  const lines = text.split("\n");
  let currentWeek: number | null = null;
  let totalRows = 0;

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line) return;
    // # WEEK N or # N주차
    const wm = line.match(/^#\s*(?:week\s*)?(\d+)(?:\s*주차?)?/i);
    if (wm) {
      currentWeek = parseInt(wm[1]);
      if (!weeks.has(currentWeek)) weeks.set(currentWeek, new Map());
      return;
    }
    if (line.startsWith("#")) return;
    if (currentWeek == null) {
      errors.push({ line: lineNo, msg: `주차 헤더(# WEEK 1) 누락 — 이 줄 전에 주차를 지정하세요` });
      return;
    }
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 5) {
      errors.push({ line: lineNo, msg: `필드 부족 (최소 5개 필요: 요일|운동명|main_or_assist|세트|횟수)` });
      return;
    }
    const [dowRaw, name, kindRaw, setsStr, repsStr, intensityStr, priorityStr, note] = parts;
    const dow = DOW_TO_NUM[dowRaw];
    if (!dow) {
      errors.push({ line: lineNo, msg: `요일 오류: "${dowRaw}" (월/화/수/목/금/토/일)` });
      return;
    }
    if (!name) {
      errors.push({ line: lineNo, msg: `운동명 비어있음` });
      return;
    }
    const kind = (kindRaw || "assist").toLowerCase();
    const isMain = kind === "main" || kind === "메인";
    const sets = parseInt(setsStr);
    const reps = parseInt(repsStr);
    if (!sets || !reps) {
      errors.push({ line: lineNo, msg: `세트/횟수 숫자 오류: "${setsStr}/${repsStr}"` });
      return;
    }
    let intensity: number | null = null;
    if (intensityStr && intensityStr !== "0" && intensityStr !== "-") {
      const v = parseFloat(intensityStr);
      if (isNaN(v)) {
        errors.push({ line: lineNo, msg: `퍼센트 숫자 오류: "${intensityStr}"` });
        return;
      }
      intensity = v;
    }
    const priority = priorityStr ? Math.min(3, Math.max(1, parseInt(priorityStr) || 2)) : isMain ? 3 : 2;
    const liftType = isMain ? LIFT_NAME_TO_TYPE[name] ?? "accessory" : "accessory";
    const wMap = weeks.get(currentWeek)!;
    if (!wMap.has(dow)) wMap.set(dow, []);
    wMap.get(dow)!.push({
      exercise_name: name,
      lift_type: liftType,
      base_sets: sets,
      base_reps: reps,
      base_intensity_percent: isMain ? intensity : null,
      priority,
      note: note || null,
    });
    totalRows += 1;
  });

  return { weeks, errors, totalRows };
}

function serializeFullTemplate(days: { id: string; week_number: number; day_of_week: number }[], exs: Ex[]): string {
  if (!days.length) return "# WEEK 1\n월|백스쿼트|main|5|5|75|3|기본 강도\n월|벤치프레스|main|5|5|72.5|3|\n수|데드리프트|main|5|3|80|3|\n";
  const byWeek = new Map<number, typeof days>();
  days.forEach((d) => {
    if (!byWeek.has(d.week_number)) byWeek.set(d.week_number, []);
    byWeek.get(d.week_number)!.push(d);
  });
  const out: string[] = [];
  Array.from(byWeek.keys()).sort((a, b) => a - b).forEach((w) => {
    out.push(`# WEEK ${w}`);
    const wDays = byWeek.get(w)!.sort((a, b) => a.day_of_week - b.day_of_week);
    wDays.forEach((d) => {
      const dExs = exs.filter((e) => e.template_day_id === d.id).sort((a, b) => a.order_index - b.order_index);
      const dowLabel = DOW_LABELS[d.day_of_week - 1];
      dExs.forEach((e) => {
        const kind = e.lift_type !== "accessory" ? "main" : "assist";
        const pct = e.base_intensity_percent ?? 0;
        out.push(`${dowLabel}|${e.exercise_name}|${kind}|${e.base_sets}|${e.base_reps}|${pct}|${e.priority}|${e.note ?? ""}`);
      });
    });
    out.push("");
  });
  return out.join("\n");
}

interface Tpl {
  id: string;
  template_name: string;
  description: string | null;
  split_type: string;
  days_per_week: number;
  duration_weeks: number;
  difficulty_level: string;
  target_audience: string | null;
  is_public: boolean;
}
interface Day {
  id: string;
  template_id: string;
  week_number: number;
  day_of_week: number;
  day_title: string;
  is_rest_day: boolean;
}
interface Ex {
  id: string;
  template_day_id: string;
  exercise_name: string;
  lift_type: string;
  base_sets: number;
  base_reps: number;
  base_intensity_percent: number | null;
  fixed_weight: number | null;
  priority: number;
  order_index: number;
  note: string | null;
}

function TemplateEditor() {
  const { id } = Route.useParams();
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const [exs, setExs] = useState<Ex[]>([]);
  const [week, setWeek] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [editEx, setEditEx] = useState<{ dayId: string; ex: Ex | null } | null>(null);
  const [savingTpl, setSavingTpl] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const [t, d] = await Promise.all([
      supabase.from("routine_templates").select("*").eq("id", id).maybeSingle(),
      supabase.from("template_days").select("*").eq("template_id", id).order("week_number").order("day_of_week"),
    ]);
    if (t.data) setTpl(t.data as Tpl);
    const dArr = (d.data ?? []) as Day[];
    setDays(dArr);
    if (dArr.length) {
      const { data: e } = await supabase
        .from("template_exercises")
        .select("*")
        .in("template_day_id", dArr.map((x) => x.id))
        .order("order_index");
      setExs((e ?? []) as Ex[]);
    }
  }

  function scheduleMetaSave(patch: any) {
    setTpl((t) => (t ? { ...t, ...patch } : t));
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSavingTpl(true);
      const { error } = await supabase.from("routine_templates").update(patch as any).eq("id", id);
      setSavingTpl(false);
      if (error) toast.error(error.message);
    }, 1500);
  }

  async function ensureDay(week: number, dow: number): Promise<Day | null> {
    const existing = days.find((d) => d.week_number === week && d.day_of_week === dow);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("template_days")
      .insert(({
        template_id: id,
        week_number: week,
        day_of_week: dow,
        day_title: "",
        is_rest_day: false,
      }) as any)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    setDays((s) => [...s, data as Day]);
    return data as Day;
  }

  async function toggleRest(d: Day) {
    const { data } = await supabase
      .from("template_days")
      .update({ is_rest_day: !d.is_rest_day })
      .eq("id", d.id)
      .select()
      .single();
    if (data) setDays((s) => s.map((x) => (x.id === d.id ? (data as Day) : x)));
  }

  async function updateDayTitle(d: Day, title: string) {
    setDays((s) => s.map((x) => (x.id === d.id ? { ...x, day_title: title } : x)));
    await supabase.from("template_days").update({ day_title: title } as any).eq("id", d.id);
  }

  async function saveExercise(dayId: string, payload: any, existing: Ex | null) {
    if (existing) {
      const { data, error } = await supabase
        .from("template_exercises")
        .update(payload as any)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return toast.error(error.message);
      if (data) setExs((s) => s.map((x) => (x.id === existing.id ? (data as Ex) : x)));
    } else {
      const dayExs = exs.filter((e) => e.template_day_id === dayId);
      const { data, error } = await supabase
        .from("template_exercises")
        .insert(({ template_day_id: dayId,
          exercise_name: payload.exercise_name ?? "",
          lift_type: payload.lift_type ?? "accessory",
          base_sets: payload.base_sets ?? 3,
          base_reps: payload.base_reps ?? 5,
          base_intensity_percent: payload.base_intensity_percent ?? null,
          fixed_weight: payload.fixed_weight ?? null,
          priority: payload.priority ?? 2,
          order_index: dayExs.length + 1,
          note: payload.note ?? null,
        }) as any)
        .select()
        .single();
      if (error) return toast.error(error.message);
      if (data) setExs((s) => [...s, data as Ex]);
    }
  }

  async function deleteExercise(ex: Ex) {
    await supabase.from("template_exercises").delete().eq("id", ex.id);
    setExs((s) => s.filter((x) => x.id !== ex.id));
  }

  async function dupExercise(ex: Ex) {
    const dayExs = exs.filter((e) => e.template_day_id === ex.template_day_id);
    const { data } = await supabase
      .from("template_exercises")
      .insert(({ template_day_id: ex.template_day_id,
        exercise_name: ex.exercise_name + " (복사)",
        lift_type: ex.lift_type,
        base_sets: ex.base_sets,
        base_reps: ex.base_reps,
        base_intensity_percent: ex.base_intensity_percent,
        fixed_weight: ex.fixed_weight,
        priority: ex.priority,
        order_index: dayExs.length + 1,
        note: ex.note,
      }) as any)
      .select()
      .single();
    if (data) setExs((s) => [...s, data as Ex]);
  }

  async function duplicateWeek(from: number, to: number) {
    const fromDays = days.filter((d) => d.week_number === from);
    if (!fromDays.length) return toast.error(`${from}주차 데이터가 없습니다`);
    const targetDays = days.filter((d) => d.week_number === to);
    if (targetDays.length) {
      await supabase
        .from("template_exercises")
        .delete()
        .in("template_day_id", targetDays.map((d) => d.id));
      await supabase.from("template_days").delete().in("id", targetDays.map((d) => d.id));
    }
    for (const d of fromDays) {
      const { data: nd } = await supabase
        .from("template_days")
        .insert(({
          template_id: id,
          week_number: to,
          day_of_week: d.day_of_week,
          day_title: d.day_title,
          is_rest_day: d.is_rest_day,
        }) as any)
        .select()
        .single();
      if (!nd) continue;
      const dayExs = exs.filter((e) => e.template_day_id === d.id);
      if (dayExs.length) {
        const rows = dayExs.map((e) => ({
          template_day_id: (nd as Day).id,
          exercise_name: e.exercise_name,
          lift_type: e.lift_type,
          base_sets: e.base_sets,
          base_reps: e.base_reps,
          base_intensity_percent:
            e.base_intensity_percent != null ? Math.min(95, e.base_intensity_percent + 2) : null,
          fixed_weight: e.fixed_weight,
          priority: e.priority,
          order_index: e.order_index,
          note: e.note,
        }));
        await (supabase.from("template_exercises") as any).insert(rows);
      }
    }
    toast.success(`${from}주차 → ${to}주차 복제됨 (+2%)`);
    load();
  }

  // 하루 루틴 일괄 교체 (메모장 형식)
  async function replaceDayBulk(week: number, dow: number, rows: ParsedRow[]) {
    const day = await ensureDay(week, dow);
    if (!day) return { ok: false, msg: "요일 생성 실패" };
    const existing = exs.filter((e) => e.template_day_id === day.id);
    if (existing.length) {
      const { error: delErr } = await supabase.from("template_exercises").delete().in("id", existing.map((e) => e.id));
      if (delErr) return { ok: false, msg: delErr.message };
    }
    if (rows.length) {
      const inserts = rows.map((r, i) => ({
        template_day_id: day.id,
        exercise_name: r.exercise_name,
        lift_type: r.lift_type,
        base_sets: r.base_sets,
        base_reps: r.base_reps,
        base_intensity_percent: r.base_intensity_percent,
        fixed_weight: null,
        priority: r.priority,
        order_index: i + 1,
        note: r.note,
      }));
      const { data, error } = await supabase.from("template_exercises").insert(inserts as any).select();
      if (error) return { ok: false, msg: error.message };
      setExs((s) => [...s.filter((e) => e.template_day_id !== day.id), ...((data ?? []) as Ex[])]);
    } else {
      setExs((s) => s.filter((e) => e.template_day_id !== day.id));
    }
    return { ok: true as const, msg: `${rows.length}개 운동으로 교체됨` };
  }

  async function bulkAdjust(week: number, delta: number) {
    const wDays = days.filter((d) => d.week_number === week);
    if (!wDays.length) return;
    const wExs = exs.filter(
      (e) => wDays.some((d) => d.id === e.template_day_id) && e.priority >= 3 && e.base_intensity_percent != null,
    );
    for (const e of wExs) {
      const next = Math.min(95, Math.max(40, (e.base_intensity_percent ?? 0) + delta));
      await supabase.from("template_exercises").update({ base_intensity_percent: next }).eq("id", e.id);
    }
    toast.success(`${week}주차 메인리프트 ${delta > 0 ? "+" : ""}${delta}% 적용`);
    load();
  }

  // 전체 주차 텍스트 일괄 교체
  async function replaceFullTemplate(parsed: FullParsed): Promise<{ ok: boolean; msg: string }> {
    // 1) 기존 모든 days/exercises 삭제
    if (days.length) {
      const dayIds = days.map((d) => d.id);
      const { error: e1 } = await supabase.from("template_exercises").delete().in("template_day_id", dayIds);
      if (e1) return { ok: false, msg: `기존 운동 삭제 실패: ${e1.message}` };
      const { error: e2 } = await supabase.from("template_days").delete().in("id", dayIds);
      if (e2) return { ok: false, msg: `기존 요일 삭제 실패: ${e2.message}` };
    }
    // 2) 새 days 일괄 생성
    const dayInserts: any[] = [];
    parsed.weeks.forEach((dowMap, w) => {
      dowMap.forEach((_rows, dow) => {
        dayInserts.push({
          template_id: id,
          week_number: w,
          day_of_week: dow,
          day_title: "",
          is_rest_day: false,
        });
      });
    });
    if (!dayInserts.length) {
      setDays([]);
      setExs([]);
      return { ok: true, msg: "전체 비어있는 템플릿으로 교체됨" };
    }
    const { data: newDays, error: dErr } = await supabase.from("template_days").insert(dayInserts).select();
    if (dErr || !newDays) return { ok: false, msg: `요일 생성 실패: ${dErr?.message}` };
    // 3) day_id 매핑
    const keyFor = (w: number, dow: number) => `${w}_${dow}`;
    const dayIdMap = new Map<string, string>();
    (newDays as Day[]).forEach((d) => dayIdMap.set(keyFor(d.week_number, d.day_of_week), d.id));
    // 4) exercises 일괄 생성
    const exInserts: any[] = [];
    parsed.weeks.forEach((dowMap, w) => {
      dowMap.forEach((rows, dow) => {
        const dayId = dayIdMap.get(keyFor(w, dow));
        if (!dayId) return;
        rows.forEach((r, i) => {
          exInserts.push({
            template_day_id: dayId,
            exercise_name: r.exercise_name,
            lift_type: r.lift_type,
            base_sets: r.base_sets,
            base_reps: r.base_reps,
            base_intensity_percent: r.base_intensity_percent,
            fixed_weight: null,
            priority: r.priority,
            order_index: i + 1,
            note: r.note,
          });
        });
      });
    });
    let newExs: Ex[] = [];
    if (exInserts.length) {
      const { data: ne, error: exErr } = await supabase.from("template_exercises").insert(exInserts).select();
      if (exErr) return { ok: false, msg: `운동 생성 실패: ${exErr.message}` };
      newExs = (ne ?? []) as Ex[];
    }
    setDays(newDays as Day[]);
    setExs(newExs);
    // duration_weeks 자동 보정
    const maxWeek = Math.max(...Array.from(parsed.weeks.keys()));
    if (maxWeek > tpl!.duration_weeks) {
      await supabase.from("routine_templates").update({ duration_weeks: maxWeek }).eq("id", id);
      setTpl((t) => (t ? { ...t, duration_weeks: maxWeek } : t));
    }
    return { ok: true, msg: `${parsed.totalRows}개 운동 / ${parsed.weeks.size}주차로 교체됨` };
  }

  async function bulkPaste(week: number, dow: number, text: string) {
    const day = await ensureDay(week, dow);
    if (!day) return { ok: 0, errors: ["요일 생성 실패"] };
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const errors: string[] = [];
    const rows: any[] = [];
    const dayExs = exs.filter((e) => e.template_day_id === day.id);
    let order = dayExs.length;
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 4) {
        errors.push(`행 형식 오류: "${line}"`);
        continue;
      }
      const [name, liftRaw, repsStr, setsStr, intensityStr, priorityStr, note] = parts;
      const lift = (liftRaw || "accessory").toLowerCase();
      const validLifts = [...LIFT_TYPES, "accessory"];
      if (!validLifts.includes(lift as any)) {
        errors.push(`알 수 없는 lift_type: "${liftRaw}"`);
        continue;
      }
      const reps = parseInt(repsStr);
      const sets = parseInt(setsStr);
      if (!reps || !sets) {
        errors.push(`숫자 오류: "${line}"`);
        continue;
      }
      const intensity = intensityStr ? parseInt(intensityStr) : null;
      const priority = priorityStr ? Math.min(3, Math.max(1, parseInt(priorityStr))) : 2;
      order += 1;
      rows.push({
        template_day_id: day.id,
        exercise_name: name,
        lift_type: lift,
        base_sets: sets,
        base_reps: reps,
        base_intensity_percent: lift === "accessory" ? null : intensity,
        fixed_weight: null,
        priority,
        order_index: order,
        note: note || null,
      });
    }
    if (rows.length) {
      const { data, error } = await supabase
        .from("template_exercises")
        .insert(rows as any)
        .select();
      if (error) {
        errors.push(error.message);
        return { ok: 0, errors };
      }
      if (data) setExs((s) => [...s, ...(data as Ex[])]);
    }
    return { ok: rows.length, errors };
  }

  if (!tpl) return <div className="p-8 text-muted-foreground">로딩…</div>;

  return (
    <div className="container-mobile py-6 pb-24">
      <Link to="/admin" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> 목록
      </Link>

      <div className="mt-3 rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">템플릿 정보</h2>
          <span className="text-xs text-muted-foreground">{savingTpl ? "저장 중…" : "✓ 자동 저장"}</span>
        </div>
        <button
          onClick={async () => {
            const next = !tpl.is_public;
            const { error } = await supabase.from("routine_templates").update({ is_public: next }).eq("id", id);
            if (error) return toast.error(error.message);
            setTpl((t) => (t ? { ...t, is_public: next } : t));
            toast.success(next ? "발행됨 (선수에게 노출)" : "비공개 처리됨");
          }}
          className={`w-full rounded-lg py-2 text-sm font-bold ${
            tpl.is_public ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
          }`}
        >
          {tpl.is_public ? "🟢 발행됨 — 비공개로 전환" : "⚪ 비공개 — 발행하기"}
        </button>
        <input
          value={tpl.template_name}
          onChange={(e) => scheduleMetaSave({ template_name: e.target.value })}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          placeholder="템플릿명"
        />
        <textarea
          value={tpl.description ?? ""}
          onChange={(e) => scheduleMetaSave({ description: e.target.value })}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          rows={2}
          placeholder="설명"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="분할"
            value={tpl.split_type}
            onChange={(v) => scheduleMetaSave({ split_type: v })}
            options={[
              ["full_body_3", "무분할 주3"],
              ["full_body_4", "무분할 주4"],
              ["upper_lower_4", "상하체"],
              ["five_split_5", "주5회 나눔"],
              ["custom", "커스텀"],
            ]}
          />
          <Select
            label="일수"
            value={String(tpl.days_per_week)}
            onChange={(v) => scheduleMetaSave({ days_per_week: parseInt(v) })}
            options={[["3", "3"], ["4", "4"], ["5", "5"]]}
          />
          <Select
            label="난이도"
            value={tpl.difficulty_level}
            onChange={(v) => scheduleMetaSave({ difficulty_level: v })}
            options={[
              ["beginner", "초급"],
              ["intermediate", "중급"],
              ["advanced", "상급"],
            ]}
          />
          <Select
            label="기간(주)"
            value={String(tpl.duration_weeks)}
            onChange={(v) => scheduleMetaSave({ duration_weeks: parseInt(v) })}
            options={Array.from({ length: 12 }).map((_, i) => [String(i + 1), `${i + 1}주`])}
          />
        </div>
        <button
          onClick={() => setShowPreview(true)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-border py-2 text-sm"
        >
          <Eye size={14} /> 전체 미리보기
        </button>
      </div>

      <div className="mt-4 -mx-1 flex gap-1 overflow-x-auto px-1">
        {Array.from({ length: tpl.duration_weeks }).map((_, i) => {
          const w = i + 1;
          return (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                w === week
                  ? "border-primary bg-primary/15 text-primary font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {w}주
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2 text-xs">
        {week > 1 && (
          <button onClick={() => duplicateWeek(week - 1, week)} className="rounded-lg border border-border px-2 py-1">
            {week - 1}주→{week}주 복제(+2%)
          </button>
        )}
        <button onClick={() => bulkAdjust(week, 5)} className="rounded-lg border border-border px-2 py-1">
          이 주차 +5%
        </button>
        <button onClick={() => bulkAdjust(week, -5)} className="rounded-lg border border-border px-2 py-1">
          -5%
        </button>
      </div>

      <FullTemplateMemoBox days={days} exs={exs} onReplaceFull={replaceFullTemplate} />
      <BulkPasteBox week={week} onPaste={bulkPaste} />

      <div className="mt-4 space-y-3">
        {DOW_LABELS.map((label, idx) => {
          const dow = idx + 1;
          const d = days.find((x) => x.week_number === week && x.day_of_week === dow);
          return (
            <DayCard
              key={dow}
              dowLabel={label}
              day={d}
              exs={d ? exs.filter((e) => e.template_day_id === d.id) : []}
              onCreate={() => ensureDay(week, dow)}
              onToggleRest={(d2: Day) => toggleRest(d2)}
              onTitleChange={(d2: Day, t: string) => updateDayTitle(d2, t)}
              onAddEx={async () => {
                const day = await ensureDay(week, dow);
                if (day) setEditEx({ dayId: day.id, ex: null });
              }}
              onEditEx={(ex: Ex) => setEditEx({ dayId: ex.template_day_id, ex })}
              onDelEx={(ex: Ex) => deleteExercise(ex)}
              onDupEx={(ex: Ex) => dupExercise(ex)}
              onBulkReplace={async (rows: ParsedRow[]) => replaceDayBulk(week, dow, rows)}
            />
          );
        })}
      </div>

      {editEx && (
        <ExerciseModal
          initial={editEx.ex}
          onClose={() => setEditEx(null)}
          onSave={async (payload) => {
            await saveExercise(editEx.dayId, payload, editEx.ex);
            setEditEx(null);
          }}
        />
      )}

      {showPreview && <PreviewModal tpl={tpl} days={days} exs={exs} onClose={() => setShowPreview(false)} />}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-2 text-sm">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function DayCard({ dowLabel, day, exs, onCreate, onToggleRest, onTitleChange, onAddEx, onEditEx, onDelEx, onDupEx, onBulkReplace }: any) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="font-bold">{dowLabel}요일</div>
        {day ? (
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={day.is_rest_day} onChange={() => onToggleRest(day)} />
            휴식일
          </label>
        ) : (
          <button onClick={onCreate} className="text-xs text-primary">+ 활성화</button>
        )}
      </div>
      {day && !day.is_rest_day && (
        <>
          <input
            value={day.day_title}
            onChange={(e) => onTitleChange(day, e.target.value)}
            placeholder="제목 (예: 하체의 날)"
            className="mt-2 w-full rounded-lg border border-border bg-secondary px-2 py-1.5 text-sm"
          />
          <div className="mt-2 space-y-2">
            {exs.map((e: Ex) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/50 p-2 text-xs">
                <div className="flex-1">
                  <div className="font-semibold">{"★".repeat(e.priority)} {e.exercise_name}</div>
                  <div className="text-muted-foreground">
                    {e.base_sets}×{e.base_reps}
                    {e.base_intensity_percent ? ` · ${e.base_intensity_percent}%` : ""}
                    {e.fixed_weight ? ` · ${e.fixed_weight}kg` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => onEditEx(e)} className="rounded px-2 py-1 text-primary">수정</button>
                  <button onClick={() => onDupEx(e)} className="rounded px-2 py-1"><Copy size={12} /></button>
                  <button onClick={() => onDelEx(e)} className="rounded px-2 py-1 text-destructive"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={onAddEx} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-primary/40 py-2 text-xs text-primary">
            <Plus size={14} /> 운동 추가
          </button>
          <DayMemoBox exs={exs} onReplace={onBulkReplace} />
        </>
      )}
    </div>
  );
}

function DayMemoBox({ exs, onReplace }: { exs: Ex[]; onReplace: (rows: ParsedRow[]) => Promise<{ ok: boolean | true; msg: string }> }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseBulkText(text) : null), [text]);

  async function copyCurrent() {
    const out = serializeDay(exs);
    try {
      await navigator.clipboard.writeText(out);
      toast.success("메모장 형식으로 복사됨");
    } catch {
      // 클립보드 실패시 텍스트박스에 넣어줌
      setText(out);
      setOpen(true);
      toast.message("클립보드 실패 — 텍스트박스에 넣었습니다");
    }
  }

  async function apply() {
    if (!parsed) return;
    if (parsed.errors.length) return toast.error("형식 오류부터 수정해주세요");
    if (!parsed.rows.length) return toast.error("저장할 운동이 없습니다");
    if (exs.length && !confirm(`이 요일의 운동 ${exs.length}개를 모두 삭제하고 ${parsed.rows.length}개로 교체합니다. 진행할까요?`)) return;
    setBusy(true);
    const res = await onReplace(parsed.rows);
    setBusy(false);
    if (res.ok) {
      toast.success(res.msg);
      setText("");
      setOpen(false);
    } else {
      toast.error(res.msg);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-primary/30 bg-secondary/30 p-2">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((o) => !o)} className="flex-1 text-left text-xs font-semibold text-primary">
          📝 메모장 형식 일괄 업로드 {open ? "▲" : "▼"}
        </button>
        <button onClick={copyCurrent} className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px]">
          <ClipboardCopy size={11} /> 현재 복사
        </button>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px]">
          <ClipboardPaste size={11} /> 붙여넣기
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            형식: <code className="text-primary">운동명|main_or_assist|세트|횟수|퍼센트|우선순위|비고</code>
            <br />예: <code>백스쿼트|main|5|5|75|3|기본 강도</code> · 보조운동 퍼센트는 0 또는 빈값
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={"백스쿼트|main|5|5|75|3|기본 강도\n루마니안 데드리프트|assist|3|8|0|2|보조 운동"}
            className="w-full rounded-lg border border-border bg-secondary px-2 py-2 font-mono text-[11px]"
          />
          {parsed && (
            <div className="space-y-1">
              {parsed.errors.length > 0 && (
                <div className="rounded border border-destructive/50 bg-destructive/10 p-2 text-[11px] text-destructive">
                  <div className="font-bold">형식 오류 {parsed.errors.length}건:</div>
                  {parsed.errors.slice(0, 8).map((e, i) => (
                    <div key={i}>· {e.line}행 — {e.msg}</div>
                  ))}
                </div>
              )}
              {parsed.rows.length > 0 && (
                <div className="rounded border border-border bg-card p-2 text-[11px]">
                  <div className="mb-1 font-bold text-primary">미리보기 ({parsed.rows.length}개)</div>
                  <table className="w-full">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="text-left">★</th>
                        <th className="text-left">운동명</th>
                        <th className="text-left">종류</th>
                        <th>세트</th>
                        <th>횟수</th>
                        <th>%</th>
                        <th className="text-left">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.map((r, i) => (
                        <tr key={i} className="border-t border-border/40">
                          <td>{"★".repeat(r.priority)}</td>
                          <td>{r.exercise_name}</td>
                          <td>{r.lift_type === "accessory" ? "보조" : "메인"}</td>
                          <td className="text-center">{r.base_sets}</td>
                          <td className="text-center">{r.base_reps}</td>
                          <td className="text-center">{r.base_intensity_percent ?? "-"}</td>
                          <td className="text-muted-foreground">{r.note ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <button
            disabled={busy || !parsed || parsed.errors.length > 0 || parsed.rows.length === 0}
            onClick={apply}
            className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
          >
            {busy ? "교체 중…" : `이 요일 운동을 ${parsed?.rows.length ?? 0}개로 교체`}
          </button>
        </div>
      )}
    </div>
  );
}

function ExerciseModal({ initial, onClose, onSave }: { initial: Ex | null; onClose: () => void; onSave: (payload: Partial<Ex>) => void }) {
  const [isMain, setIsMain] = useState(initial ? initial.lift_type !== "accessory" : true);
  const [name, setName] = useState(initial?.exercise_name ?? "");
  const [lift, setLift] = useState<string>(initial?.lift_type ?? "squat");
  const [sets, setSets] = useState(String(initial?.base_sets ?? 5));
  const [reps, setReps] = useState(String(initial?.base_reps ?? 5));
  const [intensity, setIntensity] = useState(String(initial?.base_intensity_percent ?? 75));
  const [useRpe, setUseRpe] = useState(initial?.fixed_weight == null && initial?.lift_type === "accessory");
  const [fixedWeight, setFixedWeight] = useState(String(initial?.fixed_weight ?? 0));
  const [priority, setPriority] = useState(initial?.priority ?? 3);
  const [note, setNote] = useState(initial?.note ?? "");

  function submit() {
    const exName = isMain && !name ? LIFT_LABELS[lift as LiftType] : name || (lift in LIFT_LABELS ? LIFT_LABELS[lift as LiftType] : "운동");
    onSave({
      exercise_name: exName,
      lift_type: isMain ? lift : "accessory",
      base_sets: parseInt(sets) || 3,
      base_reps: parseInt(reps) || 5,
      base_intensity_percent: isMain ? parseInt(intensity) || null : null,
      fixed_weight: !isMain && !useRpe ? parseFloat(fixedWeight) || null : null,
      priority,
      note: note || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{initial ? "운동 수정" : "운동 추가"}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mt-3 flex gap-2 text-xs">
          <button onClick={() => setIsMain(true)} className={`flex-1 rounded-lg border py-2 ${isMain ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
            메인 리프트 (% 기반)
          </button>
          <button onClick={() => setIsMain(false)} className={`flex-1 rounded-lg border py-2 ${!isMain ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
            보조 운동
          </button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {isMain ? (
            <label className="block text-xs">
              <span className="text-muted-foreground">리프트</span>
              <select value={lift} onChange={(e) => setLift(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-2 text-sm">
                {LIFT_TYPES.filter((l) => (l as string) !== "accessory").map((l) => (
                  <option key={l} value={l}>{LIFT_LABELS[l]}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-xs">
              <span className="text-muted-foreground">운동명</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-2 text-sm" placeholder="예: 바벨로우" />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <NumInput label="세트" value={sets} onChange={setSets} />
            <NumInput label="반복" value={reps} onChange={setReps} />
          </div>
          {isMain ? (
            <NumInput label="강도 % (1RM 대비)" value={intensity} onChange={setIntensity} />
          ) : (
            <>
              <div className="flex gap-2 text-xs">
                <button onClick={() => setUseRpe(false)} className={`flex-1 rounded-lg border py-1.5 ${!useRpe ? "border-primary text-primary" : "border-border"}`}>고정 무게</button>
                <button onClick={() => setUseRpe(true)} className={`flex-1 rounded-lg border py-1.5 ${useRpe ? "border-primary text-primary" : "border-border"}`}>RPE/자유</button>
              </div>
              {!useRpe && <NumInput label="무게 (kg)" value={fixedWeight} onChange={setFixedWeight} step="0.5" />}
            </>
          )}
          <label className="block text-xs">
            <span className="text-muted-foreground">우선순위</span>
            <div className="mt-1 flex gap-2">
              {[1, 2, 3].map((p) => (
                <button key={p} onClick={() => setPriority(p)} className={`flex-1 rounded-lg border py-2 text-sm ${priority === p ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                  {"★".repeat(p)}
                </button>
              ))}
            </div>
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">메모 (선택)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-2 text-sm" />
          </label>
        </div>
        <button onClick={submit} className="mt-4 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">저장</button>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="num mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-2 text-sm" />
    </label>
  );
}

function PreviewModal({ tpl, days, exs, onClose }: { tpl: Tpl; days: Day[]; exs: Ex[]; onClose: () => void }) {
  const rows = useMemo(() => {
    return Array.from({ length: tpl.duration_weeks }).map((_, wi) => {
      const w = wi + 1;
      return {
        w,
        days: DOW_LABELS.map((label, di) => {
          const dow = di + 1;
          const d = days.find((x) => x.week_number === w && x.day_of_week === dow);
          const dayExs = d ? exs.filter((e) => e.template_day_id === d.id) : [];
          return { label, d, exs: dayExs };
        }),
      };
    });
  }, [tpl, days, exs]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{tpl.template_name} · 전체 미리보기</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mt-3 space-y-4 text-xs">
          {rows.map((r) => (
            <div key={r.w}>
              <div className="font-bold text-primary">{r.w}주차</div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {r.days.map(({ label, d, exs: dExs }) => (
                  <div key={label} className="rounded border border-border bg-secondary/40 p-1.5">
                    <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
                    {!d || d.is_rest_day ? (
                      <div className="mt-1 text-[10px] text-muted-foreground">{!d ? "-" : "휴식"}</div>
                    ) : (
                      <div className="mt-1 space-y-0.5">
                        {dExs.map((e) => (
                          <div key={e.id} className="text-[10px]">
                            {e.exercise_name} {e.base_sets}×{e.base_reps}
                            {e.base_intensity_percent ? ` ${e.base_intensity_percent}%` : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BulkPasteBox({ week, onPaste }: { week: number; onPaste: (week: number, dow: number, text: string) => Promise<{ ok: number; errors: string[] }> }) {
  const [dow, setDow] = useState(1);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function apply() {
    if (!text.trim()) return;
    setBusy(true);
    const res = await onPaste(week, dow, text);
    setBusy(false);
    if (res.ok > 0) toast.success(`${res.ok}개 운동 추가됨`);
    if (res.errors.length) toast.error(res.errors.slice(0, 3).join("\n"));
    if (res.ok > 0 && res.errors.length === 0) setText("");
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-card p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-sm font-semibold text-primary">
        <span>📋 일괄 붙여넣기 ({week}주차)</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] text-muted-foreground">
            형식: <code>운동명 | lift_type | 횟수 | 세트 | 강도% | 우선순위 | 메모</code>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>요일:</span>
            {DOW_LABELS.map((l, i) => (
              <button key={l} onClick={() => setDow(i + 1)} className={`rounded px-2 py-1 ${dow === i + 1 ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {l}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full rounded-lg border border-border bg-secondary px-2 py-2 font-mono text-xs" />
          <button disabled={busy} onClick={apply} className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy ? "적용 중…" : "붙여넣기 적용"}
          </button>
        </div>
      )}
    </div>
  );
}

function FullTemplateMemoBox({
  days,
  exs,
  onReplaceFull,
}: {
  days: Day[];
  exs: Ex[];
  onReplaceFull: (parsed: FullParsed) => Promise<{ ok: boolean; msg: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseFullTemplateText(text) : null), [text]);

  async function copyCurrent() {
    const out = serializeFullTemplate(days, exs);
    try {
      await navigator.clipboard.writeText(out);
      toast.success("전체 템플릿이 메모장 형식으로 복사됨");
    } catch {
      setText(out);
      setOpen(true);
      toast.message("클립보드 실패 — 텍스트박스에 넣었습니다");
    }
  }

  async function apply() {
    if (!parsed) return;
    if (parsed.errors.length) return toast.error("형식 오류부터 수정해주세요");
    if (!parsed.totalRows) return toast.error("저장할 운동이 없습니다");
    const totalDays = Array.from(parsed.weeks.values()).reduce((a, m) => a + m.size, 0);
    if (
      days.length &&
      !confirm(
        `현재 ${days.length}개 요일/${exs.length}개 운동을 모두 삭제하고\n${parsed.weeks.size}주차 / ${totalDays}요일 / ${parsed.totalRows}개 운동으로 교체합니다.\n진행할까요?`,
      )
    )
      return;
    setBusy(true);
    const res = await onReplaceFull(parsed);
    setBusy(false);
    if (res.ok) {
      toast.success(res.msg);
      setText("");
      setOpen(false);
    } else {
      toast.error(res.msg);
    }
  }

  const previewWeeks = parsed
    ? Array.from(parsed.weeks.entries()).sort((a, b) => a[0] - b[0])
    : [];

  return (
    <div className="mt-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 text-left text-sm font-bold text-primary"
        >
          📚 전체 주차 일괄 업로드 {open ? "▲" : "▼"}
        </button>
        <button
          onClick={copyCurrent}
          className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px]"
        >
          <ClipboardCopy size={11} /> 전체 복사
        </button>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px]"
        >
          <ClipboardPaste size={11} /> 붙여넣기
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            형식:{" "}
            <code className="text-primary">
              요일|운동명|main_or_assist|세트|횟수|퍼센트|우선순위|비고
            </code>
            <br />
            주차 구분: <code className="text-primary"># WEEK 1</code> 또는{" "}
            <code className="text-primary"># 1주차</code>
            <br />
            요일: 월/화/수/목/금/토/일 · 보조운동 퍼센트는 0 또는 빈값
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder={`# WEEK 1
월|백스쿼트|main|5|5|75|3|기본 강도
월|벤치프레스|main|5|5|72.5|3|
수|데드리프트|main|5|3|80|3|중심 운동
수|풀업|assist|4|8|0|2|
금|오버헤드프레스|main|5|5|70|3|

# WEEK 2
월|백스쿼트|main|5|5|77.5|3|`}
            className="w-full rounded-lg border border-border bg-secondary px-2 py-2 font-mono text-[11px]"
          />
          {parsed && (
            <div className="space-y-2">
              {parsed.errors.length > 0 && (
                <div className="rounded border border-destructive/50 bg-destructive/10 p-2 text-[11px] text-destructive">
                  <div className="font-bold">형식 오류 {parsed.errors.length}건:</div>
                  {parsed.errors.slice(0, 12).map((e, i) => (
                    <div key={i}>
                      · {e.line}행 — {e.msg}
                    </div>
                  ))}
                  {parsed.errors.length > 12 && (
                    <div>… 외 {parsed.errors.length - 12}건</div>
                  )}
                </div>
              )}
              {parsed.totalRows > 0 && (
                <div className="rounded border border-border bg-card p-2 text-[11px]">
                  <div className="mb-2 font-bold text-primary">
                    미리보기 — {parsed.weeks.size}주차 / {parsed.totalRows}개 운동
                  </div>
                  <div className="space-y-2 max-h-[280px] overflow-auto">
                    {previewWeeks.map(([w, dowMap]) => {
                      const dowList = Array.from(dowMap.entries()).sort((a, b) => a[0] - b[0]);
                      return (
                        <div key={w} className="rounded border border-border/40 p-1.5">
                          <div className="font-bold text-primary">{w}주차</div>
                          <div className="mt-1 grid grid-cols-7 gap-1">
                            {DOW_LABELS.map((lab, i) => {
                              const rows = dowMap.get(i + 1) ?? [];
                              return (
                                <div
                                  key={lab}
                                  className="rounded border border-border/40 bg-secondary/30 p-1"
                                >
                                  <div className="text-[10px] font-bold text-muted-foreground">
                                    {lab}
                                  </div>
                                  {rows.length === 0 ? (
                                    <div className="text-[10px] text-muted-foreground">-</div>
                                  ) : (
                                    rows.map((r, ri) => (
                                      <div key={ri} className="text-[10px]">
                                        {r.exercise_name} {r.base_sets}×{r.base_reps}
                                        {r.base_intensity_percent
                                          ? ` ${r.base_intensity_percent}%`
                                          : ""}
                                      </div>
                                    ))
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            disabled={
              busy || !parsed || parsed.errors.length > 0 || parsed.totalRows === 0
            }
            onClick={apply}
            className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
          >
            {busy
              ? "교체 중…"
              : `전체 템플릿을 ${parsed?.weeks.size ?? 0}주차 / ${parsed?.totalRows ?? 0}개 운동으로 교체`}
          </button>
        </div>
      )}
    </div>
  );
}
