import React from 'react';
import ReactDOM from 'react-dom';

const ConfirmDialog = ({ 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  onConfirm, 
  onCancel,
  type = 'default' 
}) => {
  const types = {
    default: {
      confirmBg: 'bg-blue-600 hover:bg-blue-700',
      icon: '❓',
      iconColor: 'text-blue-500',
    },
    danger: {
      confirmBg: 'bg-red-600 hover:bg-red-700',
      icon: '⚠️',
      iconColor: 'text-red-500',
    },
    success: {
      confirmBg: 'bg-green-600 hover:bg-green-700',
      icon: '✅',
      iconColor: 'text-green-500',
    },
  };

  const config = types[type] || types.default;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75"
          onClick={onCancel}
        />

        {/* Dialog */}
        <div className="relative inline-block w-full max-w-md p-6 my-8 text-left align-middle transition-all transform bg-gray-800 shadow-xl rounded-lg animate-scaleIn">
          <div className="flex items-center mb-4">
            <span className={`text-3xl mr-3 ${config.iconColor}`}>{config.icon}</span>
            <h3 className="text-lg font-medium leading-6 text-white">
              {title}
            </h3>
          </div>
          
          <div className="mt-2">
            <p className="text-sm text-gray-300">
              {message}
            </p>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
              onClick={onCancel}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${config.confirmBg}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Confirm dialog manager
let confirmContainer = null;

const ensureContainer = () => {
  if (!confirmContainer) {
    confirmContainer = document.createElement('div');
    confirmContainer.id = 'confirm-container';
    document.body.appendChild(confirmContainer);
  }
  return confirmContainer;
};

export const confirm = ({
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'default'
}) => {
  return new Promise((resolve) => {
    const container = ensureContainer();
    
    const cleanup = () => {
      ReactDOM.unmountComponentAtNode(container);
    };

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    ReactDOM.render(
      <ConfirmDialog
        title={title}
        message={message}
        confirmText={confirmText}
        cancelText={cancelText}
        type={type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />,
      container
    );
  });
};

export default ConfirmDialog;