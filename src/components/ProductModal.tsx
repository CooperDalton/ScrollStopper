'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Product,
  CreateProductData,
  UpdateProductData,
  createProduct,
  updateProduct,
  ProductImage,
  getProductImages,
  uploadProductImage,
  updateProductImageDescription,
} from '@/lib/products';
import { getImageUrl } from '@/lib/images';
import { supabase } from '@/lib/supabase';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null; // If provided, we're editing; if null/undefined, we're adding
  addProduct?: (data: CreateProductData) => Promise<{ product: Product | null; error: Error | null }>;
  updateProduct?: (id: string, data: UpdateProductData) => Promise<{ product: Product | null; error: Error | null }>;
}

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSuccess, product, addProduct: swrAddProduct, updateProduct: swrUpdateProduct }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  
  const [errors, setErrors] = useState({
    name: '',
    description: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  // Existing product images (edit mode only)
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [existingDescriptions, setExistingDescriptions] = useState<Record<string, string>>({});
  const [existingImageUrls, setExistingImageUrls] = useState<Record<string, string>>({});
  // Newly added images before upload
  const [newImages, setNewImages] = useState<{ file: File; previewUrl: string; description: string }[]>([]);

  const isEditMode = !!product;

  // Reset form when modal opens/closes or product changes
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setFormData({
          name: product.name,
          description: product.description
        });
        // Load existing product images
        (async () => {
          const { images } = await getProductImages(product.id);
          setExistingImages(images);
          const map: Record<string, string> = {};
          images.forEach(img => { map[img.id] = img.user_description || ''; });
          setExistingDescriptions(map);
          // Build URL map with signed URLs (fallback-safe)
          const urls: Record<string, string> = {};
          await Promise.all(images.map(async (img) => {
            // Prefer signed URL to handle private buckets; public buckets also work
            try {
              const { data, error } = await supabase.storage
                .from('user-images')
                .createSignedUrl(img.storage_path, 60 * 60);
              if (!error && data?.signedUrl) {
                urls[img.id] = data.signedUrl;
              } else {
                // Fallback to public URL helper if signed URL fails
                urls[img.id] = getImageUrl(img.storage_path);
              }
            } catch (_) {
              urls[img.id] = getImageUrl(img.storage_path);
            }
          }));
          setExistingImageUrls(urls);
        })();
      } else {
        setFormData({
          name: '',
          description: ''
        });
        setExistingImages([]);
        setExistingDescriptions({});
        setExistingImageUrls({});
      }
      setErrors({ name: '', description: '' });
      setNewImages([]);
    }
  }, [isOpen, product]);

  // Enable escape key to close modal
  useEscapeKey(() => {
    if (!isLoading) {
      onClose();
    }
  }, isOpen);

  const validateForm = () => {
    const newErrors = { name: '', description: '' };
    let isValid = true;

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
      isValid = false;
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Product name must be at least 2 characters long';
      isValid = false;
    }

    // Validate description (minimum 50 characters)
    if (!formData.description.trim()) {
      newErrors.description = 'Product description is required';
      isValid = false;
    } else if (formData.description.trim().length < 50) {
      newErrors.description = `Description must be at least 50 characters long (currently ${formData.description.trim().length})`;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      let targetProductId: string | null = product?.id || null;

      if (isEditMode && product) {
        const updateFunction = swrUpdateProduct || updateProduct;
        const { product: updatedProduct, error } = await updateFunction(product.id, {
          name: formData.name.trim(),
          description: formData.description.trim()
        });
        if (error) {
          console.error('Error updating product:', error);
          return;
        }
        targetProductId = updatedProduct?.id || product.id;
      } else {
        const addFunction = swrAddProduct || createProduct;
        const { product: newProduct, error } = await addFunction({
          name: formData.name.trim(),
          description: formData.description.trim()
        });
        if (error || !newProduct) {
          console.error('Error creating product:', error);
          return;
        }
        targetProductId = newProduct.id;
      }

      // If we have a target product id, handle image uploads/updates
      if (targetProductId) {
        // Upload new images
        if (newImages.length > 0) {
          await Promise.all(
            newImages.map(async ({ file, description }) => {
              await uploadProductImage(file, targetProductId!, description);
            })
          );
        }

        // Update existing image descriptions if changed
        if (isEditMode && existingImages.length > 0) {
          const updates = existingImages
            .filter(img => (existingDescriptions[img.id] || '') !== (img.user_description || ''))
            .map(img => updateProductImageDescription(img.id, existingDescriptions[img.id] || ''));
          if (updates.length > 0) {
            await Promise.all(updates);
          }
        }
      }
      
      // Success
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const toAdd: { file: File; previewUrl: string; description: string }[] = [];
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const previewUrl = URL.createObjectURL(file);
      toAdd.push({ file, previewUrl, description: '' });
    });
    if (toAdd.length > 0) setNewImages(prev => [...toAdd, ...prev]);
  };

  const removeNewImageAt = (index: number) => {
    setNewImages(prev => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  const existingImagesWithUrls = useMemo(() => {
    return existingImages.map(img => ({
      ...img,
      publicUrl: existingImageUrls[img.id] || getImageUrl(img.storage_path),
    }));
  }, [existingImages, existingImageUrls]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl w-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-[var(--color-text)]">
            {isEditMode ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            disabled={isLoading}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text)] mb-2">
              Product Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 bg-[var(--color-bg)] border rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
                errors.name ? 'border-red-500' : 'border-[var(--color-border)]'
              }`}
              placeholder="Enter product name..."
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Product Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[var(--color-text)] mb-2">
              Product Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className={`w-full px-3 py-2 bg-[var(--color-bg)] border rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none ${
                errors.description ? 'border-red-500' : 'border-[var(--color-border)]'
              }`}
              placeholder="Describe your product in detail (minimum 50 characters)..."
              disabled={isLoading}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.description && (
                <p className="text-red-500 text-sm">{errors.description}</p>
              )}
              {formData.description.trim().length < 50 && (
                <p className="text-red-500 text-sm ml-auto">
                  {formData.description.trim().length}/50 characters
                </p>
              )}
            </div>
          </div>

          {/* Product Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-[var(--color-text)]">
                Product Images
              </label>
              <label className="inline-flex items-center px-3 py-1.5 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm cursor-pointer hover:bg-[var(--color-bg)]">
                Add Images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleAddFiles(e.target.files)}
                  disabled={isLoading}
                />
              </label>
            </div>

            {/* Existing images (edit mode) */}
            {isEditMode && existingImagesWithUrls.length > 0 && (
              <div className="space-y-3 mb-4">
                {existingImagesWithUrls.map(img => (
                  <div key={img.id} className="flex gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                    <img
                      src={img.publicUrl}
                      alt={img.storage_path}
                      className="w-16 h-16 object-cover rounded-md border border-[var(--color-border)]"
                    />
                    <div className="flex-1">
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Description</label>
                      <textarea
                        rows={2}
                        className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        placeholder="Describe what's in this image..."
                        value={existingDescriptions[img.id] || ''}
                        onChange={(e) => setExistingDescriptions(prev => ({ ...prev, [img.id]: e.target.value }))}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New images to upload */}
            {newImages.length > 0 && (
              <div className="space-y-3">
                {newImages.map((ni, idx) => (
                  <div key={idx} className="flex gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                    <img
                      src={ni.previewUrl}
                      alt={`new-image-${idx}`}
                      className="w-16 h-16 object-cover rounded-md border border-[var(--color-border)]"
                    />
                    <div className="flex-1">
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Description</label>
                      <textarea
                        rows={2}
                        className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        placeholder="Describe what's in this image..."
                        value={ni.description}
                        onChange={(e) => setNewImages(prev => prev.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))}
                        disabled={isLoading}
                      />
                    </div>
                    <button
                      type="button"
                      className="self-start px-2 py-1 text-sm text-red-400 hover:text-red-300"
                      onClick={() => removeNewImageAt(idx)}
                      disabled={isLoading}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : (isEditMode ? 'Update Product' : 'Add Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal; 