import { StoryShell } from "./StoryShell";
import type { Slide } from "../../types";

export function OverallSlide({ slide }: { slide: Slide }) {
  return (
    <StoryShell slide={slide}>
      <p className="text-[12px] uppercase tracking-[0.3em] text-white/75 font-bold mb-2">
        Підсумок тижня
      </p>
      <h2 className="text-[30px] leading-[1.1] font-black mb-5">
        Що робити далі
      </h2>
      <div className="space-y-3">
        {(slide.recommendations ?? []).map((rec: string, i: number) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-2xl bg-white/15 border border-white/20 px-4 py-3"
          >
            <div className="shrink-0 w-7 h-7 rounded-full bg-white text-amber-600 flex items-center justify-center font-black text-[13px]">
              {i + 1}
            </div>
            <p className="text-[14px] leading-relaxed font-medium text-white">
              {rec}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-auto text-[12px] text-white/80 pt-6">
        Тап праворуч, щоб закрити
      </div>
    </StoryShell>
  );
}
