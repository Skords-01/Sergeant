import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

export type PickImageJpegResult =
  | { status: "ok"; base64: string; mimeType: "image/jpeg" }
  | { status: "cancel" }
  | { status: "error"; message: string };

async function readUriAsJpegBase64(uri: string): Promise<PickImageJpegResult> {
  const manip = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
  );
  const b64 = await FileSystem.readAsStringAsync(manip.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!b64) {
    return { status: "error", message: "Не вдалося прочитати зображення." };
  }
  if (b64.length > 5_500_000) {
    return {
      status: "error",
      message:
        "Фото ще завелике після стиснення. Оберіть знімок меншої роздільної здатності.",
    };
  }
  return { status: "ok", base64: b64, mimeType: "image/jpeg" };
}

/**
 * Галерея → стиснення (max ~1.2k px) → base64 для POST /api/nutrition/analyze-photo.
 */
export async function pickResizeAndReadBase64Jpeg(): Promise<PickImageJpegResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return {
      status: "error",
      message: "Потрібен доступ до фото (налаштування додатку).",
    };
  }
  const pick = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.85,
  });
  if (pick.canceled || !pick.assets?.[0]) {
    return { status: "cancel" };
  }
  return readUriAsJpegBase64(pick.assets[0].uri);
}

/**
 * Камера → той самий pipeline JPEG/base64, що й галерея.
 */
export async function captureResizeAndReadBase64Jpeg(): Promise<PickImageJpegResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    return {
      status: "error",
      message: "Потрібен доступ до камери (налаштування додатку).",
    };
  }
  const shot = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.85,
  });
  if (shot.canceled || !shot.assets?.[0]) {
    return { status: "cancel" };
  }
  return readUriAsJpegBase64(shot.assets[0].uri);
}
