# ntrloc Design Notes: Authorization for Processes, Transitions, and Tasks

## Topics: Marker-Mediated vs. Direct-Grant Authorization, Task Candidacy, Process Roles

This is a checkpoint of an in-progress design conversation, not a finished spec. Revise/refine in
place as the thinking develops further. Related to, but distinct from, `ntrloc-workflow-summary.md`
Section 4's "Authorization scope for manual starts" — that section already decided manual starts
should be gated through the marker model with the grant currently held only by the admin role; this
document's Section 3 proposes a different (direct-grant, not marker-mediated) shape for that same
gate, not yet reconciled with the earlier decision.

---

## 1. Starting Point: How Transitions Are Actually Authorized

Reviewed the existing mechanism (`PermissionService.mayExecuteTransition`/`mayStartStateMachine`,
`AuthorizationCacheManager`) to ground the rest of the conversation. Neither state transitions nor
state-machine starts are ever granted directly to a user or group. Instead:

- `transition:execute` / `state-machine:start` grants are bound to a **marker** (existence-only
  grant, `MarkerScopedGrantRow`).
- A principal (user or group) holds that marker via a grant.
- The item itself must currently carry the marker for the check to pass.

So the check is two-hop: does the item carry marker M, and has this principal (directly, or via a
group) been granted the transition/start through M? This is the same shape as every other
permission in the system (`item:read`, `property:read/write`, link perspectives) — permission is
contingent on what's currently true of the item, not a static role assignment.

---

## 2. First Crack: Does This Extend to BPMN User Tasks?

Compared against how `TaskAdminController`/`ProcessGroupRepository` actually authorize user-task
candidacy today. They don't use markers at all:

- Flowable's native `taskCandidateUser`/`taskCandidateGroup` (set at process-definition or
  runtime-variable time), checked via `taskService.createTaskQuery()...taskCandidateGroupIn(...)`.
- Group membership comes from `process_group`/`process_group_member` — a table deliberately kept
  separate from `security_group` (see that table's own migration comment, and prior session
  feedback: process groups and permission groups are different concepts, never merge the tables).

So today there are two unrelated authorization mechanisms for "the system pauses, a human has to
act": markers (instance-scoped, contingent on the item) for transitions, and Flowable's native
candidate model (definition/runtime-configured, no item awareness at all) for tasks. This split is
what originally felt like a "square peg / round hole" inconsistency worth interrogating.

---

## 3. Broadening the Question: Manual Process Initiation

Raised as a third surface: authorized users should probably be able to manually *start* a process,
not just handle tasks inside one. Checked the actual code:

**Confirmed live security gap, not hypothetical**: `POST /api/admin/process/definitions/start`
(`ProcessAdminController.startProcessInstance`) has **no authorization check beyond being
authenticated**. `SecurityConfig`'s `springSecurityFilterChain` only role-gates the literal
`/admin/**` path prefix (`hasRole("ADMIN")`); `/api/admin/**` falls through to
`.anyExchange().authenticated()`. Any logged-in user, not just an admin, can currently start any
deployed process definition. (Cross-reference: `ntrloc-workflow-summary.md` Section 4 already
*decided* manual starts should be admin-only and marker-gated — this gap means that decision was
never actually implemented in code.)

**Taxonomy that falls out of this**: ntrloc already has two authorization patterns, not one:

1. **Instance-scoped, marker-mediated** (Section 1's mechanism) — only works when there's an
   already-existing item to carry the marker.
2. **Definition-scoped, direct grant** — `item-type:read`, `item-type:create`. No marker
   indirection, because at create-time there's no instance yet to carry one.

Manual process initiation is structurally identical to `item-type:create`: a create-time act with
no item to anchor a marker to. Proposed shape: a `process-definition:start` direct grant, keyed by
principal + process definition/key, checked the same way `item-type:create` already is. **Not yet
reconciled** with `ntrloc-workflow-summary.md`'s existing "marker-gated" framing for the same gate —
next time this is touched, decide which shape wins (or whether they're compatible).

---

## 4. Attempted Unification: Fold Task Candidacy Into Markers

Proposed extending the marker model to user tasks: a `task:claim` verb (scoped to a
task-definition-key or process, same `MarkerScopedGrantRow` shape as `transition:execute`), so an
admin administers "who can claim this task" on the same Access screen as everything else, instead
of learning Flowable's separate candidate/`process_group` model.

**Countered, and the counterargument won** (see Section 5). Two objections:

1. **Marker proliferation.** Task routing often has nothing to do with access — "whoever's on the
   review-ops rotation" isn't an access boundary. Forcing it through a marker means minting markers
   whose only job is staffing, which cheapens what a marker means everywhere else (an admin should
   be able to assume every marker says something about who's trusted to see/touch data).
2. **Category mismatch, not just a different scoping pattern.** Markers answer "am I *allowed*" —
   a static yes/no. Task candidacy answers "am I the *right one*, right now, and is this still
   available" — claim/unclaim, one-taker-wins races, reassignment, escalation. That's state
   belonging to the task instance, not a grant. Routing it through markers doesn't remove Flowable's
   own task-assignment machinery (claiming still has to exist, races still have to resolve) — it
   adds an indirection layer in front of a system that still has to do everything it does today. Net
   increase in surface area for illusory administrative consistency.

**Conclusion: task candidacy stays on Flowable's native model / `process_group`, un-unified.**

---

## 5. Refinement: "Allowed" Is a Precondition for "Routed," Not Independent

Pushback on Section 4's conclusion: you can't coherently be "the right one" for work you have no
permission to perform at all. "Allowed" and "routed" aren't two orthogonal, freely composable
systems — there's a strict dependency: *allowed → routed*.

**Resolution: gate, don't merge.** Markers stay the sole authority on "am I permitted"; Flowable's
candidate/claim machinery stays the sole authority on "am I the one, right now, is it open." But the
second should never be evaluated (or at least never surfaced as actionable) without the first
already passing — the same two-step shape transitions already have (candidate list gets you to the
door; `mayExecuteTransition` still separately gates the actual verb before anything executes).

**Concretely, what "allowed" means for a task** decomposes into things that already exist:
`item:read` on the task's anchor item (so the principal can see what they'd be acting on), plus
whatever `property:write` grants cover the fields the task's action touches.

- **Write side is likely already safe**: confirmed (this session) that nothing outside the
  ledger/register coordinator can mutate the register — a script task can't write directly. So an
  unauthorized write from inside a task completion should already fail deep in the checked mutation
  path, regardless of how the task was reached. Not independently verified end-to-end for BPMN task
  completions specifically — worth confirming next time this is built, especially for task actions
  that are a decision (approve/reject) with no direct property mutation to hang the check on.
- **Read side is a real, currently-open gap**: `TaskAdminController.listTasks` filters purely on
  assignee/candidate (`taskAssignee`/`taskCandidateUser`/`taskCandidateGroupIn`) — it does **not**
  cross-check `item:read` on the task's anchor item at all. A principal can be a valid Flowable
  candidate for a task running against a `Confidential`-marked item with zero `item:read` grant on
  that item, and see its data through the task's own variables. **Proposed fix, not yet built**:
  `item:read` as an additional filter/precondition at task listing and claim time — composed on top
  of Flowable's candidate resolution, not fused into it. No new marker verb needed for this; it's a
  precondition check using the permission the platform already computes for every other read.

---

## 6. The Actual Root of the Discomfort: Processes Aren't One Category

Named by working backward from "why do transitions and tasks feel so differently administered even
after resolving Section 5." BPMN/DMN are maximally open-ended as *engines* — but ntrloc's actual
*usage* of them isn't open-ended at all. Every process/decision in this system already plays one of
a small number of recognizable roles, and the authorization question only felt hard because it kept
being asked at the wrong level of generality ("how should *a process* be authorized," as if
"process" were one undifferentiated thing).

**Roles identified so far:**

1. **State-entry/exit-triggered process** (`entry_process_id`/`exit_process_id` on `schema_state`).
   Invoked by the state-machine engine itself when a state is entered/left. No human ever chooses to
   start it directly — the triggering transition's own `transition:execute` check already gates
   whether it fires. "Who's allowed to start this" isn't a meaningful question for this role; it's
   plumbing, not a user-facing surface.
2. **Transition-triggered process** (`schema_state_transition.process_id` — a distinct binding from
   #1, on the edge rather than the node). Same engine-invoked shape as #1, gated by the same
   `transition:execute` check on the transition that fires it. The one member of this
   "engine-triggered" family that could plausibly contain a genuine user task, since it happens as
   the consequence of a specific, permission-checked human action. **Open question, not yet
   answered**: should such a task's candidate pool default to "whoever already holds
   `transition:execute` for that transition" (item's marker × principal's grant), or are there cases
   where the human step inside should go to a different, narrower population than whoever could fire
   the transition itself (e.g., anyone can request it, only a supervisor completes it)?
3. **State-entry marker decision** (`entry_marker_decision_key`) and **marker-assignment-rule
   decision** (`decision_key` on `authorization_marker_rule`). DMN, engine-invoked on the state/
   mutation engine's own schedule, never a direct user action. Same "no independent authorization
   surface" reasoning as #1.
4. **Manually-initiated business process.** A human deliberately starts it (the "read 3 fields,
   update a 4th" / ad hoc approval-flow case). This is the one role where "who's allowed to start
   this" is a real, open question — where Section 3's `process-definition:start` direct grant
   belongs — and, per Section 5's resolution, the one role that legitimately hosts staffing/
   candidacy for its own user tasks on Flowable's native model, because this role is honestly about
   staffing and was never pretending to be an access-control surface.
5. **Un-anchored batch/report process** (no item at all — "run a projection, generate a report,
   email it"). Human/admin-initiated but with no natural item to anchor to; probably wants a
   narrower default population than #4 (e.g. superuser-only) rather than inventing a new
   authorization concept.

**Payoff**: task candidacy doesn't need a universal story because most roles never touch a human
task at all (#1/#2/#3 are machinery). Only #4 (and #2's edge case) genuinely needs staffing, and
there `process_group`-style direct assignment isn't a compromise forced by giving up on
consistency — it's simply correct for what that role actually is. The discomfort wasn't "markers
vs. candidates"; it was the absence of names for the different jobs a process can do here. Once
named, each role's authorization answer stops fighting the others.

---

## Open Threads (carry forward)

- Reconcile Section 3's `process-definition:start` direct-grant proposal against
  `ntrloc-workflow-summary.md` Section 4's existing "marker-gated, admin-only" decision for the same
  gate — pick one shape.
- Section 2's `item:read` precondition on task listing/claiming — design and build (query-time
  filter in `TaskAdminController.listTasks`, mirroring its existing group-name filtering; decide
  whether claim/complete also needs a hard check or whether listing-time filtering is sufficient).
- Confirm the write-side "already safe via the checked mutation path" claim holds for BPMN task
  completions specifically, including task actions that are a decision with no direct property
  mutation (approve/reject) rather than a property write.
- Role #2's open question: does a transition-triggered task's candidate pool always default to
  `transition:execute` holders, or does it sometimes need its own narrower population?
- Confirm whether any other process/decision invocation points exist beyond the five roles listed
  in Section 6 (e.g. message/signal-triggered processes from `ntrloc-workflow-summary.md` Section 4
  — likely fold into role #5's "no item" shape, or need their own role; not yet checked against this
  document's taxonomy).
