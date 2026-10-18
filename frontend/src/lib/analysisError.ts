/**
 * What to tell the user when selfie analysis fails. Errors from api/config's
 * expectOk read "<status> <body>"; a request that never got an answer has no
 * status, and only that one is a connection problem.
 */
export function analysisErrorMessage(e: unknown): {
  title: string;
  body: string;
} {
  const text = e instanceof Error ? e.message : "";
  const status = Number(text.match(/^(\d{3}) /)?.[1]);
  const code = text.match(/"error":"([a-z_]+)"/)?.[1];

  if (code === "no_usable_face")
    return {
      title: "No clear face found",
      body: "Use a well-lit selfie that shows your whole face, looking at the camera, with no filters.",
    };
  if (
    code === "unsupported_image_type" ||
    code === "invalid_image" ||
    code === "image_dimensions" ||
    code === "file_too_large" ||
    code === "empty_file"
  )
    return {
      title: "This photo can't be used",
      body: "Try a different photo: a JPEG or PNG, at least 256 pixels on its short side.",
    };
  if (code === "rate_limited" || code === "busy")
    return { title: "Too many tries", body: "Wait a minute, then try again." };
  if (status === 401)
    return {
      title: "Can't reach Silo's server",
      body: "The app isn't set up to talk to the server. Ask the team to check its settings.",
    };
  if (status >= 500)
    return {
      title: "Analysis is busy",
      body: "Try again in a moment, or retake the selfie.",
    };
  if (!status)
    return {
      title: "Couldn't reach the server",
      body: "Check your connection and try again.",
    };
  return {
    title: "Couldn't read your photo",
    body: "Try again, or retake the selfie.",
  };
}
