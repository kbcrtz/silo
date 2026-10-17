import { Directory, File, Paths } from "expo-file-system";

const DIR_NAME = "photos";

/**
 * Copies a picker/camera image into the documents directory and returns its
 * file name. Two reasons not to keep the picker's uri: it points into the
 * cache, which iOS may purge, and the app container's absolute path changes on
 * reinstall, so only the name is safe to persist. Resolve with photoUri().
 */
export function persistPhoto(
  sourceUri: string,
  kind: "selfie" | "body",
): string {
  const dir = new Directory(Paths.document, DIR_NAME);
  dir.create({ idempotent: true, intermediates: true });
  const ext = sourceUri.split(".").pop()?.split("?")[0] || "jpg";
  const name = `${kind}-${Date.now()}.${ext}`;
  new File(sourceUri).copy(new File(dir, name));
  return name;
}

export function photoUri(name: string): string {
  return new File(Paths.document, DIR_NAME, name).uri;
}

export function deletePhoto(name: string): void {
  const file = new File(Paths.document, DIR_NAME, name);
  if (file.exists) file.delete();
}
