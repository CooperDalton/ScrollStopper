import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Supabase client with Service Role Key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service Role Key - never expose to client
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    // Parse the JSON body
    const { id, full_name } = await request.json()

    // Validate required fields
    if (!id || !full_name) {
      return NextResponse.json(
        { error: 'Missing required fields: id and full_name' },
        { status: 400 }
      )
    }

    // Upsert user into public.users table
    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          id,
          full_name,
          role: 'free', // Default role
          created_at: new Date().toISOString()
        },
        {
          onConflict: 'id', // Handle conflicts on the id field
          ignoreDuplicates: false // Update existing records
        }
      )
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to insert user', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'User inserted successfully',
        user: data?.[0] 
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Invalid request body or server error' },
      { status: 400 }
    )
  }
}

// Reject all non-POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
} 