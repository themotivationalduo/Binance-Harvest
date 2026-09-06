import React, { createContext, useContext, useState, ReactNode } from 'react';
import { InitiativeFeedbackModal, InitiativeFeedbackData } from '../components/InitiativeFeedbackModal';

interface InitiativeFeedbackContextType {
  showSuccess: (options: Omit<InitiativeFeedbackData, 'type'>) => void;
  showFailed: (options: Omit<InitiativeFeedbackData, 'type'>) => void;
  showCopySuccess: (label?: string) => void;
  closeFeedback: () => void;
}

const InitiativeFeedbackContext = createContext<InitiativeFeedbackContextType | undefined>(undefined);

export const InitiativeFeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [feedback, setFeedback] = useState<InitiativeFeedbackData | null>(null);

  const showSuccess = (options: Omit<InitiativeFeedbackData, 'type'>) => {
    setFeedback({
      ...options,
      type: 'success',
      autoCloseMs: options.autoCloseMs ?? 5500,
    });
  };

  const showFailed = (options: Omit<InitiativeFeedbackData, 'type'>) => {
    setFeedback({
      ...options,
      type: 'failed',
      autoCloseMs: options.autoCloseMs ?? 0, // Failed requires explicit dismissal or user read
    });
  };

  const showCopySuccess = (label: string = 'Address') => {
    setFeedback({
      type: 'success',
      initiativeName: 'Clipboard Action',
      title: `${label} Copied!`,
      description: `The ${label.toLowerCase()} has been safely copied to your device clipboard.`,
      autoCloseMs: 2500,
    });
  };

  const closeFeedback = () => {
    setFeedback(null);
  };

  return (
    <InitiativeFeedbackContext.Provider
      value={{
        showSuccess,
        showFailed,
        showCopySuccess,
        closeFeedback,
      }}
    >
      {children}
      <InitiativeFeedbackModal feedback={feedback} onClose={closeFeedback} />
    </InitiativeFeedbackContext.Provider>
  );
};

export function useInitiativeFeedback(): InitiativeFeedbackContextType {
  const context = useContext(InitiativeFeedbackContext);
  if (!context) {
    throw new Error('useInitiativeFeedback must be used within an InitiativeFeedbackProvider');
  }
  return context;
}
