import { useRef, useEffect, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useEnvVarSuggest } from '../hooks/useEnvVarSuggest';
import { useEnvVarCaretSuggestStyle } from '../hooks/useEnvVarCaretSuggestStyle';
import EnvVarSuggestList from './EnvVarSuggestList';
import { isImeComposing } from '../utils/keyboard';

type CommonProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSuggestOpenChange?: (open: boolean) => void;
  suggestListId?: string;
};

type InputProps = CommonProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    as?: 'input';
  };

type TextareaProps = CommonProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
    as: 'textarea';
  };

export type EnvVarFieldProps = InputProps | TextareaProps;

function useEnvFieldSuggest(
  value: string,
  onValueChange: (value: string) => void,
  onSuggestOpenChange?: (open: boolean) => void,
) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const suggest = useEnvVarSuggest(value, onValueChange, inputRef);

  useEffect(() => {
    onSuggestOpenChange?.(suggest.isOpen);
  }, [suggest.isOpen, onSuggestOpenChange]);

  const { syncEnvSuggest } = suggest;
  useEffect(() => {
    const el = inputRef.current;
    if (!el || document.activeElement !== el) return;
    syncEnvSuggest(value, el.selectionStart ?? value.length);
  }, [value, syncEnvSuggest]);

  return { inputRef, ...suggest };
}

function EnvVarSuggestDropdown({
  inputRef,
  isOpen,
  caretIndex,
  envSuggest,
  envSuggestIndex,
  setEnvSuggestIndex,
  applyEnvSuggestion,
  suggestListId,
}: {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  isOpen: boolean;
  caretIndex: number;
  envSuggest: NonNullable<ReturnType<typeof useEnvVarSuggest>['envSuggest']>;
  envSuggestIndex: number;
  setEnvSuggestIndex: (index: number) => void;
  applyEnvSuggestion: (name: string) => void;
  suggestListId?: string;
}) {
  const floatStyle = useEnvVarCaretSuggestStyle(isOpen, inputRef, caretIndex);

  return createPortal(
    <EnvVarSuggestList
      id={suggestListId}
      suggest={envSuggest}
      activeIndex={envSuggestIndex}
      onActiveIndexChange={setEnvSuggestIndex}
      onPick={applyEnvSuggestion}
      className="env-var-suggest env-var-suggest--float"
      style={floatStyle}
    />,
    document.body,
  );
}

export function EnvVarField(props: EnvVarFieldProps) {
  if (props.as === 'textarea') {
    const {
      as: _,
      value,
      onValueChange,
      onSuggestOpenChange,
      suggestListId,
      onKeyDown,
      className,
      ...rest
    } = props;
    const { inputRef, envSuggest, envSuggestIndex, setEnvSuggestIndex, applyEnvSuggestion, handleEnvKeyDown, onChangeWithSuggest, envInputHandlers, isOpen } =
      useEnvFieldSuggest(value, onValueChange, onSuggestOpenChange);

    return (
      <div className="env-var-field">
        <textarea
          {...rest}
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className={className}
          value={value}
          onChange={onChangeWithSuggest}
          {...envInputHandlers}
          onKeyDown={(e) => {
            if (isImeComposing(e)) return;
            if (handleEnvKeyDown(e)) return;
            onKeyDown?.(e);
          }}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          autoComplete="off"
        />
        {isOpen && envSuggest && (
          <EnvVarSuggestDropdown
            inputRef={inputRef}
            isOpen={isOpen}
            caretIndex={envSuggest.innerEnd}
            envSuggest={envSuggest}
            envSuggestIndex={envSuggestIndex}
            setEnvSuggestIndex={setEnvSuggestIndex}
            applyEnvSuggestion={applyEnvSuggestion}
            suggestListId={suggestListId}
          />
        )}
      </div>
    );
  }

  const {
    as: _,
    value,
    onValueChange,
    onSuggestOpenChange,
    suggestListId,
    onKeyDown,
    className,
    ...rest
  } = props;
  const { inputRef, envSuggest, envSuggestIndex, setEnvSuggestIndex, applyEnvSuggestion, handleEnvKeyDown, onChangeWithSuggest, envInputHandlers, isOpen } =
    useEnvFieldSuggest(value, onValueChange, onSuggestOpenChange);

  return (
    <div className="env-var-field">
      <input
        {...rest}
        ref={inputRef as React.RefObject<HTMLInputElement>}
        className={className}
        value={value}
        onChange={onChangeWithSuggest}
        {...envInputHandlers}
        onKeyDown={(e) => {
          if (isImeComposing(e)) return;
          if (handleEnvKeyDown(e)) return;
          onKeyDown?.(e);
        }}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        autoComplete="off"
      />
      {isOpen && envSuggest && (
        <EnvVarSuggestDropdown
          inputRef={inputRef}
          isOpen={isOpen}
          caretIndex={envSuggest.innerEnd}
          envSuggest={envSuggest}
          envSuggestIndex={envSuggestIndex}
          setEnvSuggestIndex={setEnvSuggestIndex}
          applyEnvSuggestion={applyEnvSuggestion}
          suggestListId={suggestListId}
        />
      )}
    </div>
  );
}
