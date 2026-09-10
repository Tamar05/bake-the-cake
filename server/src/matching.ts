import type { CakeRequest } from './types';
import { parseList } from './options';
import { findTown, distanceKm } from './towns';

// What a baker is willing/able to make, as chosen on their notification screen
// (Phase 5: a home town + how far they'll travel, replacing the old area list).
export type BakerCapabilities = {
  homeTown: string;
  travelRadiusKm: number;
  dietary: string[];
  kashrut: string[];
};

// Whether a request matches what a baker can make. All three must hold:
//   - the request's town is within the baker's travel radius of their home
//     town (straight-line distance) — a request whose location doesn't
//     resolve to a real town (legacy data, or someone's free-text "Other: "
//     entry) never matches: it simply isn't relevant for notifications, the
//     same way a request with no set kashrut level never matched before. It
//     remains fully visible and reservable on Browse either way — this
//     function only drives notification relevance, never access.
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
  const requestTown = findTown(request.location);
  const bakerTown = findTown(capabilities.homeTown);
  if (!requestTown || !bakerTown) return false; // unresolvable location → never matches
  if (distanceKm(requestTown, bakerTown) > capabilities.travelRadiusKm) return false;

  const requiredKashrut = parseList(request.kashrut);
  if (requiredKashrut.length === 0) return false; // legacy row with no level set
  if (!requiredKashrut.every((level) => capabilities.kashrut.includes(level))) return false;

  const needs = parseList(request.dietary);
  return needs.every((need) => capabilities.dietary.includes(need));
}
