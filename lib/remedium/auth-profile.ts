'use client'

/**
 * useAuthProfile
 *
 * Watches the Firebase Auth current user and their Firestore /users/{uid}
 * document. Returns the live profile so all components can read the real
 * authenticated identity instead of hardcoded constants.
 *
 * Shape of /users/{uid}:
 *   uid, email, name, org, role, providerId, pharmacyId, createdAt, updatedAt
 */

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { ROLE_META } from './roles'
import type { Role } from './types'

export interface AuthProfile {
  uid: string | null
  email: string | null
  /** Authenticated user's display name (from Firestore doc, then Firebase Auth, then role fallback) */
  name: string
  /** Organisation name (practice or pharmacy) */
  org: string
  role: Role
  /** The providerId stored at account creation — e.g. "dr-sarah-williams" */
  providerId: string | null
  /** The pharmacyId stored at account creation — e.g. "harbor-pharmacy-214" */
  pharmacyId: string | null
  /** True while the auth state and Firestore doc are still loading */
  loading: boolean
}

const DEFAULT_PROFILE = (role: Role): AuthProfile => ({
  uid: null,
  email: null,
  name: ROLE_META[role]?.person ?? '',
  org: ROLE_META[role]?.org ?? '',
  role,
  providerId: role === 'provider' ? 'dr-sarah-williams' : null,
  pharmacyId: role === 'pharmacy' ? 'harbor-pharmacy-214' : null,
  loading: true,
})

export function useAuthProfile(role: Role): AuthProfile {
  const [profile, setProfile] = useState<AuthProfile>(() => DEFAULT_PROFILE(role))

  useEffect(() => {
    let unsubDoc: (() => void) | null = null

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Clean up any previous Firestore listener
      if (unsubDoc) {
        unsubDoc()
        unsubDoc = null
      }

      if (!user) {
        // Not signed in — use role defaults (demo / server-render path)
        setProfile({ ...DEFAULT_PROFILE(role), loading: false })
        return
      }

      // Subscribe to the user's Firestore document
      const userRef = doc(db, 'users', user.uid)
      unsubDoc = onSnapshot(
        userRef,
        (snap) => {
          if (!snap.exists()) {
            // Doc not written yet (edge case: auth succeeded but setDoc hasn't committed)
            setProfile({
              uid: user.uid,
              email: user.email,
              name: user.displayName ?? ROLE_META[role]?.person ?? '',
              org: ROLE_META[role]?.org ?? '',
              role,
              providerId: role === 'provider' ? 'dr-sarah-williams' : null,
              pharmacyId: role === 'pharmacy' ? 'harbor-pharmacy-214' : null,
              loading: false,
            })
            return
          }

          const data = snap.data()
          const resolvedRole: Role = (data.role as Role) ?? role

          setProfile({
            uid: user.uid,
            email: user.email ?? data.email ?? null,
            // Prefer Firestore name, then Firebase Auth displayName, then role default
            name:
              data.name ||
              user.displayName ||
              ROLE_META[resolvedRole]?.person ||
              '',
            org: data.org || ROLE_META[resolvedRole]?.org || '',
            role: resolvedRole,
            providerId: data.providerId ?? null,
            pharmacyId: data.pharmacyId ?? null,
            loading: false,
          })
        },
        (err) => {
          console.error('useAuthProfile snapshot error:', err)
          setProfile((prev) => ({ ...prev, loading: false }))
        },
      )
    })

    return () => {
      unsubAuth()
      if (unsubDoc) unsubDoc()
    }
  }, [role])

  return profile
}

/**
 * Derives a stable providerId slug from a provider's display name.
 * "Dr. Sarah Williams" → "dr-sarah-williams"
 */
export function nameToProviderId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * Derives a stable pharmacyId slug from a pharmacy's organisation name.
 * "Harbor Pharmacy #214" → "harbor-pharmacy-214"
 */
export function nameToPharmacyId(org: string): string {
  return org
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
