import { useState, useEffect, useCallback } from 'react';

interface TEData {
  expenses: any[];
  transactions: any[];
  spendCategories: any[];
  spendPrograms: any[];
  receipts: any[];
  memos: any[];
  lastUpdated: string;
  environment: string;
  totalTransactions: number;
  totalReimbursements: number;
  status: string;
  warnings?: string[];
}

export function useTEData() {
  const [data, setData] = useState<TEData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const cacheBuster = new Date().getTime();
      const response = await fetch(`/api/data?t=${cacheBuster}`, {
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response format');
      }
      
      setData(result);
      setRetryCount(0);
      
      // Handle warnings
      if (result.warnings && result.warnings.length > 0) {
        console.warn('API Warnings:', result.warnings);
      }
      
    } catch (err) {
      console.error('Error fetching data:', err);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out after 15 seconds');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unknown error occurred');
      }
      
      // Retry logic with exponential backoff
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchData();
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [retryCount, maxRetries]);

  const refreshData = useCallback(() => {
    setRetryCount(0);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refreshData
  };
}
