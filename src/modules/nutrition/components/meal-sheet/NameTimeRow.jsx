import { useCallback } from "react";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Input } from "@shared/components/ui/Input";
import { VoiceMicButton } from "@shared/components/ui/VoiceMicButton.jsx";
import { parseMealSpeech } from "../../../../core/lib/speechParsers.js";

export function NameTimeRow({ form, field, setForm }) {
  const handleVoiceMeal = useCallback(
    (transcript) => {
      const parsed = parseMealSpeech(transcript);
      if (!parsed) return;
      setForm((s) => ({
        ...s,
        name: parsed.name || s.name,
        kcal: parsed.kcal != null ? String(Math.round(parsed.kcal)) : s.kcal,
        protein_g:
          parsed.protein != null
            ? String(Math.round(parsed.protein))
            : s.protein_g,
        err: "",
      }));
    },
    [setForm],
  );

  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 mb-4">
      <div>
        <SectionHeading
          as="div"
          size="xs"
          className="mb-1 flex items-center gap-2"
        >
          Назва страви
          <VoiceMicButton
            size="sm"
            onResult={handleVoiceMeal}
            onError={(e) => setForm((s) => ({ ...s, err: e }))}
            label="Голосовий ввід страви"
          />
        </SectionHeading>
        <Input
          value={form.name}
          onChange={(e) => field("name")(e.target.value)}
          placeholder="Вівсянка з бананом"
          aria-label="Назва страви"
        />
      </div>
      <div>
        <SectionHeading as="div" size="xs" className="mb-1">
          Час
        </SectionHeading>
        <Input
          type="time"
          value={form.time}
          onChange={(e) => field("time")(e.target.value)}
          aria-label="Час"
          className="w-[100px]"
        />
      </div>
    </div>
  );
}
