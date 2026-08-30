import { digestToHex, type EveryQRCodeIdentity } from "@every-qrcode/core";

type CoreInspectorProps = {
  identity: EveryQRCodeIdentity;
};

function shortDigest(digest: Uint8Array): string {
  return digestToHex(digest).slice(0, 12);
}

export function CoreInspector({ identity }: CoreInspectorProps): React.JSX.Element {
  const qr = identity.qr;
  const metrics = [
    ["Site DNA", shortDigest(identity.dna.siteDigest)],
    ["Family DNA", shortDigest(identity.dna.familyDigest)],
    ["Page DNA", shortDigest(identity.dna.pageDigest)],
    ["Identity scope", identity.link.scope],
    ["Protocol", `DNA v${identity.dna.identityVersion} · QR v${qr.profileVersion}`],
    ["QR Matrix", `${qr.size}×${qr.size} · V${qr.symbolVersion} · M`],
  ] as const;

  return (
    <section aria-label="Every QR Code identity inspector" className="core-inspector">
      <div className="core-inspector__path">
        <span>URL</span>
        <i aria-hidden="true" />
        <span>Link DNA</span>
        <i aria-hidden="true" />
        <span>QR Matrix</span>
      </div>
      <dl className="core-inspector__metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="core-inspector__canonical" title={identity.link.payloadUrl}>
        {identity.link.payloadUrl}
      </p>
    </section>
  );
}
