import type { CakeRequest } from './types';
import { parseList } from './options';

// What a baker is willing/able to make, as chosen on their notification screen.
export type BakerCapabilities = {
  areas: string[];
  dietary: string[];
  kashrut: string[];
};

// Whether a request matches what a baker can make. All three must hold:
//   - the request's area is one the baker serves,
//   - the baker provides EVERY kashrut level the request lists
//     (request.kashrut ⊆ baker.kashrut — a request with no level set never
//     matches, so legacy rows are skipped),
//   - the baker can accommodate EVERY dietary need the request lists
//     (request.dietary ⊆ baker.dietary — an empty request need-list always fits).
// Pure and side-effect-free, like attention.ts, so it's easy to unit-test.
export function matchesCapabilities(
  request: CakeRequest,
  capabilities: BakerCapabilities,
): boolean {
  if (!capabilities.areas.includes(request.location)) return false;
  const requiredKashrut = parseList(request.kashrut);
  if (requiredKashrut.length === 0) return false; // legacy row with no level set
  if (!requiredKashrut.every((level) => capabilities.kashrut.includes(level))) return false;
  const needs = parseList(request.dietary);
  return needs.every((need) => capabilities.dietary.includes(need));
}
