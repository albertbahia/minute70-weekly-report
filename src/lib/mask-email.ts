/** Mask an email for display: "al*****@gmail.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "*****";
  const keep = local.length < 2 ? 1 : 2;
  return local.slice(0, keep) + "*****@" + domain;
}
