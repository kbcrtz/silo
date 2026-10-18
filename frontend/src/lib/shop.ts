import { Linking } from "react-native";

/**
 * Opens a product page in an in-app Safari sheet, so the user lands back in
 * Silo when they close it. Dev builds made before expo-web-browser was added
 * don't have its native module, so those fall back to Safari itself.
 */
export async function openProduct(url: string, tint?: string) {
  let WebBrowser: typeof import("expo-web-browser") | null = null;
  try {
    WebBrowser = require("expo-web-browser");
  } catch {
    WebBrowser = null;
  }
  if (WebBrowser) {
    await WebBrowser.openBrowserAsync(url, {
      controlsColor: tint,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } else {
    await Linking.openURL(url);
  }
}
