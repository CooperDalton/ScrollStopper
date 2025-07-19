import { NextRequest, NextResponse } from 'next/server'
import { getUserProductsServer } from '@/lib/products-server'

export async function GET() {
  try {
    const { products, error } = await getUserProductsServer()
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ products })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
} 