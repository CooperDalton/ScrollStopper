'use client'

import React, { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePublicCollections } from '@/hooks/usePublicCollections'
import { usePublicImages } from '@/hooks/usePublicImages'
import { getPublicImageUrlFromPath } from '@/lib/images'

export default function PublicCollectionsAdminPage() {
  const { user, loading } = useAuth()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const { collections, refresh: refreshCollections, isLoading: collectionsLoading } = usePublicCollections()
  const { images, refresh: refreshImages, isLoading: imagesLoading } = usePublicImages(selectedCollectionId)

  const isAdmin = useMemo(() => {
    if (!user) return false
    const allowedEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''
    const allowedId = process.env.NEXT_PUBLIC_ADMIN_USER_ID || ''
    return (allowedEmail && user.email === allowedEmail) || (allowedId && user.id === allowedId)
  }, [user])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/public-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Failed to create collection')
      }
      setName('')
      await refreshCollections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection')
    } finally {
      setCreating(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !selectedCollectionId) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      for (const file of Array.from(files)) {
        form.append('files', file)
      }
      const res = await fetch(`/api/admin/public-collections/${selectedCollectionId}/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const { images: created, errors } = await res.json()
      // Fire-and-forget AI processing for each created image
      if (Array.isArray(created)) {
        created.forEach((img: any) => {
          void fetch('/api/public/images/describe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageId: img.id }),
          }).catch(() => {})
        })
      }
      if (errors && errors.length > 0) {
        console.warn('Some uploads failed:', errors)
      }
      await refreshImages()
      await refreshCollections()
      e.target.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Access denied</h1>
        <p className="text-[var(--color-text-muted)] mt-2">You do not have permission to manage public collections.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Public Collections</h1>
        <p className="text-[var(--color-text-muted)]">Create and upload demo images visible to everyone.</p>
      </div>

      <form onSubmit={handleCreate} className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-4 space-y-3 max-w-xl">
        <div>
          <label className="block text-sm text-[var(--color-text)] mb-1">Collection name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text)]" placeholder="e.g., Demo Backgrounds" />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button disabled={creating || !name.trim()} className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-50">{creating ? 'Creating...' : 'Create collection'}</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-[var(--color-border)] rounded-xl p-4">
          <h2 className="font-semibold text-[var(--color-text)] mb-3">Collections</h2>
          {collectionsLoading ? (
            <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <ul className="space-y-2">
              {collections.map(c => (
                <li key={c.id}>
                  <button onClick={() => setSelectedCollectionId(c.id)} className={`w-full text-left px-3 py-2 rounded-lg border ${selectedCollectionId === c.id ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'} hover:border-[var(--color-primary)]`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[var(--color-text)] font-medium">{c.name}</div>
                      </div>
                      <div className="text-sm text-[var(--color-text-muted)]">{c.image_count || 0} images</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-[var(--color-border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[var(--color-text)]">Images</h2>
            <label className={`px-3 py-2 rounded-lg border ${!selectedCollectionId || uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--color-primary)]'}`}>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} multiple disabled={!selectedCollectionId || uploading} />
              {uploading ? 'Uploading...' : 'Upload image(s)'}
            </label>
          </div>
          {imagesLoading ? (
            <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          ) : selectedCollectionId ? (
            images.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {images.map(img => (
                  <div key={img.id} className="aspect-[9/16] overflow-hidden rounded-lg border border-[var(--color-border)]">
                    <img src={getPublicImageUrlFromPath(img.storage_path)} alt="public" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[var(--color-text-muted)]">No images yet.</div>
            )
          ) : (
            <div className="text-[var(--color-text-muted)]">Select a collection.</div>
          )}
        </div>
      </div>
    </div>
  )
}


