# Community conduct

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra

English | [中文](./26-community-conduct.zh.md)

## Motivation

Adopt Contributor Covenant 3.0 with reporting and enforcement suited to a single maintainer.

Participants need shared behavior standards and a private way to report harm. A standard text supplies those behavior expectations, but its reporting and response arrangements must match the people who actually handle incidents. Contributor Covenant's [FAQ](https://www.contributor-covenant.org/faq/) allows a single person to handle reports in a small community and permits adaptation of the enforcement ladder.

## Decision

Publish the complete [Code of Conduct](../../../../../CODE_OF_CONDUCT.md) and its Chinese counterpart at the repository root, with reciprocal language links and entry points from each language's README and contribution guide. GitHub recognizes the root location without a duplicate policy elsewhere.

Retain Contributor Covenant 3.0's pledge, encouraged behaviors, and restrictions. Adapt reporting, responses, and scope to the project:

- Ruokee receives and handles conduct reports privately at `ruokee@foxmail.com`. Public Issues and pull requests are not the reporting channel. Share incident details with involved parties only as needed to understand and address the incident.
- Ruokee reviews reports, may seek clarification, and chooses a proportionate response. The project promises no fixed response or resolution deadline.
- Ruokee may edit or remove violating content and restrict participation. Response guidelines cover a written private warning, temporarily limited activities, temporary suspension with return conditions, and permanent exclusion. Temporary restrictions state their duration; serious violations may skip earlier steps. Where feasible, explain restrictions without unnecessarily disclosing private report details.
- The policy covers maintainers, contributors, and other participants in the repository, Issues, pull requests, and spaces explicitly managed by the project, as well as official project representation. Using or contributing to the software does not itself make someone a representative.
- Reports concerning Ruokee are received by Ruokee. The project has no separate conduct committee, independent appeals body, or designated alternative recipient, so it cannot provide independent review of those reports.

Preserve attribution to Contributor Covenant 3.0, the Organization for Ethical Source, and Mozilla's work on the enforcement ladder. License the adapted text under CC BY-SA 4.0 and identify the adaptation. The repository's other content retains its MIT license; the README makes this distinction explicit.

## Alternatives considered

A custom short policy would reduce text, but would require independently defining and maintaining the core behavior standards. Adapting Contributor Covenant preserves an established set of expectations while allowing the project to state its actual reporting and response arrangements.

## Consequences

Participants can find both behavior standards and a named recipient without posting sensitive reports publicly. The policy creates an ongoing responsibility for Ruokee to receive, assess, and address reports; adding the document alone does not perform that work.

Concentrating receipt and decisions in the sole maintainer leaves no independent reviewer when that maintainer is involved. The policy states this limitation rather than promising a review mechanism the project does not have.

The adapted policy has a different license from the rest of the repository. Reuse of its text must preserve the attribution and share-alike terms.
