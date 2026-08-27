import type { CakeRequest } from './types';
import { parseDietary } from './options';

// What a baker is willing/able to make, as chosen on their notification screen.
export type BakerCapabilities = {
  areas: string[];
  dietary: string[];
  kashrut: string[];
};

// Whether a request matches what a baker can make. All three must hold:
//   - the request's area is one the baker serves,
//   - the baker can accommodate EVERY dietary need the request lists
//     (request.dietary ⊆ baker.dietary — an empty request need-list always fits),
//   - the request's required kashrut is one the baker provides.
// Pure and side-effect-free, like attention.ts, so it's easy to unit-test.
export function matchesCapabilities(
  request: CakeRequest,
  capabilities: BakerCapabilities,
): boolean {
  if (!capabilities.areas.includes(request.location)) return false;
  if (request.kashrut === '' || !capabilities.kashrut.includes(request.kashrut)) return false;
  const needs = parseDietary(request.dietary);
  return needs.every((need) => capabilities.dietary.includes(need));
}
