import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignInForm } from '@/components/auth/sign-in-form'

export const metadata: Metadata = {
  title: 'Sign In & Get Started — Remedium',
  description:
    'Access the Remedium refill coordination platform for Provider Practices and Pharmacies.',
}

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="w-full">
        <SignInForm />
      </div>
    </AuthShell>
  )
}
