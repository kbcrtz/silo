import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert } from "react-native";

/**
 * Camera or library, returning the picked image uri or null if the user
 * cancelled or denied access. Callers persist it with lib/photos.
 */
export async function pickPhoto(
  source: "camera" | "library",
  camera: "front" | "back" = "back",
) {
  if (source === "camera") {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(
        "Camera access needed",
        "Enable camera access for Silo in Settings.",
      );
      return null;
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.8,
    // The backend can't decode HEIC; Compatible makes iOS hand over a JPEG instead.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    cameraType:
      camera === "front"
        ? ImagePicker.CameraType.front
        : ImagePicker.CameraType.back,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0].uri;
}

/** The selfie sheet: the front camera or the library. Null when cancelled. */
export function pickSelfie(): Promise<string | null> {
  return new Promise((resolve) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Take a selfie", "Choose from library", "Cancel"],
        cancelButtonIndex: 2,
      },
      (i) =>
        resolve(
          i === 0
            ? pickPhoto("camera", "front")
            : i === 1
              ? pickPhoto("library")
              : null,
        ),
    ),
  );
}
