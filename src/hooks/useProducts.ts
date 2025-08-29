import useSWR, { mutate } from 'swr'
import { useMemo } from 'react'
import { Product, CreateProductData, UpdateProductData, createProduct, updateProduct, deleteProduct } from '@/lib/products'

// Stable empty array to prevent unnecessary re-renders
const EMPTY_PRODUCTS: Product[] = []

// Fetcher function for SWR
const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to fetch products`)
  }
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json()
  }
  throw new Error(`Expected JSON response but got ${contentType || 'unknown content type'}`)
}

// SWR key for products
const PRODUCTS_KEY = '/api/products'

export function useProducts() {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    PRODUCTS_KEY,
    fetcher,
    {
      revalidateOnFocus: false, // Don't refetch when window gains focus
      revalidateOnReconnect: true, // Refetch when reconnecting
      dedupingInterval: 60000, // Dedupe requests within 1 minute
    }
  )

  // Use a stable empty array reference to prevent unnecessary re-renders  
  const products = useMemo(() => {
    return data?.products || EMPTY_PRODUCTS;
  }, [data?.products]);
  
  const isError = !!error

  // Add a product (optimistic update)
  const addProduct = async (productData: CreateProductData) => {
    try {
      // Optimistic update
      const optimisticProduct: Product = {
        id: `temp-${Date.now()}`,
        name: productData.name,
        description: productData.description,
        user_id: 'temp',
        created_at: new Date().toISOString(),
      }

      // Update cache optimistically
      await mutate(
        PRODUCTS_KEY,
        { products: [optimisticProduct, ...products] },
        false // Don't revalidate immediately
      )

      // Make actual API call
      const { product, error } = await createProduct(productData)
      
      if (error) {
        // Revert optimistic update on error
        await mutate(PRODUCTS_KEY)
        throw error
      }

      // Update cache with real data
      await mutate(
        PRODUCTS_KEY,
        { products: [product, ...products.filter((p: Product) => p.id !== optimisticProduct.id)] },
        false
      )

      return { product, error: null }
    } catch (error) {
      // Revert on error
      await mutate(PRODUCTS_KEY)
      return { product: null, error: error as Error }
    }
  }

  // Update a product (optimistic update)
  const updateProductOptimistic = async (id: string, productData: UpdateProductData) => {
    try {
      // Find the product to update
      const productIndex = products.findIndex((p: Product) => p.id === id)
      if (productIndex === -1) throw new Error('Product not found')

      const originalProduct = products[productIndex]
      const optimisticProduct = { ...originalProduct, ...productData }

      // Update cache optimistically
      const updatedProducts = [...products]
      updatedProducts[productIndex] = optimisticProduct

      await mutate(
        PRODUCTS_KEY,
        { products: updatedProducts },
        false
      )

      // Make actual API call
      const { product, error } = await updateProduct(id, productData)
      
      if (error) {
        // Revert optimistic update on error
        await mutate(PRODUCTS_KEY)
        throw error
      }

      // Update cache with real data
      const finalProducts = [...products]
      finalProducts[productIndex] = product
      
      await mutate(
        PRODUCTS_KEY,
        { products: finalProducts },
        false
      )

      return { product, error: null }
    } catch (error) {
      // Revert on error
      await mutate(PRODUCTS_KEY)
      return { product: null, error: error as Error }
    }
  }

  // Delete a product (optimistic update)
  const deleteProductOptimistic = async (id: string) => {
    try {
      // Optimistic update
      const filteredProducts = products.filter((p: Product) => p.id !== id)
      
      await mutate(
        PRODUCTS_KEY,
        { products: filteredProducts },
        false
      )

      // Make actual API call
      const { error } = await deleteProduct(id)
      
      if (error) {
        // Revert optimistic update on error
        await mutate(PRODUCTS_KEY)
        throw error
      }

      return { error: null }
    } catch (error) {
      // Revert on error
      await mutate(PRODUCTS_KEY)
      return { error: error as Error }
    }
  }

  // Refresh products from server
  const refreshProducts = () => mutate(PRODUCTS_KEY)

  return {
    products,
    isLoading,
    isError,
    error,
    addProduct,
    updateProduct: updateProductOptimistic,
    deleteProduct: deleteProductOptimistic,
    refreshProducts,
  }
} 