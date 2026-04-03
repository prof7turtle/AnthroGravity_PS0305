export type AiVerificationResult = {
  score: number;
  matched_criteria: string[];
  missing_criteria: string[];
  verdict: string;
  recommendation: 'RELEASE' | 'DISPUTE';
};

export const evaluateDeliverables = async (input: {
  requirements: string[];
  githubUrl?: string;
  description?: string;
  screenshotsUrls?: string[];
}): Promise<AiVerificationResult> => {
  // Hackathon-safe deterministic scorer; replace with Anthropic/OpenAI in production.
  const hasRepo = Boolean(input.githubUrl && input.githubUrl.trim().length > 0);
  const hasDescription = Boolean(input.description && input.description.trim().length > 20);
  const hasEvidence = Boolean(input.screenshotsUrls && input.screenshotsUrls.length > 0);

  let score = 50;
  if (hasRepo) score += 20;
  if (hasDescription) score += 20;
  if (hasEvidence) score += 10;

  const matched = [
    ...(hasRepo ? ['Repository reference provided'] : []),
    ...(hasDescription ? ['Work description provided'] : []),
    ...(hasEvidence ? ['Supporting evidence attached'] : []),
  ];

  const missing = [
    ...(hasRepo ? [] : ['Missing repository URL']),
    ...(hasDescription ? [] : ['Insufficient implementation description']),
    ...(hasEvidence ? [] : ['No supporting screenshots/evidence']),
  ];

  return {
    score,
    matched_criteria: matched,
    missing_criteria: missing,
    verdict: score >= 75 ? 'Deliverables meet acceptance threshold' : 'Deliverables do not meet acceptance threshold',
    recommendation: score >= 75 ? 'RELEASE' : 'DISPUTE',
  };
};
