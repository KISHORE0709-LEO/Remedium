export type Role = 'patient' | 'pharmacy' | 'provider' | 'insurance'

export const ROLES: Role[] = ['patient', 'pharmacy', 'provider', 'insurance']

export type RefillStatus =
  | 'REQUESTED'
  | 'CHECKING'
  | 'BLOCKED'
  | 'WAITING_FOR_PROVIDER'
  | 'WAITING_FOR_INSURANCE'
  | 'APPROVED'
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

export type Actor = Role | 'remedium'

export interface TimelineEvent {
  id: string
  label: string
  detail?: string
  at: number
  tone: EventTone
  actor: Actor
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
  patient: {
    name: string
    dob: string
    mrn: string
    phone: string
    allergies: string
  }
  medication: Medication
  prescriber: string
  pharmacy: string
  plan: string
  status: RefillStatus
  blockReason: BlockReason
  insurance: InsuranceState
  supplyDaysLeft: number
  urgent: boolean
  createdAt: number
  statusSince: number
  visitAt?: number
  denialReason?: string
  refillHistory: { date: number; quantity: number }[]
  events: TimelineEvent[]
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

export interface RemediumState {
  version: number
  origin: string
  nextCaseNumber: number
  cases: RefillCase[]
  notifications: AppNotification[]
}
