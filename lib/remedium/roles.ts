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

export const ROLE_META: Record<Role, RoleMeta> = {
  patient: {
    role: 'patient',
    label: 'Patient',
    description: 'Track medications and refill status.',
    Icon: User,
    person: 'John Doe',
    org: 'Member · Meridian Health',
    email: 'john.doe@demo.remedium.health',
    workspace: 'Patient Workspace',
  },
  pharmacy: {
    role: 'pharmacy',
    label: 'Pharmacy',
    description: 'Manage refill requests and resolve blockers.',
    Icon: Building2,
    person: 'Alex Rivera, PharmD',
    org: 'Harbor Pharmacy #214',
    email: 'alex.rivera@harborpharmacy.demo',
    workspace: 'Pharmacy Operations',
  },
  provider: {
    role: 'provider',
    label: 'Provider',
    description: 'Review refill requests and make clinical decisions.',
    Icon: Stethoscope,
    person: 'Dr. Sarah Williams',
    org: 'Bayview Internal Medicine',
    email: 's.williams@bayviewmed.demo',
    workspace: 'Provider Workspace',
  },
  insurance: {
    role: 'insurance',
    label: 'Insurance',
    description: 'Review coverage and authorization status.',
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
