export type EveryQRCodeErrorCode =
  | "invalid-link"
  | "link-too-complex"
  | "unsupported-version"
  | "generation-failed";

export class EveryQRCodeError extends Error {
  readonly code: EveryQRCodeErrorCode;

  constructor(code: EveryQRCodeErrorCode, message: string) {
    super(message);
    this.name = "EveryQRCodeError";
    this.code = code;
  }
}

export class InvalidLinkError extends EveryQRCodeError {
  constructor(message: string) {
    super("invalid-link", message);
    this.name = "InvalidLinkError";
  }
}

export class LinkTooComplexError extends EveryQRCodeError {
  constructor() {
    super("link-too-complex", "That link is too long for the current Every QR Code format.");
    this.name = "LinkTooComplexError";
  }
}

export class UnsupportedVersionError extends EveryQRCodeError {
  constructor(protocol: string, version: number) {
    super("unsupported-version", `Unsupported ${protocol} version: ${version}.`);
    this.name = "UnsupportedVersionError";
  }
}
