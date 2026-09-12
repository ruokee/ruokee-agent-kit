/**
 * Deduplicated diagnostics for the extension.
 *
 * A diagnostic carries a bounded reason and target description; it never
 * contains prompt bodies, private paths, or session context. The same
 * (scope, kind, reason, target) tuple is reported once per session; a changed
 * kind, reason, or target may report again. Trackers for different turns
 * share the same seen set only when their session IDs match.
 */

export interface Diagnostic {
  scope: string;
  reason: string;
  target: string;
}

export interface DiagnosticSink {
  report(message: string): void;
}

export class DiagnosticTracker {
  constructor(
    private readonly scope: string,
    private readonly sink: DiagnosticSink,
    private readonly seen = new Set<string>(),
  ) {}

  report(reason: string, target: string): void {
    this.reportOnce(
      "replacement",
      reason,
      target,
      `omp-system-prompt: system prompt replacement NOT applied (reason: ${reason}; target: ${target}). The incoming prompt runs unchanged; the owned prompt is not active for this turn.`,
    );
  }

  reportSettingsFallback(reason: "read-failed" | "invalid-type", target: string): void {
    this.reportOnce(
      "settings",
      reason,
      target,
      `omp-system-prompt: renderDelivery setting ignored (reason: ${reason}; target: ${target}). Delivery remains enabled for this turn.`,
    );
  }

  reportSkillFormattingSkipped(reason: string, target: string): void {
    this.reportOnce(
      "skill-formatting",
      reason,
      target,
      `omp-system-prompt: Skill catalog formatting skipped (reason: ${reason}; target: ${target}). The owned prompt remains active for this turn.`,
    );
  }

  private reportOnce(kind: string, reason: string, target: string, message: string): void {
    const key = `${this.scope}|${kind}|${reason}|${target}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.sink.report(message);
  }
}
