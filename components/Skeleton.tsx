import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const baseClass = "animate-pulse bg-slate-200 dark:bg-slate-700";
  const variantClass = variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded-md h-4 w-3/4' : 'rounded-2xl';

  return (
    <div className={`${baseClass} ${variantClass} ${className}`} />
  );
};

export const StatsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="w-24 h-3" variant="text" />
          <Skeleton className="w-16 h-8" variant="text" />
        </div>
      </div>
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
  <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
    <div className="p-8 border-b dark:border-slate-700 flex justify-between">
      <Skeleton className="w-64 h-12 rounded-2xl" />
      <Skeleton className="w-32 h-12 rounded-2xl" />
    </div>
    <div className="p-8 space-y-6">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-6">
          <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-48 h-4" variant="text" />
            <Skeleton className="w-32 h-3" variant="text" />
          </div>
          <div className="hidden md:block flex-1 space-y-2">
            <Skeleton className="w-32 h-4" variant="text" />
            <Skeleton className="w-24 h-3" variant="text" />
          </div>
          <Skeleton className="w-24 h-10 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  </div>
);

export const BroadSheetSkeleton = () => (
  <div className="space-y-8">
    <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm flex gap-6">
      <Skeleton className="w-16 h-16 rounded-[1.5rem]" />
      <div className="flex-1 space-y-3">
        <Skeleton className="w-64 h-6" variant="text" />
        <Skeleton className="w-32 h-3" variant="text" />
      </div>
      <Skeleton className="w-40 h-14 rounded-2xl" />
    </div>
    <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="p-10 space-y-8">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-8">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="w-40 h-4" variant="text" />
              <Skeleton className="w-24 h-3" variant="text" />
            </div>
            <Skeleton className="w-20 h-6 rounded-xl" />
            <Skeleton className="flex-1 h-8 rounded-xl" />
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Skeleton;
