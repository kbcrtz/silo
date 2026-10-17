import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

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
