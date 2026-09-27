export type Role = 'patient' | 'pharmacy' | 'provider' | 'insurance'

export const ROLES: Role[] = ['patient', 'pharmacy', 'provider', 'insurance']

export type RefillStatus =
  | 'NEW'
  | 'ANALYZING'
  | 'NEEDS_INFORMATION'
  | 'WAITING_FOR_PROVIDER'
  | 'WAITING_FOR_INSURANCE'
  | 'APPROVED'
  | 'WAITING_FOR_PHARMACY'
  | 'FULFILLED'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'REJECTED'
  | 'CANCELLED'
  // Legacy aliases kept for existing UI/seed data compatibility
  | 'REQUESTED'
  | 'CHECKING'
  | 'BLOCKED'
  | 'PRESCRIPTION_SENT'
  | 'PHARMACY_PROCESSING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'DENIED'

export type BlockReason =
  | 'no_refills'
  | 'visit_required'
  | 'visit_scheduled'
  | 'pa_required'
  | 'not_covered'
  | 'missing_info'
  | 'conflict_review'
  | null

export type InsuranceState =
  | 'not_started'
  | 'pending'
  | 'pa_required'
  | 'pa_submitted'
  | 'approved'
  | 'not_covered'
  | 'cash_price'

export type EventTone = 'done' | 'warning' | 'active' | 'error' | 'info'

export type Actor = Role | 'remedium' | 'system'

export interface TimelineEvent {
  id: string
  label: string
  detail?: string
  at: number
  tone: EventTone
  actor: Actor
  previousState?: RefillStatus
  newState?: RefillStatus
  action?: string
}

export interface Medication {
  key: string
  name: string
  strength: string
  form: string
  sig: string
  quantity: number
  daysSupply: number
  refillsRemaining: number
  lastFilled: number
  requiresPA: boolean
  tier: 1 | 2 | 3
}

export interface RefillCase {
  id: string
  refillId?: string
  patientId?: string
  patient: {
    name: string
    dob: string
    mrn: string
    phone: string
    allergies: string
  }
  medication: Medication
  prescriber: string
  providerId?: string
  pharmacy: string
  pharmacyId?: string
  plan: string
  status: RefillStatus
  blocker?: string | null
  blockReason: BlockReason
  waitingFor?: string
  priority?: 'urgent' | 'standard'
  aiSummary?: string
  aiRecommendation?: string
  aiAnalysis?: AiAnalysis
  assignedTo?: string
  insurance: InsuranceState
  supplyDaysLeft: number
  urgent: boolean
  createdAt: number
  updatedAt?: number
  statusSince: number
  visitAt?: number
  denialReason?: string
  refillHistory: { date: number; quantity: number }[]
  events: TimelineEvent[]
}

export interface AiAnalysis {
  blocker: string | null
  priority: 'urgent' | 'high' | 'standard' | 'low'
  responsibleRole: Role | 'remedium' | 'none'
  nextAction: string
  summary: string
  confidence: number
  draftMessage: string
  missingFields: string[]
  analyzedAt: number
  modelVersion: string
}

export interface AppNotification {
  id: string
  role: Role
  caseId: string
  title: string
  body: string
  tone: EventTone
  at: number
  read: boolean
}

export interface WorkflowEvent {
  id: string
  refillId: string
  actor: Actor | 'system'
  action: string
  previousState: RefillStatus
  newState: RefillStatus
  detail?: string
  timestamp: number
}

export interface RemediumState {
  version: number
  origin: string
  nextCaseNumber: number
  cases: RefillCase[]
  notifications: AppNotification[]
}
