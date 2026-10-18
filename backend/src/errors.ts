/** An expected failure with the HTTP status and stable error code the app receives as `{ error: code }`. */
export class HttpError extends Error {
  readonly code: string;
  readonly status: number;
  /** Upstream HTTP status (e.g. Gemini's 429 or 402), for logs only; never sent to the app. */
  readonly providerStatus?: number;
  constructor(code: string, status: number, providerStatus?: number) {
    super(code);
    this.code = code;
    this.status = status;
    this.providerStatus = providerStatus;
  }
}
