'use client';

import React, { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import ProductModal from '../../components/ProductModal';
import { Product } from '@/lib/products';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';

// Icons
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const ProductCard: React.FC<{ product: Product; onEdit: () => void }> = ({ product, onEdit }) => {
  return (
    <div 
      className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 hover:border-[var(--color-primary)] transition-colors cursor-pointer group"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
          {product.name}
        </h3>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-primary)] p-1"
        >
          <EditIcon />
        </button>
      </div>
      
      <p className="text-[var(--color-text-muted)] text-sm line-clamp-3">
        {product.description}
      </p>
    </div>
  );
};

const EmptyState: React.FC<{ onAddProduct: () => void }> = ({ onAddProduct }) => (
  <div className="text-center py-12">
    <div className="w-16 h-16 bg-[var(--color-bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-4">
      <div className="w-8 h-8 text-[var(--color-text-muted)]">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
    </div>
    <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">No products yet</h3>
    <p className="text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
      Create your first product to start generating amazing content with AI. Add details about your product to help our AI understand what you're building.
    </p>
    <button
      onClick={onAddProduct}
      className="btn-gradient inline-flex items-center space-x-2"
    >
      <PlusIcon />
      <span>Add Your First Product</span>
    </button>
  </div>
);

export default function ProductsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { user } = useAuth();
  const { products, isLoading, addProduct, updateProduct, deleteProduct } = useProducts();

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleModalSuccess = () => {
    // SWR will automatically refresh the data
  };

  const handleProductDeleted = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    // SWR will automatically refresh the data
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-[var(--color-bg-secondary)] rounded w-48 mb-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-[var(--color-bg-secondary)] rounded-2xl p-6 h-48"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Products</h1>
              <p className="text-[var(--color-text-muted)]">
                Manage your product information to help AI create better content
              </p>
            </div>
            
            {products.length > 0 && (
              <button
                onClick={handleAddProduct}
                className="btn-gradient inline-flex items-center space-x-2"
              >
                <PlusIcon />
                <span>Add Product</span>
              </button>
            )}
          </div>

          {/* Content */}
          {products.length === 0 ? (
            <EmptyState onAddProduct={handleAddProduct} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product: Product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={() => handleEditProduct(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        product={selectedProduct}
        addProduct={addProduct}
        updateProduct={updateProduct}
        deleteProduct={deleteProduct}
        onProductDeleted={handleProductDeleted}
      />
    </DashboardLayout>
  );
} 