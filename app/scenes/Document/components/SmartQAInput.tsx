import { observer } from "mobx-react";
import { ArrowIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import NudeButton from "~/components/NudeButton";

interface SmartQAInputProps {
  onSubmit: (text: string) => void;
  disabled: boolean;
  maxLength: number;
  preservedValue?: string;
}

function SmartQAInput({ onSubmit, disabled, maxLength, preservedValue }: SmartQAInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Restore preserved value on error
  React.useEffect(() => {
    if (preservedValue) {
      setValue(preservedValue);
    }
  }, [preservedValue]);

  const trimmedValue = value.trim();
  const canSend = !disabled && trimmedValue.length > 0;
  const isNearLimit = value.length > 1800;

  const handleSubmit = () => {
    if (!canSend) {
      return;
    }
    onSubmit(trimmedValue);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      setValue(newValue);
    }
  };

  return (
    <InputWrapper>
      <TextareaWrapper>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t("Ask a question...")}
          disabled={disabled}
          rows={1}
          aria-label={t("Question input")}
        />
        <SendButton
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label={t("Send")}
        >
          <ArrowIcon />
        </SendButton>
      </TextareaWrapper>
      {isNearLimit && (
        <CharCount $exceeded={value.length >= maxLength}>
          {value.length}/{maxLength}
        </CharCount>
      )}
    </InputWrapper>
  );
}

const InputWrapper = styled.div`
  padding: 12px 16px;
  border-top: 1px solid ${s("divider")};
  flex-shrink: 0;
`;

const TextareaWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: ${s("backgroundSecondary")};
  border: 1px solid ${s("divider")};
  border-radius: 6px;
  padding: 8px 12px;

  &:focus-within {
    border-color: ${s("accent")};
  }
`;

const Textarea = styled.textarea`
  flex: 1;
  border: none;
  background: transparent;
  resize: none;
  outline: none;
  font-size: 14px;
  line-height: 1.4;
  color: ${s("text")};
  font-family: inherit;
  max-height: 120px;
  min-height: 20px;

  &::placeholder {
    color: ${s("textTertiary")};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const SendButton = styled(NudeButton)`
  color: ${s("accent")};
  flex-shrink: 0;

  &:disabled {
    color: ${s("textTertiary")};
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const CharCount = styled.div<{ $exceeded: boolean }>`
  font-size: 11px;
  color: ${(props) => (props.$exceeded ? s("danger")(props) : s("textTertiary")(props))};
  text-align: right;
  margin-top: 4px;
`;

export default observer(SmartQAInput);
