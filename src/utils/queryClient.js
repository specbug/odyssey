import { QueryClient } from '@tanstack/react-query';

/**
 * Configure React Query client with optimized settings for PDF annotation app
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Cache data for 5 minutes by default
            staleTime: 5 * 60 * 1000,
            // Keep data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Retry failed requests 3 times with exponential backoff
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Don't refetch on window focus for better UX
            refetchOnWindowFocus: false,
            // Enable background refetching
            refetchOnReconnect: true,
            // Network mode for offline support
            networkMode: 'offlineFirst',
        },
        mutations: {
            // Retry mutations 2 times
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
            // Network mode for offline support
            networkMode: 'offlineFirst',
        },
    },
});

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
    files: ['files'],
    file: (id) => ['files', id],
    annotations: (fileId) => ['annotations', fileId],
    annotation: (id) => ['annotations', 'single', id],
    studyCards: ['study-cards'],
    studyCard: (id) => ['study-cards', id],
    dueCards: (limit) => ['study-cards', 'due', limit],
    cardTimeline: (id) => ['study-cards', id, 'timeline'],
    cardProgression: (id, steps) => ['study-cards', id, 'progression', steps],
    reviewOptions: (id) => ['study-cards', id, 'options'],
    studyStats: ['study-stats'],
    health: ['health'],
};

/**
 * Common invalidation patterns
 */
export const invalidateQueries = {
    // Invalidate all files queries
    allFiles: () => queryClient.invalidateQueries({ queryKey: queryKeys.files }),
    
    // Invalidate specific file
    file: (id) => queryClient.invalidateQueries({ queryKey: queryKeys.file(id) }),
    
    // Invalidate annotations for a file
    fileAnnotations: (fileId) => queryClient.invalidateQueries({ queryKey: queryKeys.annotations(fileId) }),
    
    // Invalidate all study cards
    allStudyCards: () => queryClient.invalidateQueries({ queryKey: queryKeys.studyCards }),
    
    // Invalidate due cards
    dueCards: () => queryClient.invalidateQueries({ queryKey: ['study-cards', 'due'] }),
    
    // Invalidate study stats
    studyStats: () => queryClient.invalidateQueries({ queryKey: queryKeys.studyStats }),
};

/**
 * Pre-configured query options for common use cases
 */
export const queryOptions = {
    // For frequently accessed data like files list
    frequent: {
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 15 * 60 * 1000, // 15 minutes
    },
    
    // For static data that rarely changes
    static: {
        staleTime: 30 * 60 * 1000, // 30 minutes
        gcTime: 60 * 60 * 1000, // 1 hour
    },
    
    // For real-time data that should always be fresh
    realtime: {
        staleTime: 0, // Always stale
        gcTime: 5 * 60 * 1000, // 5 minutes
    },
    
    // For background data that can be stale
    background: {
        staleTime: 15 * 60 * 1000, // 15 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
    },
};