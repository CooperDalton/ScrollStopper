'use client';

import React, { useState, useEffect } from 'react';
import { Product, CreateProductData, createProduct, updateProduct } from '@/lib/products';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null; // If provided, we're editing; if null/undefined, we're adding
}

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSuccess, product }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  
  const [errors, setErrors] = useState({
    name: '',
    description: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const isEditMode = !!product;

  // Reset form when modal opens/closes or product changes
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setFormData({
          name: product.name,
          description: product.description
        });
      } else {
        setFormData({
          name: '',
          description: ''
        });
      }
      setErrors({ name: '', description: '' });
    }
  }, [isOpen, product]);

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
      if (isEditMode && product) {
        // Update existing product
        const { product: updatedProduct, error } = await updateProduct(product.id, {
          name: formData.name.trim(),
          description: formData.description.trim()
        });
        
        if (error) {
          console.error('Error updating product:', error);
          // You could show an error toast here
          return;
        }
      } else {
        // Create new product
        const { product: newProduct, error } = await createProduct({
          name: formData.name.trim(),
          description: formData.description.trim()
        });
        
        if (error) {
          console.error('Error creating product:', error);
          // You could show an error toast here
          return;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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