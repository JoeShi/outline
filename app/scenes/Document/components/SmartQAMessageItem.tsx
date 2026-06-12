import * as React from "react";
import { observer } from "mobx-react";
import styled, { keyframes } from "styled-components";
import markdownit from "markdown-it";
import type { QAMessage, Citation } from "@shared/types/smartQA";

interface SmartQAMessageItemProps {
  message: QAMessage;
  onCitationClick?: (citation: Citation) => void;
  onRetry?: () => void;
}

// Create a shared markdown-it instance for rendering assistant messages
const md = markdownit({
  html: false,
  linkify: true,
  typographer: false,
  breaks: true,
});

// Ensure links open safely
const defaultRender =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  tokens[idx].attrSet("target", "_blank");
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return defaultRender(tokens, idx, options, env, self);
};

/**
 * SmartQAMessageItem renders a single message in the Smart QA conversation.
 *
 * - User messages: right-aligned with accent background, plain text
 * - Assistant messages: left-aligned with neutral background, Markdown rendered
 * - Loading state: pulsing dots animation when content is empty and no error
 * - Error state: error message in red with optional retry button
 */
function SmartQAMessageItem({
  message,
  onCitationClick,
  onRetry,
}: SmartQAMessageItemProps) {
  const isUser = message.role === "user";
  const isLoading = !isUser && message.content === "" && !message.error;
  const hasError = !!message.error;

  // Render assistant message content as Markdown HTML
  const renderedHtml = React.useMemo(() => {
    if (isUser || isLoading || !message.content) {
      return "";
    }
    return md.render(message.content);
  }, [isUser, isLoading, message.content]);

  return (
    <MessageWrapper $isUser={isUser}>
      <MessageBubble $isUser={isUser} $hasError={hasError}>
        {isLoading ? (
          <LoadingDots>
            <Dot $delay="0s" />
            <Dot $delay="0.2s" />
            <Dot $delay="0.4s" />
          </LoadingDots>
        ) : hasError ? (
          <ErrorContainer>
            <ErrorText>{message.error!.message}</ErrorText>
            {message.error!.retryable && onRetry && (
              <RetryButton onClick={onRetry}>重试</RetryButton>
            )}
          </ErrorContainer>
        ) : isUser ? (
          <UserContent>{message.content}</UserContent>
        ) : (
          <AssistantContent
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </MessageBubble>

      {/* Citation list placeholder — rendered below assistant messages */}
      {!isUser &&
        message.citations &&
        message.citations.length > 0 &&
        onCitationClick && (
          <CitationContainer>
            {message.citations.map((citation, index) => (
              <CitationItem
                key={citation.id}
                onClick={() => onCitationClick(citation)}
              >
                <CitationIndex>{index + 1}.</CitationIndex>
                <CitationTitle>{citation.title}</CitationTitle>
              </CitationItem>
            ))}
          </CitationContainer>
        )}
    </MessageWrapper>
  );
}

// --- Styled Components ---

const MessageWrapper = styled.div<{ $isUser: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${(props) => (props.$isUser ? "flex-end" : "flex-start")};
  margin-bottom: 12px;
`;

const MessageBubble = styled.div<{ $isUser: boolean; $hasError: boolean }>`
  max-width: ${(props) => (props.$isUser ? "80%" : "90%")};
  padding: 8px 12px;
  border-radius: ${(props) =>
    props.$isUser ? "12px 12px 0 12px" : "12px 12px 12px 0"};
  font-size: 14px;
  line-height: 1.5;
  background: ${(props) =>
    props.$hasError
      ? "transparent"
      : props.$isUser
        ? props.theme.accent
        : props.theme.listItemHoverBackground};
  color: ${(props) =>
    props.$isUser ? props.theme.accentText : props.theme.text};
  border: ${(props) =>
    props.$hasError
      ? `1px solid ${props.theme.danger}`
      : "1px solid transparent"};
`;

const UserContent = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
`;

const AssistantContent = styled.div`
  word-break: break-word;

  /* Markdown element styles */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0.5em 0 0.25em;
    font-weight: 600;
    line-height: 1.3;
  }

  h1 {
    font-size: 1.3em;
  }
  h2 {
    font-size: 1.2em;
  }
  h3 {
    font-size: 1.1em;
  }

  p {
    margin: 0 0 0.5em;

    &:last-child {
      margin-bottom: 0;
    }
  }

  ul,
  ol {
    margin: 0.25em 0 0.5em;
    padding-left: 1.5em;
  }

  li {
    margin-bottom: 0.2em;
  }

  pre {
    margin: 0.5em 0;
    padding: 8px 12px;
    background: ${(props) => props.theme.codeBackground};
    border: 1px solid ${(props) => props.theme.codeBorder};
    border-radius: 4px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.4;
  }

  code {
    font-family: ${(props) => props.theme.fontFamilyMono};
    font-size: 0.9em;
  }

  /* Inline code (not inside pre) */
  :not(pre) > code {
    background: ${(props) => props.theme.codeBackground};
    border: 1px solid ${(props) => props.theme.codeBorder};
    border-radius: 3px;
    padding: 1px 4px;
  }

  a {
    color: ${(props) => props.theme.link};
    text-decoration: underline;

    &:hover {
      text-decoration: none;
    }
  }

  blockquote {
    margin: 0.5em 0;
    padding-left: 12px;
    border-left: 3px solid ${(props) => props.theme.quote};
    color: ${(props) => props.theme.textSecondary};
  }

  table {
    border-collapse: collapse;
    margin: 0.5em 0;
    width: 100%;
    font-size: 13px;
  }

  th,
  td {
    border: 1px solid ${(props) => props.theme.divider};
    padding: 4px 8px;
    text-align: left;
  }

  th {
    background: ${(props) => props.theme.backgroundSecondary};
    font-weight: 600;
  }
`;

// --- Loading Animation ---
const bounce = keyframes`
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
`;

const LoadingDots = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
`;

const Dot = styled.span<{ $delay: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${(props) => props.theme.textTertiary};
  animation: ${bounce} 1.2s infinite ease-in-out;
  animation-delay: ${(props) => props.$delay};
`;

// --- Error State ---
const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ErrorText = styled.span`
  color: ${(props) => props.theme.danger};
  font-size: 13px;
`;

const RetryButton = styled.button`
  align-self: flex-start;
  background: none;
  border: 1px solid ${(props) => props.theme.danger};
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: ${(props) => props.theme.danger};
  cursor: pointer;
  transition: background 150ms ease;

  &:hover {
    background: ${(props) => props.theme.danger};
    color: ${(props) => props.theme.white};
  }
`;

// --- Citations ---
const CitationContainer = styled.div`
  margin-top: 6px;
  max-width: 90%;
`;

const CitationItem = styled.div`
  display: flex;
  align-items: baseline;
  gap: 4px;
  padding: 2px 0;
  cursor: pointer;
  font-size: 12px;
  color: ${(props) => props.theme.link};

  &:hover {
    text-decoration: underline;
  }
`;

const CitationIndex = styled.span`
  color: ${(props) => props.theme.textTertiary};
  font-size: 11px;
  flex-shrink: 0;
`;

const CitationTitle = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default observer(SmartQAMessageItem);
