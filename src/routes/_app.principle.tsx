import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/principle")({
  component: PrinciplePage,
});

function PrinciplePage() {
  return (
    <div className="container-mobile py-8 pb-24">
      <h1 className="text-2xl font-bold">앱 작동 원리</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        비스트렝스는 "하루 스트레스 예산" 모델로 매일 루틴을 자동 조절합니다.
      </p>

      <Section title="1. e1RM (예상 1RM)" color="#BFFF00">
        <p>
          7대 리프트의 무게×반복수를 입력하면 Epley 공식으로 1RM을 예측합니다.
        </p>
        <Code>{`e1RM = 무게 × (1 + 반복수 / 30)`}</Code>
        <p>모든 처방 무게는 이 e1RM × 강도(%)로 계산됩니다.</p>
      </Section>

      <Section title="2. 종목 강도 보정" color="#7DD3FC">
        <p>오늘 종목 훈련이 힘들수록 웨이트 볼륨을 줄입니다.</p>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {[
              ["😄 가벼웠음", "×1.15"],
              ["🙂 보통", "×1.05"],
              ["😐 평소만큼", "×1.00"],
              ["😓 힘들었음", "×0.75"],
              ["😵 매우 힘들었음", "×0.50"],
            ].map(([k, v]) => (
              <tr key={k} className="border-t border-border">
                <td className="py-1.5">{k}</td>
                <td className="py-1.5 text-right text-primary">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="3. 피로도 보정" color="#F0ABFC">
        <p>피로도가 높으면 무게·세트·반복을 동시에 감량합니다.</p>
        <table className="mt-2 w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="text-left">피로도</th>
              <th className="text-right">무게</th>
              <th className="text-right">세트</th>
              <th className="text-right">반복</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["😄 매우 가뿐", "×1.025", "×1.0", "×1.0"],
              ["🙂 가뿐", "×1.0", "×1.0", "×1.0"],
              ["😐 보통", "×1.0", "×1.0", "×1.0"],
              ["😓 피곤", "×0.90", "×0.80", "×1.0"],
              ["😵 매우 피곤", "×0.75", "×0.60", "×0.80"],
            ].map((row) => (
              <tr key={row[0]} className="border-t border-border">
                <td className="py-1.5">{row[0]}</td>
                <td className="py-1.5 text-right">{row[1]}</td>
                <td className="py-1.5 text-right">{row[2]}</td>
                <td className="py-1.5 text-right">{row[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="4. 시합 테이퍼링" color="#FF8800">
        <p>등록한 시합 일정이 가까워지면 자동으로 볼륨을 줄입니다.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>D-14 ~ D-8: 가벼운 감량 (무게 ×0.95)</li>
          <li>D-7 ~ D-4: 본격 테이퍼 (무게 ×0.85)</li>
          <li>D-3 ~ D-2: 강도만 유지, 볼륨↓</li>
          <li>D-1: 휴식 권장</li>
          <li>D-Day: 시합!</li>
        </ul>
      </Section>

      <Section title="5. 자동 회복일" color="#FF4444">
        <p>
          종목 강도가 매우 힘들고(😵) 피로도도 매우 높을 때(😵), 시스템이
          웨이트를 모두 스킵하고 회복을 권장합니다.
        </p>
      </Section>

      <Section title="6. 예시 계산" color="#FCD34D">
        <p>
          백스쿼트 e1RM 100kg, 처방 강도 75%, 종목 강도 "힘들었음(😓)",
          피로도 "피곤(😓)"인 날:
        </p>
        <Code>{`처방 무게 = 100 × 0.75 × 0.90 = 67.5kg → 67.5kg
처방 세트 = 기본 5세트 × 0.75 × 0.80 = 3세트
→ 67.5kg × 3세트 × 5회 처방`}</Code>
      </Section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        선수의 컨디션을 매일 반영하여 과훈련을 막고, 시합 당일 최고의 컨디션을
        만드는 것이 이 앱의 목표입니다.
      </p>
    </div>
  );
}

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        <h2 className="font-bold">{title}</h2>
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs text-foreground">
      {children}
    </pre>
  );
}
