'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Spline from '@splinetool/react-spline'
import { HelpCircle, X } from 'lucide-react'

export function GlobalRobot() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  if (pathname === '/login') {
    return null
  }

  return (
    <>
      {/* The Guide Tooltip / Dialog */}
      {isOpen && (
        <div className="fixed bottom-32 right-6 z-[100] w-72 animate-fade-up rounded-2xl border border-black/10 bg-white/90 p-5 shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-black">
              <HelpCircle className="size-4 text-purple-600" />
              Remedium Guide
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-black"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-3 text-sm text-neutral-600">
            <p>
              Hi there! I'm your Remedium assistant.
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <strong className="text-black">Providers:</strong> Approve refills quickly using your dashboard.
              </li>
              <li>
                <strong className="text-black">Pharmacies:</strong> Track prescription statuses in real-time.
              </li>
            </ul>
            <p className="pt-2 text-xs text-neutral-500">
              Need more help? Contact support.
            </p>
          </div>
        </div>
      )}

      {/* The Spline Robot */}
      <div 
        className="fixed bottom-6 right-6 z-[100] size-32 cursor-pointer hover:scale-105 transition-transform"
        onClick={() => setIsOpen(!isOpen)}
        title="Click for Guide"
      >
        <div className="absolute inset-0 -z-10 rounded-full bg-purple-500/10 blur-xl"></div>
        <Spline
          scene="https://prod.spline.design/rU2-Ks0SC0T5od9B/scene.splinecode"
        />
      </div>
    </>
  )
}
