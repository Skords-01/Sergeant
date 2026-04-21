/**
 * Deep-link target for `sergeant://food/scan`.
 *
 * The real barcode scanner (ZXing-backed on web; `expo-camera` on
 * mobile — see `docs/react-native-migration.md` § 5.5 / § 6.6) is
 * part of Phase 7. Until then this screen surfaces an explicit
 * placeholder + fallback back to the Nutrition module root, so
 * Android app-shortcuts and push-notification deep links never
 * silently drop the user on a blank screen.
 */
import { DeepLinkPlaceholder } from "@/components/DeepLinkPlaceholder";

export default function NutritionScanScreen() {
  return (
    <DeepLinkPlaceholder
      title="Сканер штрихкодів"
      followUp="Сканер (expo-camera + OFF/USDA/UPCitemdb) — Phase 7 (Порт модуля Харчування)."
      primaryAction={{ label: "До Харчування", href: "/(tabs)/nutrition" }}
    />
  );
}
