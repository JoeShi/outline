import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import styled from "styled-components";
import { s } from "@shared/styles";
import useStores from "~/hooks/useStores";
import type { Citation } from "@shared/types/smartQA";

interface SmartQACitationListProps {
  citations: Citation[];
}

/** Max characters for a citation title before truncation */
const MAX_TITLE_LENGTH = 80;

/** Max citations to display */
const MAX_CITATIONS = 10;

/**
 * Truncate a title to the given max length with ellipsis.
 */
function truncateTitle(title: string, maxLength: number = MAX_TITLE_LENGTH): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength) + "...";
}

/**
 * Deduplicate citations by document ID, preserving first occurrence order.
 */
function deduplicateCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const result: Citation[] = [];
  for (const citation of citations) {
    if (!seen.has(citation.id)) {
      seen.add(citation.id);
      result.push(citation);
    }
  }
  return result;
}

function SmartQACitationList({ citations }: SmartQACitationListProps) {
  const { t } = useTranslation();
  const { smartQA } = useStores();
  const history = useHistory();

  if (!citations || citations.length === 0) {
    return null;
  }

  // Deduplicate and limit
  const uniqueCitations = deduplicateCitations(citations).slice(0, MAX_CITATIONS);

  const handleCitationClick = (citation: Citation, e: React.MouseEvent) => {
    e.preventDefault();
    // Navigate to the document path and close the panel
    history.push(citation.url);
    smartQA.closePanel();
  };

  return (
    <CitationWrapper>
      <CitationLabel>{t("Sources")}</CitationLabel>
      <CitationList>
        {uniqueCitations.map((citation, index) => (
          <CitationItem key={citation.id}>
            <CitationNumber>{index + 1}.</CitationNumber>
            <CitationLink
              href={citation.url}
              onClick={(e) => handleCitationClick(citation, e)}
              title={citation.title}
            >
              {truncateTitle(citation.title)}
            </CitationLink>
          </CitationItem>
        ))}
      </CitationList>
    </CitationWrapper>
  );
}

const CitationWrapper = styled.div`
  padding: 8px 12px;
  background: ${s("backgroundSecondary")};
  border-radius: 6px;
  margin-top: 4px;
  max-width: 85%;
`;

const CitationLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${s("textTertiary")};
  margin-bottom: 4px;
`;

const CitationList = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const CitationItem = styled.li`
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 2px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const CitationNumber = styled.span`
  font-size: 12px;
  color: ${s("textTertiary")};
  flex-shrink: 0;
`;

const CitationLink = styled.a`
  font-size: 12px;
  color: ${s("accent")};
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
`;

export default observer(SmartQACitationList);
