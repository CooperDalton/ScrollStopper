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
      // After auth, bounce through a server route that decides destination
      await signInWithGoogle(`${window.location.origin}/auth/callback?next=/get-started`)
      return
    }
    // For signed-in users, let the server decide based on subscription
    window.location.href = '/get-started'
  }

  return (
    <button onClick={handleClick} className={className} disabled={loading}>
      {children}
    </button>
  )
}
