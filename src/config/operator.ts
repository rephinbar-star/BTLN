/**
 * Operator identity.
 *
 * Every field is intentionally null until the owner supplies verified, approved
 * values. Nothing here may be guessed, inferred from a domain registration, or
 * copied from a social profile: the public site must never assert a personal or
 * legal identity that the owner has not confirmed in writing.
 *
 * When the owner supplies values, fill them in here and the About page plus the
 * Organization structured data pick them up automatically. Leave a field null to
 * keep it hidden.
 */
export interface OperatorIdentity {
  /** Registered legal entity name, e.g. "Example Studio Ltd". */
  legalName: string | null;
  /** Named person publicly responsible for the product. */
  founderName: string | null;
  /** Optional one-line role/bio for the named person. */
  founderRole: string | null;
  /** Registered address, as it should appear publicly. */
  postalAddress: string | null;
  /** Monitored support/contact email address. */
  contactEmail: string | null;
  /** Public profile URLs the owner approves for sameAs (LinkedIn, X, etc.). */
  profileUrls: string[];
}

export const OPERATOR: OperatorIdentity = {
  legalName: null,
  // Owner-approved founder bio (exact wording, first name only; no photo,
  // surname, LinkedIn, location or other identifying details).
  founderName: "Rephael",
  founderRole: "Founder & Certified Life Coach",
  postalAddress: null,
  // Owner-supplied and approved public support email.
  contactEmail: "btlines.info@gmail.com",
  profileUrls: [],
};

export const hasOperatorIdentity = (o: OperatorIdentity = OPERATOR): boolean =>
  Boolean(o.legalName || o.founderName || o.contactEmail);

/** Organization JSON-LD; only verified fields are emitted. */
export function organizationJsonLd(o: OperatorIdentity = OPERATOR) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BetweenTheLines",
    url: "https://betweenthelines.app",
    ...(o.legalName ? { legalName: o.legalName } : {}),
    ...(o.founderName ? { founder: { "@type": "Person", name: o.founderName } } : {}),
    ...(o.postalAddress ? { address: o.postalAddress } : {}),
    ...(o.contactEmail
      ? { contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: o.contactEmail } }
      : {}),
    ...(o.profileUrls.length ? { sameAs: o.profileUrls } : {}),
  };
}
