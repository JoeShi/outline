import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import styled from "styled-components";
import { s } from "@shared/styles";
import type { Citation } from "@shared/types/smartQA";
import NudeButton from "~/components/NudeButton";
import useStores from "~/hooks/useStores";
import SmartQAInput from "./SmartQAInput";
import SmartQAMessageItem from "./SmartQAMessageItem";

function SmartQAPanel() {
  const { t } = useTranslation();
  const { smartQA } = useStores();
  const history = useHistory();
  const messageListRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [smartQA.messages.length, smartQA.isLoading]);

  if (!smartQA.isPanelOpen) {
    return null;
  }

  const handleClose = () => {
    smartQA.closePanel();
  };

  const handleNewConversation = () => {
    smartQA.newConversation();
  };

  const handleSubmit = (text: string) => {
    void smartQA.submitQuestion(text);
  };

  const handleRetry = () => {
    smartQA.retry();
  };

  const handleCitationClick = (citation: Citation) => {
    history.push(citation.url);
    smartQA.closePanel();
  };

  return (
    <PanelWrapper>
      <PanelHeader>
        <HeaderTitle>{t("Smart QA")}</HeaderTitle>
        <HeaderActions>
          <NewConversationButton onClick={handleNewConversation}>
            {t("New conversation")}
          </NewConversationButton>
          <CloseButton onClick={handleClose} aria-label={t("Close")}>
            &times;
          </CloseButton>
        </HeaderActions>
      </PanelHeader>

      <MessageList ref={messageListRef}>
        {smartQA.messages.length === 0 && (
          <EmptyState>
            {t("Ask a question about your knowledge base")}
          </EmptyState>
        )}
        {smartQA.messages.map((message) => (
          <SmartQAMessageItem
            key={message.id}
            message={message}
            onCitationClick={handleCitationClick}
            onRetry={handleRetry}
          />
        ))}
        {smartQA.isLoading && (
          <LoadingIndicator>
            <LoadingDot style={{ animationDelay: "0ms" }} />
            <LoadingDot style={{ animationDelay: "200ms" }} />
            <LoadingDot style={{ animationDelay: "400ms" }} />
          </LoadingIndicator>
        )}
        {smartQA.error && (
          <ErrorMessage>
            <ErrorText>{smartQA.error.message}</ErrorText>
            {smartQA.canRetry && (
              <RetryButton onClick={handleRetry}>
                {t("Retry")}
              </RetryButton>
            )}
            {!smartQA.canRetry && smartQA.error.retryable && (
              <ErrorHint>{t("Maximum retries reached. Please try again later.")}</ErrorHint>
            )}
          </ErrorMessage>
        )}
      </MessageList>

      <SmartQAInput
        onSubmit={handleSubmit}
        disabled={!smartQA.canSubmit}
        maxLength={2000}
        preservedValue={smartQA.preservedInput}
      />
    </PanelWrapper>
  );
}

const PanelWrapper = styled.div`
  position: fixed;
  bottom: 60px;
  right: 20px;
  width: min(30vw, 400px);
  min-width: 320px;
  height: min(60vh, 600px);
  min-height: 400px;
  display: flex;
  flex-direction: column;
  background: ${s("background")};
  border: 1px solid ${s("divider")};
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid ${s("divider")};
  flex-shrink: 0;
`;

const HeaderTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${s("text")};
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const NewConversationButton = styled.button`
  background: none;
  border: 1px solid ${s("divider")};
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: ${s("textTertiary")};
  cursor: pointer;

  &:hover {
    background: ${s("backgroundSecondary")};
    color: ${s("text")};
  }
`;

const CloseButton = styled(NudeButton)`
  font-size: 18px;
  color: ${s("textTertiary")};

  &:hover {
    color: ${s("text")};
  }
`;

const MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${s("textTertiary")};
  font-size: 14px;
  text-align: center;
`;

const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  align-self: flex-start;
`;

const LoadingDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${s("textTertiary")};
  animation: bounce 1.4s infinite ease-in-out;

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0.6);
      opacity: 0.4;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;

const ErrorMessage = styled.div`
  padding: 8px 12px;
  background: ${s("danger")}11;
  border: 1px solid ${s("danger")}33;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ErrorText = styled.span`
  font-size: 13px;
  color: ${s("danger")};
`;

const RetryButton = styled.button`
  align-self: flex-start;
  background: none;
  border: 1px solid ${s("danger")}66;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  color: ${s("danger")};
  cursor: pointer;

  &:hover {
    background: ${s("danger")}11;
  }
`;

const ErrorHint = styled.span`
  font-size: 12px;
  color: ${s("textTertiary")};
`;

export default observer(SmartQAPanel);
