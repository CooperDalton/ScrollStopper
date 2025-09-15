// Client-side toast helpers
// Note: Only use in Client Components or event handlers.
'use client';

import toast from 'react-hot-toast';

export { toast };

export const toastSuccess = (message: string) => toast.success(message);
export const toastError = (message: string) => toast.error(message);
export const toastInfo = (message: string) => toast(message);

export const toastPromise = <T,>(p: Promise<T>, messages: { loading: string; success: string | ((t: T) => string); error: string | ((e: unknown) => string) }) => {
  return toast.promise(p, {
    loading: messages.loading,
    success: (val) => (typeof messages.success === 'function' ? messages.success(val) : messages.success),
    error: (err) => (typeof messages.error === 'function' ? messages.error(err) : messages.error),
  });
};

