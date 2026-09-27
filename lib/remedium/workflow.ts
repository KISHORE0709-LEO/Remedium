import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS } from './firestore-service'
import type { Actor, RefillStatus, WorkflowEvent } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// ALLOWED TRANSITIONS
// Each key is a fromState; the Set contains all valid toStates from it.
// ─────────────────────────────────────────────────────────────────────────────
const TRANSITIONS: Partial<Record<RefillStatus, Set<RefillStatus>>> = {
  NEW: new Set<RefillStatus>(['ANALYZING', 'CANCELLED']),
  ANALYZING: new Set<RefillStatus>([
    'NEEDS_INFORMATION',
    'WAITING_FOR_PROVIDER',
    'WAITING_FOR_INSURANCE',
    'APPROVED',
    'ESCALATED',
    'CANCELLED',
  ]),
  NEEDS_INFORMATION: new Set<RefillStatus>([
    'ANALYZING',
    'WAITING_FOR_PROVIDER',
    'ESCALATED',
    'CANCELLED',
  ]),
  WAITING_FOR_PROVIDER: new Set<RefillStatus>([
    'APPROVED',
    'WAITING_FOR_INSURANCE',
    'NEEDS_INFORMATION',
    'ESCALATED',
    'REJECTED',
    'CANCELLED',
  ]),
  WAITING_FOR_INSURANCE: new Set<RefillStatus>([
    'APPROVED',
    'WAITING_FOR_PROVIDER',
    'NEEDS_INFORMATION',
    'ESCALATED',
    'REJECTED',
    'CANCELLED',
  ]),
  APPROVED: new Set<RefillStatus>(['WAITING_FOR_PHARMACY', 'ESCALATED', 'CANCELLED']),
  WAITING_FOR_PHARMACY: new Set<RefillStatus>(['FULFILLED', 'ESCALATED', 'CANCELLED']),
  FULFILLED: new Set<RefillStatus>(['RESOLVED', 'ESCALATED']),
  ESCALATED: new Set<RefillStatus>([
    'ANALYZING',
    'WAITING_FOR_PROVIDER',
    'WAITING_FOR_INSURANCE',
    'APPROVED',
    'CANCELLED',
    'REJECTED',
  ]),
  // Terminal states — no outbound transitions
  RESOLVED: new Set<RefillStatus>([]),
  REJECTED: new Set<RefillStatus>([]),
  CANCELLED: new Set<RefillStatus>([]),

  // ── Legacy alias transitions (existing seed data / UI actions) ──
  REQUESTED: new Set<RefillStatus>(['CHECKING', 'ANALYZING', 'CANCELLED']),
  CHECKING: new Set<RefillStatus>([
    'WAITING_FOR_PROVIDER',
    'WAITING_FOR_INSURANCE',
    'APPROVED',
    'BLOCKED',
    'ANALYZING',
    'NEEDS_INFORMATION',
    'ESCALATED',
    'CANCELLED',
  ]),
  BLOCKED: new Set<RefillStatus>([
    'WAITING_FOR_PROVIDER',
    'WAITING_FOR_INSURANCE',
    'PHARMACY_PROCESSING',
    'WAITING_FOR_PHARMACY',
    'ESCALATED',
    'CANCELLED',
    'REJECTED',
  ]),
  PRESCRIPTION_SENT: new Set<RefillStatus>([
    'WAITING_FOR_INSURANCE',
    'PHARMACY_PROCESSING',
    'WAITING_FOR_PHARMACY',
  ]),
  PHARMACY_PROCESSING: new Set<RefillStatus>([
    'READY_FOR_PICKUP',
    'WAITING_FOR_PHARMACY',
    'FULFILLED',
    'ESCALATED',
  ]),
  READY_FOR_PICKUP: new Set<RefillStatus>(['COMPLETED', 'FULFILLED', 'RESOLVED']),
  COMPLETED: new Set<RefillStatus>(['RESOLVED']),
  DENIED: new Set<RefillStatus>(['REJECTED']),
}

export class WorkflowTransitionError extends Error {
  constructor(
    public readonly refillId: string,
    public readonly from: RefillStatus,
    public readonly to: RefillStatus,
  ) {
    super(`Invalid transition for ${refillId}: ${from} → ${to}`)
    this.name = 'WorkflowTransitionError'
  }
}

/**
 * Validates the transition is allowed, then atomically:
 *   1. Updates the refill document status in Firestore
 *   2. Appends an immutable WorkflowEvent record
 *
 * Throws WorkflowTransitionError if the transition is not in the allowed table.
 */
export async function transition(
  refillId: string,
  toState: RefillStatus,
  actor: Actor | 'system',
  action: string,
  patch: Record<string, unknown> = {},
  detail?: string,
): Promise<WorkflowEvent> {
  const refillRef = doc(db, COLLECTIONS.REFILLS, refillId)

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(refillRef)
    if (!snap.exists()) throw new Error(`Refill ${refillId} not found`)

    const fromState: RefillStatus = snap.data().status as RefillStatus
    const allowed = TRANSITIONS[fromState]

    if (!allowed || !allowed.has(toState)) {
      throw new WorkflowTransitionError(refillId, fromState, toState)
    }

    const evId = `wfe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const now = serverTimestamp()

    // 1. Update refill document
    tx.update(refillRef, {
      status: toState,
      updatedAt: now,
      statusSince: now,
      ...patch,
    })

    // 2. Append immutable WorkflowEvent
    const evRef = doc(db, COLLECTIONS.WORKFLOW_EVENTS, evId)
    tx.set(evRef, {
      id: evId,
      refillId,
      actor,
      action,
      previousState: fromState,
      newState: toState,
      detail: detail ?? action,
      // UI timeline fields (kept for subscribeToWorkflowEvents compatibility)
      label: action,
      tone: toneForTransition(fromState, toState),
      createdAt: now,
    })

    const event: WorkflowEvent = {
      id: evId,
      refillId,
      actor,
      action,
      previousState: fromState,
      newState: toState,
      detail,
      timestamp: Date.now(),
    }

    return event
  })
}

function toneForTransition(from: RefillStatus, to: RefillStatus): string {
  if (to === 'CANCELLED' || to === 'REJECTED' || to === 'DENIED') return 'error'
  if (to === 'ESCALATED') return 'warning'
  if (to === 'NEEDS_INFORMATION' || to === 'BLOCKED') return 'warning'
  if (to === 'RESOLVED' || to === 'FULFILLED' || to === 'COMPLETED') return 'done'
  if (to === 'APPROVED') return 'done'
  if (
    to === 'WAITING_FOR_PROVIDER' ||
    to === 'WAITING_FOR_INSURANCE' ||
    to === 'WAITING_FOR_PHARMACY'
  )
    return 'active'
  return 'info'
}

/** Read-only helper: returns allowed next states for a given status */
export function allowedTransitions(from: RefillStatus): RefillStatus[] {
  return Array.from(TRANSITIONS[from] ?? [])
}
