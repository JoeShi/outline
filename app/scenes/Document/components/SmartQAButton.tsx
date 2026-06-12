import { observer } from "mobx-react";
import { QuestionMarkIcon } from "outline-icons";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import breakpoint from "styled-components-breakpoint";
import NudeButton from "~/components/NudeButton";
import Tooltip from "~/components/Tooltip";
import useEditingFocus from "~/hooks/useEditingFocus";
import useStores from "~/hooks/useStores";

function SmartQAButton() {
  const { t } = useTranslation();
  const { smartQA } = useStores();
  const isEditingFocus = useEditingFocus();

  return (
    <Tooltip content={t("Smart QA")}>
      <Button
        onClick={() => smartQA.togglePanel()}
        $hidden={isEditingFocus}
        aria-label={t("Smart QA")}
      >
        <QuestionMarkIcon />
      </Button>
    </Tooltip>
  );
}

const Button = styled(NudeButton)<{ $hidden: boolean }>`
  display: none;
  transition: opacity 500ms ease-in-out;
  ${(props) => props.$hidden && "opacity: 0;"}

  ${breakpoint("tablet")`
    display: block;
  `};

  @media print {
    display: none;
  }
`;

export default observer(SmartQAButton);
