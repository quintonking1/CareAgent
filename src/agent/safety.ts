// Wellness-language guard applied in code to everything the agent writes for the family.

const DIAGNOSTIC = /\b(diagnos\w*|afib|a-fib|atrial fibrillation|arrhythmias?|heart attack|heart failure|stroke|tachycardia|bradycardia|hypertension|insomnia|sleep apnea|dementia|disease|disorder)\b/i;
const DOSING = /\b(increase|decrease|double|halve|skip|stop taking|start taking)\b[^.]{0,40}\b(dose|dosage|mg|pill|medication)s?\b/i;

export const DISCLAIMER = "This is not medical advice.";

export function wellnessViolation(text: string): string | null {
  const d = text.match(DIAGNOSTIC);
  if (d) return `uses diagnostic language ("${d[0]}")`;
  const m = text.match(DOSING);
  if (m) return `gives dosing advice ("${m[0]}")`;
  return null;
}

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
