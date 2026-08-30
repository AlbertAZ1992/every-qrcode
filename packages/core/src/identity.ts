import { createDNAContext, type DNAContext } from "./link-dna.js";
import { createQRDerivedFields, type QRDerivedFields } from "./qr-fields.js";
import { createQRMatrix, type QRMatrix } from "./qr.js";
import { parseLink, type IdentityScope, type ParsedLink } from "./url.js";

export interface EveryQRCodeIdentity {
  readonly link: ParsedLink;
  readonly dna: DNAContext;
  readonly qr: QRMatrix;
  readonly fields: QRDerivedFields;
}

export type CreateIdentityOptions = {
  readonly identityScope?: IdentityScope;
  readonly identityVersion?: number;
  readonly qrProfileVersion?: number;
};

export async function createEveryQRCodeIdentity(
  input: string,
  options: CreateIdentityOptions = {},
): Promise<EveryQRCodeIdentity> {
  const identityVersion = options.identityVersion ?? 1;
  const qrProfileVersion = options.qrProfileVersion ?? 1;
  const linkOptions = options.identityScope
    ? { identityScope: options.identityScope, identityVersion }
    : { identityVersion };
  const link = parseLink(input, linkOptions);
  const qr = createQRMatrix(link.payloadUrl, qrProfileVersion);
  const [dna, fields] = await Promise.all([
    createDNAContext(link, identityVersion),
    Promise.resolve(createQRDerivedFields(qr)),
  ]);
  return { dna, fields, link, qr };
}
