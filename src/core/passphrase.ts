export type PassphraseStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'very weak' | 'weak' | 'fair' | 'strong' | 'excellent';
};

export function scorePassphrase(value: string): PassphraseStrength {
  const text = String(value || '');
  let points = 0;
  if (text.length >= 8) points += 1;
  if (text.length >= 12) points += 1;
  if (text.length >= 16) points += 1;
  if (/[a-z]/.test(text) && /[A-Z]/.test(text)) points += 1;
  if (/\d/.test(text)) points += 1;
  if (/[^A-Za-z0-9]/.test(text)) points += 1;
  const score = (Math.min(4, points) as 0 | 1 | 2 | 3 | 4);
  const labels: PassphraseStrength['label'][] = ['very weak', 'weak', 'fair', 'strong', 'excellent'];
  return { score, label: labels[score] };
}

export function passphraseTooWeak(value: string): boolean {
  const text = String(value || '');
  if (text.length < 8) return true;
  return scorePassphrase(text).score < 2;
}
