import { useState, useCallback } from 'react';

/**
 * Optimistic UI hook for handling likes, comments, and other user actions
 * that should appear instant while syncing in the background
 */
export function useOptimistic<T>(initialState: T) {
    const [state, setState] = useState<T>(initialState);
    const [optimisticState, setOptimisticState] = useState<T>(initialState);
    const [isPending, setIsPending] = useState(false);

    const update = useCallback((optimisticUpdate: T, asyncAction: () => Promise<T>) => {
        // Immediately update UI optimistically
        setOptimisticState(optimisticUpdate);

        // Perform async action without startTransition for compatibility
        asyncAction()
            .then((result) => {
                setState(result);
                setOptimisticState(result);
            })
            .catch((error) => {
                // Rollback to previous state on error
                setOptimisticState(state);
                console.error('Optimistic update failed:', error);
            });
