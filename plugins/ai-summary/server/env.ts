import { IsOptional, IsString } from "class-validator";
import { Environment } from "@server/env";
import environment from "@server/utils/environment";

class AISummaryPluginEnvironment extends Environment {
  /**
   * AWS region for Amazon Bedrock API calls.
   */
  @IsOptional()
  @IsString()
  public AI_SUMMARY_BEDROCK_REGION = this.toOptionalString(
    environment.AI_SUMMARY_BEDROCK_REGION
  ) ?? "us-east-1";

  /**
   * Amazon Bedrock model ID for generating summaries.
   */
  @IsOptional()
  @IsString()
  public AI_SUMMARY_BEDROCK_MODEL_ID = this.toOptionalString(
    environment.AI_SUMMARY_BEDROCK_MODEL_ID
  ) ?? "us.anthropic.claude-sonnet-4-20250514";

  /**
   * AWS access key ID for Bedrock. Falls back to AWS_ACCESS_KEY_ID if not set.
   */
  @IsOptional()
  @IsString()
  public AI_SUMMARY_BEDROCK_ACCESS_KEY_ID = this.toOptionalString(
    environment.AI_SUMMARY_BEDROCK_ACCESS_KEY_ID ?? environment.AWS_ACCESS_KEY_ID
  );

  /**
   * AWS secret access key for Bedrock. Falls back to AWS_SECRET_ACCESS_KEY if not set.
   */
  @IsOptional()
  @IsString()
  public AI_SUMMARY_BEDROCK_SECRET_ACCESS_KEY = this.toOptionalString(
    environment.AI_SUMMARY_BEDROCK_SECRET_ACCESS_KEY ?? environment.AWS_SECRET_ACCESS_KEY
  );
}

export default new AISummaryPluginEnvironment();
