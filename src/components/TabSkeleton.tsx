import React from 'react';

export const TabSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 pb-36 sm:pb-40 max-w-7xl mx-auto px-4 pt-6 animate-pulse">
      {/* Hero Glass Banner Skeleton */}
      <div className="h-32 sm:h-40 rounded-3xl bg-slate-900/40 border border-white/10 backdrop-blur-xl p-6 flex flex-col justify-between">
        <div className="h-5 w-48 bg-white/10 rounded-full" />
        <div className="space-y-2">
          <div className="h-8 w-64 sm:w-80 bg-white/10 rounded-xl" />
          <div className="h-4 w-72 sm:w-96 bg-white/5 rounded-lg" />
        </div>
      </div>

      {/* Grid Stats Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-900/40 border border-white/10 backdrop-blur-xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 bg-white/10 rounded-full" />
              <div className="w-5 h-5 bg-white/10 rounded-lg" />
            </div>
            <div className="h-7 w-32 bg-white/15 rounded-lg" />
            <div className="h-3 w-28 bg-white/5 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Section Skeleton */}
      <div className="h-64 rounded-3xl bg-slate-900/40 border border-white/10 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <div className="h-6 w-40 bg-white/10 rounded-xl" />
          <div className="h-8 w-28 bg-amber-500/10 rounded-xl" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-white/5 rounded-lg" />
          <div className="h-4 w-5/6 bg-white/5 rounded-lg" />
          <div className="h-4 w-3/4 bg-white/5 rounded-lg" />
        </div>
        <div className="h-12 w-full bg-white/10 rounded-2xl" />
      </div>
    </div>
  );
};
