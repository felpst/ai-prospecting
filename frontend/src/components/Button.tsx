import React from 'react';
import './Button.css';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'error';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Button Component
 * 
 * A versatile button component with various styles and states.
 * 
 * @param variant - The visual style variant of the button
 * @param size - The size of the button
 * @param loading - Whether the button is in a loading state
 * @param fullWidth - Whether the button should take the full width of its container
 * @param iconLeft - Icon to display before the button text
 * @param iconRight - Icon to display after the button text
 * @param children - Button content (typically text)
 */
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  children,
  className,
  disabled,
  ...props
}) => {
  // Build CSS class list
  const btnClasses = [
    'btn',
    variant,
    size,
    loading ? 'loading' : '',
    fullWidth ? 'full-width' : '',
    disabled ? 'disabled' : '',
    className || ''
  ].filter(Boolean).join(' ');

  return (
    <button 
      className={btnClasses} 
      disabled={disabled || loading}
      {...props}
    >
      {iconLeft && <span className="btn-icon btn-icon-left">{iconLeft}</span>}
      <span className="btn-content">{children}</span>
      {iconRight && <span className="btn-icon btn-icon-right">{iconRight}</span>}
    </button>
  );
};

export default Button; 