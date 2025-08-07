import React from 'react';

const LoadingSpinner = ({ size = 'md' }) => {
  console.log('LoadingSpinner rendered with size:', size);
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`animate-spin rounded-full border-b-2 border-blue-500 ${sizeClasses[size]}`}></div>
    </div>
  );
};

export default LoadingSpinner;