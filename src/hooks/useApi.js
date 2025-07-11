import { useQuery, useMutation } from '@tanstack/react-query';
import apiService from '../api';
import { queryKeys, invalidateQueries, queryOptions } from '../utils/queryClient';

/**
 * Custom hooks for API calls with React Query integration
 * Provides caching, background updates, and optimistic updates
 */

// File management hooks
export const useFiles = () => {
    return useQuery({
        queryKey: queryKeys.files,
        queryFn: apiService.getFiles,
        ...queryOptions.frequent,
    });
};

export const useFile = (fileId) => {
    return useQuery({
        queryKey: queryKeys.file(fileId),
        queryFn: () => apiService.getFile(fileId),
        enabled: !!fileId,
        ...queryOptions.static,
    });
};

export const useUploadFile = () => {
    return useMutation({
        mutationFn: apiService.uploadFile,
        onSuccess: () => {
            // Invalidate files list to show new file
            invalidateQueries.allFiles();
        },
    });
};

export const useDeleteFile = () => {
    return useMutation({
        mutationFn: apiService.deleteFile,
        onSuccess: () => {
            // Invalidate files list after deletion
            invalidateQueries.allFiles();
        },
    });
};

// Annotation management hooks
export const useAnnotations = (fileId) => {
    return useQuery({
        queryKey: queryKeys.annotations(fileId),
        queryFn: () => apiService.getAnnotations(fileId),
        enabled: !!fileId,
        ...queryOptions.frequent,
    });
};

export const useCreateAnnotation = () => {
    return useMutation({
        mutationFn: ({ fileId, annotation }) => apiService.createAnnotation(fileId, annotation),
        onSuccess: (data, variables) => {
            // Invalidate annotations for the file
            invalidateQueries.fileAnnotations(variables.fileId);
            // Also invalidate study cards as they depend on annotations
            invalidateQueries.allStudyCards();
        },
    });
};

export const useUpdateAnnotation = () => {
    return useMutation({
        mutationFn: ({ annotationId, annotationData }) => 
            apiService.updateAnnotation(annotationId, annotationData),
        onSuccess: (data, variables) => {
            // Invalidate all annotations queries since we don't know which file it belongs to
            // In a real app, you might want to pass fileId to be more specific
            invalidateQueries.allFiles();
        },
    });
};

export const useDeleteAnnotation = () => {
    return useMutation({
        mutationFn: apiService.deleteAnnotation,
        onSuccess: () => {
            // Invalidate all annotations and study cards
            invalidateQueries.allFiles();
            invalidateQueries.allStudyCards();
        },
    });
};

// Study card management hooks
export const useStudyCards = (skip = 0, limit = 100) => {
    return useQuery({
        queryKey: [...queryKeys.studyCards, skip, limit],
        queryFn: () => apiService.getStudyCards(skip, limit),
        ...queryOptions.frequent,
    });
};

export const useStudyCard = (cardId) => {
    return useQuery({
        queryKey: queryKeys.studyCard(cardId),
        queryFn: () => apiService.getStudyCard(cardId),
        enabled: !!cardId,
        ...queryOptions.static,
    });
};

export const useDueCards = (limit = 50) => {
    return useQuery({
        queryKey: queryKeys.dueCards(limit),
        queryFn: () => apiService.getDueCards(limit),
        ...queryOptions.realtime, // Always fresh for study sessions
    });
};

export const useCreateStudyCard = () => {
    return useMutation({
        mutationFn: apiService.createStudyCard,
        onSuccess: () => {
            invalidateQueries.allStudyCards();
            invalidateQueries.dueCards();
        },
    });
};

export const useReviewCard = () => {
    return useMutation({
        mutationFn: ({ cardId, reviewData }) => apiService.reviewCard(cardId, reviewData),
        onSuccess: () => {
            // Invalidate study cards and due cards after review
            invalidateQueries.allStudyCards();
            invalidateQueries.dueCards();
            invalidateQueries.studyStats();
        },
    });
};

export const useDeleteStudyCard = () => {
    return useMutation({
        mutationFn: apiService.deleteStudyCard,
        onSuccess: () => {
            invalidateQueries.allStudyCards();
            invalidateQueries.dueCards();
        },
    });
};

// Study card timeline and progression hooks
export const useCardTimeline = (cardId) => {
    return useQuery({
        queryKey: queryKeys.cardTimeline(cardId),
        queryFn: () => apiService.getCardTimeline(cardId),
        enabled: !!cardId,
        ...queryOptions.background,
    });
};

export const useCardProgression = (cardId, steps = 4) => {
    return useQuery({
        queryKey: queryKeys.cardProgression(cardId, steps),
        queryFn: () => apiService.getCardProgression(cardId, steps),
        enabled: !!cardId,
        ...queryOptions.background,
    });
};

export const useReviewOptions = (cardId) => {
    return useQuery({
        queryKey: queryKeys.reviewOptions(cardId),
        queryFn: () => apiService.getReviewOptions(cardId),
        enabled: !!cardId,
        ...queryOptions.realtime,
    });
};

// Study statistics hooks
export const useStudyStats = () => {
    return useQuery({
        queryKey: queryKeys.studyStats,
        queryFn: apiService.getStudyStats,
        ...queryOptions.frequent,
    });
};

// Review session hooks
export const useCreateReviewSession = () => {
    return useMutation({
        mutationFn: apiService.createReviewSession,
        onSuccess: () => {
            invalidateQueries.studyStats();
        },
    });
};

export const useEndReviewSession = () => {
    return useMutation({
        mutationFn: apiService.endReviewSession,
        onSuccess: () => {
            invalidateQueries.studyStats();
        },
    });
};

// Health check hook
export const useHealthCheck = () => {
    return useQuery({
        queryKey: queryKeys.health,
        queryFn: apiService.healthCheck,
        ...queryOptions.background,
        // Don't retry health checks aggressively
        retry: 1,
        retryDelay: 5000,
    });
};