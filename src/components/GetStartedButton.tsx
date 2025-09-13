'use client'

import React from 'react'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  className?: string
  children?: React.ReactNode
}

export default function GetStartedButton({ className = '', children = 'Get Started' }: Props) {
  const { user, signInWithGoogle, loading } = useAuth()

  const handleClick = async () => {
    if (!user) {
      await signInWithGoogle(`${window.location.origin}/auth/callback?next=/api/stripe/checkout`)
      return
    }
    window.location.href = '/api/stripe/checkout'
  }

  return (
    <button onClick={handleClick} className={className} disabled={loading}>
      {children}
    </button>
  )
}
