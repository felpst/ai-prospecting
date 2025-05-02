import React from 'react';
import './Skeleton.css';

type SkeletonVariant = 'text' | 'title' | 'avatar' | 'card' | 'button' | 'image' | 'circle';
type SkeletonWidth = 'short' | 'medium' | 'long' | 'full';
type SkeletonSize = 'small' | 'medium' | 'large';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: SkeletonWidth | number;
  height?: number;
  size?: SkeletonSize;
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Skeleton Component
 * 
 * Displays a placeholder loading animation for content.
 * 
 * @param variant - Type of content being loaded
 * @param width - Width of the skeleton (preset or custom)
 * @param height - Custom height of the skeleton
 * @param size - Size variant for preset skeletons
 * @param count - Number of skeletons to display
 * @param className - Additional CSS class names
 * @param style - Additional inline styles
 */
const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  size,
  count = 1,
  className = '',
  style = {}
}) => {
  // Determine width class based on width prop
  let widthClass = '';
  if (typeof width === 'string') {
    widthClass = width;
  }
  
  // Build class names
  const skeletonClass = [
    'skeleton',
    variant,
    widthClass,
    size,
    className
  ].filter(Boolean).join(' ');
  
  // Combine passed style with width/height if provided as numbers
  const combinedStyle: React.CSSProperties = {
    ...(typeof width === 'number' ? { width: `${width}px` } : {}),
    ...(height ? { height: `${height}px` } : {}),
    ...style
  };
  
  // Render multiple skeletons if count > 1
  if (count > 1) {
    return (
      <div className="skeleton-container">
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={skeletonClass}
            style={combinedStyle}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }
  
  // Render a single skeleton
  return (
    <div
      className={skeletonClass}
      style={combinedStyle}
      aria-hidden="true"
    />
  );
};

/**
 * SkeletonCard Component
 * 
 * A preset skeleton layout for card-like content.
 */
export const SkeletonCard: React.FC = () => (
  <div className="skeleton-container card">
    <div className="skeleton-row">
      <div className="skeleton avatar" />
      <div style={{ flex: 1 }}>
        <div className="skeleton title" />
        <div className="skeleton text short" />
      </div>
    </div>
    <div className="skeleton text" />
    <div className="skeleton text medium" />
    <div className="skeleton text short" />
  </div>
);

export default Skeleton; 