import { Building2, ShieldCheck, Stethoscope, User, type LucideIcon } from 'lucide-react'
import type { Role } from './types'

export interface RoleMeta {
  role: Role
  label: string
  description: string
  Icon: LucideIcon
  person: string
  org: string
  email: string
  workspace: string
}

export const AUTH_ROLES: Role[] = ['provider', 'pharmacy', 'insurance']

export const ROLE_META: Record<Role, RoleMeta> = {
  provider: {
    role: 'provider',
    label: 'Provider / Practice',
    description: 'Review refill requests, manage clinical protocols, and authorize prescriptions.',
    Icon: Stethoscope,
    person: 'Dr. Sarah Williams',
    org: 'Bayview Internal Medicine',
    email: 's.williams@bayviewmed.demo',
    workspace: 'Provider Workspace',
  },
  pharmacy: {
    role: 'pharmacy',
    label: 'Pharmacy',
    description: 'Manage refill requests, dispense medications, and resolve blockers with clinics.',
    Icon: Building2,
    person: 'Alex Rivera, PharmD',
    org: 'Harbor Pharmacy #214',
    email: 'alex.rivera@harborpharmacy.demo',
    workspace: 'Pharmacy Operations',
  },
  patient: {
    role: 'patient',
    label: 'Patient',
    description: 'External refill recipient and notification participant.',
    Icon: User,
    person: 'John Doe',
    org: 'Member · Meridian Health',
    email: 'john.doe@demo.remedium.health',
    workspace: 'Patient Refill Portal',
  },
  insurance: {
    role: 'insurance',
    label: 'Insurance / PBM',
    description: 'External payer review and prior authorization participant.',
    Icon: ShieldCheck,
    person: 'Jordan Lee',
    org: 'Meridian Health PBM',
    email: 'j.lee@meridianpbm.demo',
    workspace: 'Coverage Review',
  },
}

export function isRole(value: string): value is Role {
  return value in ROLE_META
}

export function isAuthRole(value: string): value is 'provider' | 'pharmacy' | 'insurance' {
  return value === 'provider' || value === 'pharmacy' || value === 'insurance'
}
