# Host compatibility

This specification covers maintenance commitments for components that load code into a host process.

## Goals

Maintain components that load code into OMP against the shared floor OMP `18.5.0`. Components that load code into Pi use its separate floor `0.84.4`.

Keep required behavior on maintained hosts as they evolve. Users receive a clear maintenance statement without an installation or runtime version gate.

## Out of scope

- An upper maintenance bound, supported-version allowlist, public support matrix, compatibility manager, or shared compatibility library.
- Blocking installation, loading, registration, diagnostics, or operation solely because a host is below the maintenance floor. Such a host may work without a maintenance commitment.
- Host maintenance floors for instructions or configuration that load no code into a host process.

## Public surface

Each affected component's English and Chinese README compatibility section provides its authoritative user-facing statement. Its specification states the same confirmed number and meaning completely. Neither creates a different target.

OMP's common floor is `18.5.0`; Pi's independent floor is `0.84.4`. There is no upper maintenance bound. A floor is a maintenance commitment, not evidence that every version at or above it has been verified. A component for another host derives a floor from its actual load requirements, necessary capabilities, and behavior; insufficient evidence is recorded instead of inventing a number.

Host peer declarations name the required packages without narrowing to a maintenance range. OMP-facing components' `@oh-my-pi/*` development dependencies and check baselines are fixed at `18.5.0`. A package may still reject a genuinely missing required capability; it must not manufacture a version allowlist.

The tk runtime compatibility range, driver contract, and generated tool contract are separate from a host maintenance floor. Host-floor policy does not remove their interface compatibility checks.

## Invariants

- Maintained host behavior remains available after component updates. A capability or input shape distinguishes behavior where possible; a version distinction is justified only when shape cannot distinguish a documented semantic difference.
- Code kept solely for hosts below the floor is absent. Required behavior introduced at or below the floor remains supported.
- An unavailable capability keeps native behavior or reports a bounded, locatable reason without claiming success. Its failure does not unnecessarily disable unrelated valid capabilities.
- No installation condition, custom metadata, host peer range, loading, registration, or diagnostic path enforces the maintenance floor as a gate.
- Raising the shared OMP floor requires its own approved decision and updates every OMP-facing component together, including development baselines, specifications, and paired user-facing declarations. Pi keeps its independent version line.
- Verification addresses the behavior affected by an upgrade; changing a declaration does not establish that behavior.

## Acceptance criteria

- All declarations and specifications for components loading code into OMP agree on `18.5.0`; those loading code into Pi agree on `0.84.4`. Instruction-only and configuration-only distributions claim no host-code floor.
- A host below the floor is not rejected solely for its version. Host peers remain unrestricted, and maintenance-only upper bounds or allowlists are absent.
- Maintained-host results survive updates, and missing-capability failures remain local and explicit. Actual exercised host behavior is distinguished from source inspection and declared maintenance scope.
- Development baselines, required behavior, and user-facing statements remain synchronized when a floor changes.
