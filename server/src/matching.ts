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
//   - the baker provides at least ONE of the kashrut levels the request would
//     accept (the request lists its acceptable levels; overlap is enough),
//   - the baker can accommodate EVERY dietary need the request lists
//     (request.dietary ⊆ baker.dietary — an empty request need-list always fits).
// Pure and side-effect-free, like attention.ts, so it's easy to unit-test.
export function matchesCapabilities(
  request: CakeRequest,
  capabilities: BakerCapabilities,
): boolean {
  if (!capabilities.areas.includes(request.location)) return false;
  const acceptableKashrut = parseList(request.kashrut);
  if (!acceptableKashrut.some((level) => capabilities.kashrut.includes(level))) return false;
  const needs = parseList(request.dietary);
  return needs.every((need) => capabilities.dietary.includes(need));
}
