import React from 'react';

const Skeleton = ({ className = '', variant = 'text', width, height, count = 1 }) => {
  const baseClasses = 'animate-pulse bg-gray-700 rounded';
  
  const variants = {
    text: 'h-4 w-full',
    title: 'h-8 w-3/4',
    avatar: 'w-12 h-12 rounded-full',
    thumbnail: 'w-full h-32',
    card: 'w-full h-64',
    button: 'h-10 w-24',
  };

  const skeletonClass = `${baseClasses} ${variants[variant] || ''} ${className}`;
  
  const style = {
    ...(width && { width }),
    ...(height && { height }),
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={skeletonClass}
          style={style}
        />
      ))}
    </>
  );
};

export const SkeletonCard = () => (
  <div className="bg-gray-800 rounded-lg overflow-hidden">
    <Skeleton variant="thumbnail" className="h-32" />
    <div className="p-6 space-y-3">
      <Skeleton variant="title" />
      <Skeleton variant="text" count={2} />
      <div className="flex justify-between items-center pt-2">
        <Skeleton width="60px" height="20px" />
        <Skeleton width="80px" height="20px" />
      </div>
    </div>
  </div>
);

export const SkeletonProfile = () => (
  <div className="flex items-center space-x-4">
    <Skeleton variant="avatar" />
    <div className="flex-1 space-y-2">
      <Skeleton variant="title" width="150px" />
      <Skeleton variant="text" width="200px" />
    </div>
  </div>
);

export const SkeletonList = ({ count = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="bg-gray-800 rounded-lg p-4">
        <SkeletonProfile />
      </div>
    ))}
  </div>
);

export default Skeleton;