---
name: root-cause-verifier
description: >-
  A strict methodology for identifying, proving, solving, and preventing the true root cause of software issues. Enforces evidence preservation before mitigation, hypothesis discipline, backward tracing, and minimal surgical changes. Separates urgent service restoration from root cause investigation so evidence is never destroyed. Use this whenever the user reports a bug, production incident, failing test, regression, crash, exception, or "why is X happening" question about broken code. Runs a fast triage first: trivial issues get a lightweight fix, anything non-trivial escalates to the full evidence-based protocol.
---

# Root Cause Verifier

## Core Principle
The objective is not to find a plausible explanation, but to prove the true root cause using observable evidence. A plausible explanation that survives initial scrutiny is still not proof — proof requires demonstrating necessity and sufficiency under controlled conditions. Every investigation continues until the root cause is verified, competing hypotheses are eliminated, or the available evidence is genuinely insufficient to distinguish between them.

## Overview
This skill is a strict Root Cause Verification Framework. It is an operating procedure, not a toolkit. It constrains agent behavior to ensure that bugs are investigated scientifically, fixes are minimal and surgical, and regressions are avoided.

It has two speeds:

- **Lightweight Mode** — for trivial, single-cause, low-risk issues. Fast, still evidence-based, skips the full report.
- **Full Protocol** — for anything serious, ambiguous, recurring, or high-risk. The entire workflow below.

Phase 0.5 (Triage) decides which one applies. For production incidents, Phase 0.7 (Stabilize & Preserve) runs before the full protocol to ensure ephemeral evidence is captured before it is lost.

## Scope
Applies to all software investigation tasks: production incidents, staging failures, QA defects, runtime exceptions, logic bugs, API failures, database failures, auth issues, infrastructure failures, deployment regressions, configuration errors, performance regressions, memory leaks, concurrency issues, race conditions, third-party integration failures, and "why is X happening" questions.

## Mission Statement
Identify, verify, solve, and prevent the true root cause of software issues using observable evidence. Every decision must be evidence-based. Every conclusion must be falsifiable. Every code change must directly address a verified root cause. If evidence is insufficient, stop and request the missing information rather than guessing.

## Mission Constraints
This skill SHALL NOT:
- Guess missing information or invent observations.
- Modify unrelated code, optimize, or refactor for style.
- Declare a root cause without proving necessity and sufficiency.
- Ignore or dismiss contradictory evidence.
- Treat a correlated change as a causal change without proving necessity.
- Stop at the first plausible explanation without actively seeking disconfirming evidence.
- Fix only the trigger while leaving the underlying cause unaddressed.
- Declare an investigation complete without checking for the same failure pattern elsewhere in the codebase.
- Apply fixes during investigation before root cause is verified (except for urgent service restoration, and only after evidence is preserved).
- Delete, overwrite, or summarize away evidence.
- Hide uncertainty or report assumptions as facts.

## Phase 0: Environment Check (do this first, silently)
Determine capabilities available in this session:
- **Full access**: Claude can read/write files, run shell commands, execute tests, inspect runtime output.
- **Advisory only**: Claude reasons over pasted user input.

| Section | Full access | Advisory only |
| :--- | :--- | :--- |
| **Evidence Collection** | Read files, grep, run tests, inspect logs | Ask user to paste logs/traces/code |
| **Safe Actions** | Executed directly by Claude | Given to user as exact commands to run |
| **Unsafe Actions** | Require explicit human approval | Always the user's action — Claude recommends |
| **Root Cause Proof** | Claude reproduces/reverts directly | Claude asks user to run steps and report |
| **Minimal Implementation** | Claude edits file(s) directly | Claude provides diff/patch |

Never silently assume full access. If a tool fails or isn't available, drop to advisory mode. In advisory mode, batch evidence requests and provide exact copy-paste commands.

## Phase 0.5: Triage (severity + mode selection)
Lightweight Mode applies when ALL hold:
- Single, obvious, immediately-visible cause (typo, off-by-one).
- No production/customer/security impact.
- Fix touches ≤ 1 function/file.
- No ambiguity requiring ranked alternatives.
- It is not a regression (something that previously worked).

$\rightarrow$ State evidence (1-3 lines), state cause, fix, verify, stop.

Full Protocol applies when ANY hold:
- Production/staging incident, customer-facing, urgent/critical.
- Cause isn't obvious (multiple plausible explanations).
- Security, data loss, or financial/data-integrity risk.
- Regression or intermittent/non-deterministic.
- User explicitly asks for "proper investigation" or "root cause analysis."

**Escalation rule**: If a Lightweight Mode fix fails on the first attempt, immediately escalate to Full Protocol. Do not iterate within Lightweight Mode.

## Phase 0.7: Stabilize & Preserve (incidents and production issues only)
For any production/staging incident, before investigating root cause:

### Step 1: Capture Ephemeral Evidence (before it disappears)
Capture in-memory or rolling state immediately:
- Thread dumps, heap dumps, core dumps.
- Current log tail (last 1000+ lines) before rotation.
- Process state: CPU, memory, file descriptors, network connections.
- Current configuration and environment variables.
- Active request queues, in-flight transactions.

In advisory mode: provide exact commands for the user to run, prioritizing in-memory state.

### Step 2: Decide — Mitigate or Investigate First?
- If service is down/degrading: mitigate first (rollback, restart, failover, circuit-break, shed load). Mitigation must be recommended loudly and immediately, but still routes through the Unsafe Actions approval gate (Section 7). Urgency changes the speed of escalation, not the authority to act. Document the mitigation action and timestamp.
- If stable/intermittent: investigate first. Mitigation can wait for root cause.
- If evidence capture and mitigation conflict: prioritize service restoration, capture what you can.

### Step 3: Record Pre-Incident Baseline
Note the last known-good state: last deployment, passing test run, healthy metrics snapshot.

> [!IMPORTANT]
> Do not begin modifying code to "fix" the issue during this phase. Mitigation is permitted; investigation-driven fixes come after root cause is proven.

## Evidence & Confidence Rules

### Evidence Priority Hierarchy
1. Runtime behavior (Highest)
2. Logs
3. Metrics
4. Traces
5. Tests
6. Code
7. Documentation
8. Human assumptions (Lowest)

### Confidence Model
- **Low**: Gather evidence.
- **Medium**: Run discriminating experiments. Propose hypotheses with explicit alternatives.
- **High**: Attempt to disprove. Design experiments to falsify the leading hypothesis.
- **Verified**: Proceed to solution comparison. Necessity and sufficiency proven.

### Causal vs Correlational Evidence
Two things changing simultaneously is correlation, not causation. To distinguish:
- **Correlation**: Event A and Event B both occurred around the time of the failure.
- **Causation**: Removing Event A removes the failure (necessity proven), and restoring Event A reintroduces the failure (sufficiency proven).

**Rule**: Never attribute root cause to a correlated change without proving necessity.

### Evidence Log (Full Protocol)
Evidence #[N]: Source / Timestamp / Observation / Confidence / Affected Component / Reason Collected / Hypotheses Supported / Hypotheses Contradicted

## Hypothesis Discipline
Before committing to any explanation, generate at least two competing hypotheses. If you cannot generate a second, you lack enough evidence to understand the problem space.

Each hypothesis must include:
- **Statement**: A precise, testable claim.
- **Predictions**: What else would be true if this is correct.
- **Falsification condition**: What evidence would disprove this.
- **Discriminating experiment**: What test distinguishes this from alternatives.
- **Prior probability**: How likely relative to alternatives.

Before declaring a root cause, actively search for evidence that contradicts your conclusion. State explicitly what you searched for.

## Full Protocol Workflow

### 1. Incident Classification
Classify severity (Critical/High/Medium/Low), business impact, affected users, data/security risk. Determine if Phase 0.7 is needed (yes for any prod/staging issue).

### 2. Context Lock & Evidence Collection
Capture issue, expected behavior, actual behavior, environment, recent changes. Define exact reproduction steps. If non-reproducible, switch to references/non-reproducible-issues.md.

**Evidence Sufficiency Gate**: If evidence cannot distinguish between $\ge 2$ hypotheses, STOP. Request missing evidence. Do not invent facts.

### 3. What Changed
For regressions, systematically check:
- Code changes (commits, merges, hotfixes).
- Configuration changes (flags, env vars, IaC diffs).
- Dependency changes (libraries, base images, runtimes).
- Data changes (migrations, volume growth, shifts).
- Traffic/load changes (spikes, new patterns).
- Temporal/environmental (cert expirations, DST, scheduled jobs).
- External system changes (third-party APIs, DNS).

For each, note what, when, who, and if it correlates. Remember: correlation is not causation.

### 4. Investigation Loop
Evidence $\rightarrow$ Generate $\ge 2$ Hypotheses $\rightarrow$ Design Discriminating Experiments $\rightarrow$ Execute $\rightarrow$ Update Evidence Log $\rightarrow$ Eliminate/Refine. Stop when root cause verified, evidence exhausted, or human approval required. State predicted outcomes before running experiments.

### 5. Architectural Boundary & Investigation Scope
**Architectural Boundary Rule**: Before investigating, identify the smallest architectural component that owns the reported behavior (e.g., the specific feature, microservice, class, module, or function). Limit the initial investigation to that boundary. Do not inspect unrelated modules or traverse the wider architecture unless collected evidence demonstrates that the execution path crosses the current boundary.

**Boundary Expansion**: Every boundary expansion must be explicitly justified by evidence. Stay within the verified execution path. Expand only to the next owning architectural component along that execution path. If evidence demonstrates that the root cause lies outside the current boundary, document the discovery, explain why the boundary changed, and request approval before opening a new investigation. Never silently switch investigations or expand scope without logging the justification.

### 6. Autonomous Experimentation Rules
- Ambiguous results $\rightarrow$ design a new experiment to maximize information gain, not confidence.
- Prefer experiments that can falsify a hypothesis over experiments that only confirm it.
- Stop when evidence cannot improve, permissions prevent investigation, or safety would be violated.

### 7. Safe vs Unsafe Actions
See Phase 0 table for full-access vs advisory mapping.
- **Safe**: Reading files, searching, running tests, inspecting logs, capturing diagnostics.
- **Unsafe**: Production deployment, restarting services, database writes, schema migrations, feature flag changes, cache invalidation, rollbacks, data deletion. Always requires explicit human approval regardless of access level or urgency. In production, even read-only operations can be risky (full-table scans, verbose log tailing) — assess blast radius.
- **Urgency Note**: Urgency changes the speed of escalation (recommend immediately and loudly), not the authority to bypass the human approval gate.

### 8. Root Cause Depth (Trigger vs Cause, Stopping Criterion)
Distinguish three layers:
- **Trigger**: Immediate event (e.g., "null request arrived at 14:23").
- **Proximate cause**: Code-level defect (e.g., "handler lacks null validation").
- **Underlying cause**: Condition allowing the defect (e.g., "API contract lacks nullability spec").

- **Where to fix**: Minimum proximate cause. If actionable, address underlying cause.
- **Stopping criterion**: Deepest cause that is (a) actionable, (b) within control boundary, (c) proportionate to severity.
- **Compounding causes**: Prove necessity of the combination (removing any one prevents failure) and sufficiency of the combination (all present $\rightarrow$ failure).

### 9. Root Cause Proof Gate
- **Prove Necessity**: Removing the cause removes the failure.
- **Prove Sufficiency**: Restoring the cause reproduces the failure.
- **Check Exclusivity**: Are there other identified causes that independently satisfy necessity? If yes, treat as compounding-cause scenario.
- If proof is incomplete, STOP.

### 10. Minimal Implementation & Solution Selection

**Generate Alternatives**:
Before implementation, generate all materially different, technically valid implementation approaches that satisfy the verified root cause. Do not proceed with the first plausible fix. Compare the generated alternatives using the Solution Selection hierarchy. Implement the highest-ranked option and briefly state why the alternatives were rejected.

**Implementation Knowledge Sufficiency**:
Before selecting or implementing a solution, assess whether sufficient implementation knowledge exists to produce a production-grade fix. Distinguish between understanding the root cause and understanding the correct implementation.

If implementation knowledge is sufficient:
Proceed to Solution Selection.

If implementation knowledge is insufficient:
Do not guess, infer, or synthesize an implementation from incomplete knowledge.

Instead:
- Clearly state what implementation knowledge is missing.
- Explain why the current evidence is insufficient to safely implement a production-grade fix.
- Identify the exact information required (e.g., framework documentation, official migration guide, API specification, library documentation, maintainer guidance, or authoritative implementation examples).
- Request or gather the missing implementation evidence before continuing.
- Resume Solution Selection only after the implementation evidence has been collected and evaluated.

The inability to safely implement a fix is not a failure of the investigation. A verified root cause with insufficient implementation evidence shall result in evidence gathering—not speculative code changes.

**Solution Selection**:
When evaluating the generated alternatives, rank them against this hierarchy:
1. **Reversibility & Blast Radius**: Prefer changes that are easy to revert and have the lowest risk of unintended side effects.
2. **Architectural Fit**: Prefer solutions that utilize existing codebase patterns, utilities, and abstractions over introducing foreign concepts or new dependencies.
3. **Fail-Safe Design**: Prefer fixes that fail gracefully (e.g., returning a safe default or degrading functionality) rather than failing catastrophically, provided they still log the error.
4. **Performance Overhead**: Prefer zero or negligible overhead. If a fix requires added overhead (e.g., locking, synchronous checks), it must be proportionate to the severity of the bug.
5. **Maintainability**: Prefer explicit, readable code over dense or "clever" one-liners. Future maintainers must understand both the fix and the root cause it addresses.

- **Scope discipline**: The smallest change that fixes the verified root cause. No unrelated refactoring. No style changes. No "while I'm here" optimizations.
- **Depth adequacy**: The change must be minimal in scope but adequate in depth — it must address the root cause at the appropriate layer (Section 8), not just the trigger. A minimal fix that only patches the trigger is not adequate, even if it is small.
- **Layered defense allowance**: If the root cause is a missing validation upstream, the primary fix is to add validation upstream. Adding a defensive null check at the point of crash is permissible as a secondary layer only if it is explicitly labeled as defense-in-depth and the upstream fix is the primary fix. Do not substitute a defensive check for the root cause fix.
- **Bug cluster detection**: Before implementing, search the codebase for the same pattern that caused this bug. If the root cause is "missing null check on config loader output," search for all other callers of the config loader — they may have the same bug. Document findings. Fix the verified instance in this change. File follow-up issues for other instances found (do not expand this fix into a sweep — that risks regressions and violates minimal scope).
- **Predict side effects**: Before implementing, explicitly list: performance impact, security implications, compatibility concerns, data integrity risks, and behavioral changes visible to callers. State "no side effects identified" only after actively checking each category.

### 11. Verification
- **Failure resolution**: Original failure no longer occurs.
- **Reproduction revert**: Reverting the fix reintroduces the failure (confirms causality).
- **Regression checks**: Existing tests pass. Add new tests for the root cause if missing.
- **Edge cases**: Verify boundary conditions.
- **Side effect verification**: Confirm predicted side effects match actual behavior.

## Expected Outputs (Full Protocol)
1. Issue Summary (what, when, impact, severity)
2. Evidence Summary (chronological log)
3. Execution Path (backward trace to divergence point)
4. What Changed (changes correlated with onset, causal vs correlational)
5. Ranked Hypotheses (evidence, contradictions, falsification, confidence)
6. Experiments (hypothesis, predicted vs actual, conclusion)
7. Verified Root Cause (necessity, sufficiency, exclusivity, trigger/proximate/underlying)
8. Solution Comparison (pros, cons, risks)
9. Selected Solution (why, why alternatives rejected)
10. Minimal Implementation (exact changes, scope justification)
11. Bug Cluster Report (other locations, follow-ups)
12. Side Effect Analysis (predicted and observed)
13. Verification Results (failure resolved, revert confirmed, regressions)
14. Prevention (tests, monitors, runbooks, process changes)
15. Post-Incident Review (timeline, trigger, lessons, follow-ups)

## Investigation Completion Criteria
- [ ] Root cause verified (necessity + sufficiency + exclusivity)
- [ ] Trigger, proximate cause, and underlying cause distinguished
- [ ] Minimal solution implemented (adequate depth, minimal scope)
- [ ] Verification passed (failure resolved, reproduction revert confirmed)
- [ ] Regression checks passed (existing tests + new test for root cause)
- [ ] Bug cluster check completed (same pattern searched elsewhere)
- [ ] Side effects analyzed and verified
- [ ] Prevention added (test, monitor, or process change)
- [ ] Documentation updated
- [ ] Underlying-cause follow-up documented if too large for this fix

## Common Mistakes
- **Treating symptoms as causes**: Fixing a null pointer without proving why it was null.
- **Fixing the trigger, not the cause**: Blocking a specific bad request without fixing the vulnerable code path.
- **Ignoring contradictory evidence**: Dismissing logs/metrics that contradict the favorite hypothesis.
- **Unrelated refactoring**: Cleaning up nearby code during the fix, risking regressions.
- **Skipping triage**: Running the full 15-point report on a typo, or quietly patching a prod incident as trivial.
- **Destroying evidence before capturing it**: Restarting a service before capturing diagnostics.
- **Stopping at the first plausible explanation**: Not generating alternatives or seeking disconfirming evidence.
- **Treating correlated changes as causal**: Prove necessity before attributing cause.
- **Expanding scope during the fix**: "While I'm in here..." — file a follow-up.
- **Not checking for the same bug elsewhere**: Fixing one instance of a pattern without searching for others.
- **Assuming non-reproducible means non-existent**: Giving up without instrumenting for the next occurrence.
- **Equating "fix works" with "root cause was correct"**: Verifying by reverting the fix and confirming failure returns.
- **Availability bias**: Overweighting the most recent or memorable similar incident. Treat each incident on its own evidence.
- **Sunk cost fallacy**: Refusing to abandon a hypothesis because of time invested. If evidence contradicts it, abandon it immediately.

## Handling Non-Reproducible Issues
When the issue cannot be reproduced on demand:
- Do not guess. State explicitly that the issue is non-reproducible with current evidence.
- **Instrument and wait**: Add targeted logging/telemetry at the suspected failure point. Deploy and wait for recurrence. Be specific about what to log (inputs, state, timing, thread info) — not just "add more logging."
- **Review production telemetry**: Look for the failure signature in existing logs/metrics/traces. Search for partial occurrences — the failure may have happened before without being reported.
- **Check environmental differences**: Compare the failing environment with a working one (staging vs production, instance A vs instance B). Diff configuration, dependencies, data, load, time-of-day.
- **Statistical approach**: If the issue is intermittent, gather occurrence data and look for correlates (time, load, specific request types, specific users, deployment cadence).
- **Stress and boundary testing**: If the issue is timing-related, test under higher load, slower network, larger payloads, or constrained resources.
- **State-dependent bugs**: Check for state that persists across requests (caches, sessions, connection pools, singletons). The bug may only manifest when the system is in a specific state.

If still non-reproducible after reasonable effort: Document what is known, what was tried, what telemetry has been added, and what the next step would be if it recurs. Do not declare a root cause. Set up the instrumentation so the next occurrence captures the evidence needed.
