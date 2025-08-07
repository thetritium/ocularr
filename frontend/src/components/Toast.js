import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const types = {
    success: {
      bg: 'bg-green-600',
      icon: '✓',
    },
    error: {
      bg: 'bg-red-600',
      icon: '✕',
    },
    info: {
      bg: 'bg-blue-600',
      icon: 'ℹ',
    },
    warning: {
      bg: 'bg-yellow-600',
      icon: '⚠',
    },
  };

  const config = types[type] || types.info;

  return (
    <div
      className={`fixed top-20 right-4 z-50 transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${config.bg} text-white px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-[300px]`}>
        <span className="text-2xl">{config.icon}</span>
        <p className="flex-1">{message}</p>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="ml-4 hover:opacity-75 transition-opacity"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// Toast Container and Manager
let toastContainer = null;
const toasts = new Map();

const ensureContainer = () => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
};

const showToast = (message, type = 'info', duration = 3000) => {
  const container = ensureContainer();
  const id = Date.now();
  
  const toastElement = document.createElement('div');
  container.appendChild(toastElement);
  
  const removeToast = () => {
    ReactDOM.unmountComponentAtNode(toastElement);
    container.removeChild(toastElement);
    toasts.delete(id);
  };
  
  ReactDOM.render(
    <Toast
      message={message}
      type={type}
      duration={duration}
      onClose={removeToast}
    />,
    toastElement
  );
  
  toasts.set(id, removeToast);
};

// Export convenience methods
export const toast = {
  success: (message, duration) => showToast(message, 'success', duration),
  error: (message, duration) => showToast(message, 'error', duration),
  info: (message, duration) => showToast(message, 'info', duration),
  warning: (message, duration) => showToast(message, 'warning', duration),
};

export default Toast;