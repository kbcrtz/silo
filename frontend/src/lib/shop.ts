import * as WebBrowser from "expo-web-browser";

/** Opens a product page in an in-app Safari sheet, so the user lands back in Silo when they close it. */
export async function openProduct(url: string, tint?: string) {
  await WebBrowser.openBrowserAsync(url, {
    controlsColor: tint,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
