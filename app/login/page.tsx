import type { Metadata } from 'next'
import { SignInForm } from '@/components/auth/sign-in-form'
import Spline from '@splinetool/react-spline'
import { PillLink, Logo } from '@/components/remedium/primitives'

export const metadata: Metadata = {
  title: 'Sign In & Get Started — Remedium',
  description:
    'Access the Remedium refill coordination platform for Provider Practices and Pharmacies.',
}

export default function LoginPage() {
  return <SignInForm />
}
