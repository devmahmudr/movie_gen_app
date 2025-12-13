import { useState, useCallback } from 'react';
import { StyledAlert } from '../components/StyledAlert';

interface AlertOptions {
  title?: string;
  message: string;
  type?: 'info' | 'error' | 'warning' | 'success';
  buttonText?: string;
}

export const useAlert = () => {
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    type: 'info' | 'error' | 'warning' | 'success';
    buttonText?: string;
  }>({
    visible: false,
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertState({
      visible: true,
      title: options.title,
      message: options.message,
      type: options.type || 'info',
      buttonText: options.buttonText,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  }, []);

  const AlertComponent = () => (
    <StyledAlert
      visible={alertState.visible}
      title={alertState.title}
      message={alertState.message}
      type={alertState.type}
      buttonText={alertState.buttonText}
      onClose={hideAlert}
    />
  );

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
};

