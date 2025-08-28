import { useState, useMemo } from 'react';

export function useFilters(data: any) {
  const [filters, setFilters] = useState({
    department: 'all',
    employee: 'all',
    status: 'all',
    type: 'all'
  });

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      department: 'all',
      employee: 'all', 
      status: 'all',
      type: 'all'
    });
  };

  const filteredData = useMemo(() => {
    if (!data) return [];
    
    // For now, just return all data
    // TODO: Implement actual filtering logic
    return data.transactions || [];
  }, [data, filters]);

  return {
    filteredData,
    filters,
    updateFilter,
    clearAllFilters
  };
}
