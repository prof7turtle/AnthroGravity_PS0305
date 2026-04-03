import axios from 'axios';

export type AiVerificationResult = {
  score: number;
  matched_criteria: string[];
  missing_criteria: string[];
  analysis: string;
  verdict: string;
  recommendation: 'RELEASE' | 'DISPUTE';
  rawOutput?: string;
};

const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const clampScore = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
};

const normalizeRecommendation = (value: unknown): 'RELEASE' | 'DISPUTE' => {
  const normalized = String(value || '').toUpperCase();
  return normalized === 'RELEASE' ? 'RELEASE' : 'DISPUTE';
};

const normalizeText = (value: unknown) => String(value || '').toLowerCase();
const normalizeComparable = (value: unknown) => String(value || '').trim().toLowerCase();

const looksLikeUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const isMeaningfulDescription = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (looksLikeUrl(trimmed)) return false;
  if (trimmed.length < 20) return false;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount >= 4;
};

const hasAlgokitEvidence = (text: string) => /algokit|algo\s*kit/.test(text);
const hasZeroAlgoEvidence = (text: string) => /\b0\s*-?\s*algo\b|\bzero\s+algo\b|\bsend\b[^.]{0,60}\b0\s*-?\s*algo\b/.test(text);
const hasVitestEvidence = (text: string) => /\bvitest\b|\btest\s*coverage\b/.test(text);

const requirementIsSatisfiedByEvidence = (requirement: string, evidenceText: string) => {
  const req = normalizeText(requirement);

  if (/algokit|algo\s*kit/.test(req)) return hasAlgokitEvidence(evidenceText);
  if (/0\s*-?\s*algo|zero\s+algo/.test(req)) return hasZeroAlgoEvidence(evidenceText);
  if (/vitest|test\s*coverage/.test(req)) return hasVitestEvidence(evidenceText);

  // For generic requirements, only mark satisfied when requirement wording appears in evidence.
  return req.length > 0 && evidenceText.includes(req);
};

const canonicalGapKey = (value: string) => {
  const normalized = normalizeText(value);
  if (/algokit|algo\s*kit/.test(normalized)) return 'algokit';
  if (/0\s*-?\s*algo|zero\s+algo/.test(normalized)) return 'zero-algo';
  if (/vitest|test\s*coverage/.test(normalized)) return 'vitest-coverage';
  if (/repository|github/.test(normalized)) return 'repository';
  if (/live|deploy/.test(normalized)) return 'live-url';
  if (/description|summary/.test(normalized)) return 'description';
  return `raw:${normalized}`;
};

const dedupeMissingCriteria = (items: string[]) => {
  const cleaned = items
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0);

  const byKey = new Map<string, string>();

  for (const item of cleaned) {
    const key = canonicalGapKey(item);
    const existing = byKey.get(key);

    // Prefer explicit requirement-level phrasing over generic phrasing.
    if (!existing || (/^requirement not evidenced:/i.test(item) && !/^requirement not evidenced:/i.test(existing))) {
      byKey.set(key, item);
    }
  }

  return Array.from(byKey.values());
};

const groundResultToEvidence = (
  result: AiVerificationResult,
  input: {
    requirements: string[];
    githubUrl?: string;
    liveUrl?: string;
    description?: string;
    screenshotsUrls?: string[];
  },
): AiVerificationResult => {
  const githubUrl = String(input.githubUrl || '').trim();
  const liveUrl = String(input.liveUrl || '').trim();
  const description = String(input.description || '').trim();

  const evidenceText = normalizeText([githubUrl, liveUrl, description].filter(Boolean).join(' '));

  const unsupportedPatterns: Array<{ pattern: RegExp; allowed: boolean }> = [
    { pattern: /algokit|algo\s*kit/i, allowed: hasAlgokitEvidence(evidenceText) },
    { pattern: /0\s*-?\s*algo|zero\s+algo/i, allowed: hasZeroAlgoEvidence(evidenceText) },
    { pattern: /vitest|test\s*coverage/i, allowed: hasVitestEvidence(evidenceText) },
  ];

  const groundedMatched = result.matched_criteria.filter((item) => {
    return !unsupportedPatterns.some(({ pattern, allowed }) => !allowed && pattern.test(item));
  });

  const requirementGaps = (input.requirements || [])
    .filter((req) => typeof req === 'string' && req.trim().length > 0)
    .filter((req) => !requirementIsSatisfiedByEvidence(req, evidenceText))
    .map((req) => `Requirement not evidenced: ${req}`);

  const mergedMissing = dedupeMissingCriteria([...result.missing_criteria, ...requirementGaps]);

  const normalizedGithub = normalizeComparable(githubUrl);
  const normalizedLive = normalizeComparable(liveUrl);
  const normalizedDescription = normalizeComparable(description);

  const sameRepoAndLive = Boolean(normalizedGithub && normalizedLive && normalizedGithub === normalizedLive);
  const descriptionDuplicatesLink = Boolean(
    normalizedDescription &&
      (normalizedDescription === normalizedGithub || normalizedDescription === normalizedLive || looksLikeUrl(description)),
  );

  const qualityGaps = [
    ...(githubUrl && !isValidHttpUrl(githubUrl) ? ['GitHub URL is not a valid HTTP(S) URL'] : []),
    ...(liveUrl && !isValidHttpUrl(liveUrl) ? ['Deployed URL is not a valid HTTP(S) URL'] : []),
    ...(sameRepoAndLive ? ['GitHub URL and Deployed URL are identical; provide distinct code and live links'] : []),
    ...(description && !isMeaningfulDescription(description)
      ? ['Description is too short or URL-like; provide a meaningful implementation summary']
      : []),
    ...(descriptionDuplicatesLink
      ? ['Description duplicates a URL instead of describing the delivered work']
      : []),
  ];

  let normalizedScore = clampScore(result.score);
  if (sameRepoAndLive) normalizedScore = clampScore(normalizedScore - 25);
  if (descriptionDuplicatesLink) normalizedScore = clampScore(normalizedScore - 20);
  if (description && !isMeaningfulDescription(description)) normalizedScore = clampScore(normalizedScore - 15);

  const finalMissing = dedupeMissingCriteria([...mergedMissing, ...qualityGaps]);
  const normalizedMatched = normalizedScore === 0 ? [] : groundedMatched;
  const normalizedRecommendation: 'RELEASE' | 'DISPUTE' = normalizedScore >= 75 ? 'RELEASE' : 'DISPUTE';

  return {
    ...result,
    score: normalizedScore,
    matched_criteria: normalizedMatched,
    missing_criteria: finalMissing,
    recommendation: normalizedRecommendation,
  };
};

const fallbackHeuristic = (input: {
  requirements: string[];
  githubUrl?: string;
  liveUrl?: string;
  description?: string;
  screenshotsUrls?: string[];
}): AiVerificationResult => {
  const hasRepo = Boolean(input.githubUrl && input.githubUrl.trim().length > 0);
  const hasLiveUrl = Boolean(input.liveUrl && input.liveUrl.trim().length > 0);
  const hasDescription = Boolean(input.description && input.description.trim().length > 0);

  let score = 50;
  if (hasRepo) score += 20;
  if (hasLiveUrl) score += 15;
  if (hasDescription) score += 10;

  const matched = [
    ...(hasRepo ? ['Repository reference provided'] : []),
    ...(hasLiveUrl ? ['Deployment URL provided'] : []),
    ...(hasDescription ? ['Work description provided'] : []),
  ];

  const missing = [
    ...(hasRepo ? [] : ['Missing repository URL']),
    ...(hasLiveUrl ? [] : ['Missing deployed/live URL']),
    ...(hasDescription ? [] : ['Missing implementation description']),
  ];

  const safeScore = clampScore(score);
  const analysis = [
    hasDescription
      ? 'The submission includes a project summary, which helps assess implementation intent.'
      : 'The submission is missing a useful project summary, which blocks deeper validation.',
    hasRepo
      ? 'A repository link was provided for review.'
      : 'No repository link was provided for code-level verification.',
    hasLiveUrl
      ? 'A live/deployed URL was provided to support runtime validation.'
      : 'No live/deployed URL was provided for runtime validation.',
  ].join(' ');

  return {
    score: safeScore,
    matched_criteria: matched,
    missing_criteria: missing,
    analysis,
    verdict: safeScore >= 75 ? 'Deliverables meet acceptance threshold' : 'Deliverables do not meet acceptance threshold',
    recommendation: safeScore >= 75 ? 'RELEASE' : 'DISPUTE',
    rawOutput: JSON.stringify(
      {
        source: 'fallback',
        score: safeScore,
        matched_criteria: matched,
        missing_criteria: missing,
      },
      null,
      2,
    ),
  };
};

const toAiVerificationResult = (parsed: any): AiVerificationResult => {
  const score = clampScore(Number(parsed?.score));
  const matched = Array.isArray(parsed?.matched_criteria)
    ? parsed.matched_criteria.filter((item: unknown) => typeof item === 'string')
    : [];
  const missing = Array.isArray(parsed?.missing_criteria)
    ? dedupeMissingCriteria(parsed.missing_criteria.filter((item: unknown) => typeof item === 'string'))
    : [];
  const analysis = typeof parsed?.analysis === 'string' ? parsed.analysis.trim() : '';
  const verdict = typeof parsed?.verdict === 'string' ? parsed.verdict : '';
  const recommendation = normalizeRecommendation(parsed?.recommendation);

  return {
    score,
    matched_criteria: matched,
    missing_criteria: missing,
    analysis: analysis || verdict || 'The deliverables were reviewed against the escrow requirements and need further evidence for confident approval.',
    verdict: verdict || (recommendation === 'RELEASE' ? 'Deliverables approved' : 'Deliverables need revision'),
    recommendation,
  };
};

const extractJsonCandidate = (content: string): string => {
  const trimmed = content.trim();

  // Accept ```json ... ``` or plain ``` ... ``` blocks.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  // Accept text-wrapped JSON by taking the first object block.
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
};

const parseModelJson = (content: string): AiVerificationResult | null => {
  try {
    return toAiVerificationResult(JSON.parse(content));
  } catch {
    try {
      return toAiVerificationResult(JSON.parse(extractJsonCandidate(content)));
    } catch {
      return null;
    }
  }
};

export const evaluateDeliverables = async (input: {
  requirements: string[];
  githubUrl?: string;
  liveUrl?: string;
  description?: string;
  screenshotsUrls?: string[];
}): Promise<AiVerificationResult> => {
  const apiKey = process.env.GROQ_API_KEY || '';
  if (!apiKey) {
    const fallback = fallbackHeuristic(input);
    return {
      ...fallback,
      rawOutput:
        fallback.rawOutput ||
        JSON.stringify(
          {
            source: 'fallback',
            reason: 'GROQ_API_KEY is not configured on the server',
          },
          null,
          2,
        ),
    };
  }

  const requirementsText = input.requirements.length
    ? input.requirements.map((item, index) => `${index + 1}. ${item}`).join('\n')
    : 'No explicit requirements provided';

  const userPrompt = [
    'Evaluate the submitted project for escrow release.',
    '',
    `Requirements:\n${requirementsText}`,
    '',
    `GitHub URL: ${input.githubUrl || 'Not provided'}`,
    `Deployed URL: ${input.liveUrl || 'Not provided'}`,
    `Description: ${input.description || 'Not provided'}`,
    '',
    'Analyze relevance of the description, repository URL, and deployed URL against requirements.',
    'Only use explicit evidence from the provided inputs.',
    'Do not assume technologies, tests, or transactions unless those details are directly present in the inputs.',
    'Heavily penalize submissions that repeat the same URL across GitHub URL, Deployed URL, and Description.',
    'Treat URL-only descriptions as low-quality evidence.',
    'Penalize unrelated/random content and explain why in missing_criteria.',
    '',
    'Return STRICT JSON only in this shape:',
    '{',
    '  "score": 0-100 integer,',
    '  "matched_criteria": ["..."],',
    '  "missing_criteria": ["..."],',
    '  "analysis": "single paragraph analysis of the work (3-6 sentences)",',
    '  "verdict": "one sentence",',
    '  "recommendation": "RELEASE" or "DISPUTE"',
    '}',
    'Recommend RELEASE only if score >= 75.',
  ].join('\n');

  const candidateModels = [GROQ_MODEL, 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile'].filter(
    (model, index, arr) => Boolean(model) && arr.indexOf(model) === index,
  );

  let lastErrorMessage = 'Groq request failed';
  let lastRawOutput = '';
  let lastModelTried = '';

  for (const model of candidateModels) {
    lastModelTried = model;
    try {
      const response = await axios.post(
        GROQ_API_URL,
        {
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are an escrow verification AI. Be objective and concise. Output valid JSON only with the requested keys.',
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      const content = String(response.data?.choices?.[0]?.message?.content || '').trim();
      lastRawOutput = content;
      const parsed = parseModelJson(content);
      if (parsed) {
        const grounded = groundResultToEvidence(parsed, input);
        return { ...grounded, rawOutput: content };
      }

      lastErrorMessage = `Groq returned non-JSON output for model ${model}`;
    } catch (error: any) {
      const providerMessage =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        `Groq request failed for model ${model}`;
      lastErrorMessage = String(providerMessage);
    }
  }

  const fallback = fallbackHeuristic(input);
  const groundedFallback = groundResultToEvidence(fallback, input);
  return {
    ...groundedFallback,
    rawOutput: JSON.stringify(
      {
        source: 'fallback-after-groq-failure',
        reason: lastErrorMessage,
        model: lastModelTried,
        provider_raw_output: lastRawOutput || 'No content returned by provider',
      },
      null,
      2,
    ),
  };
};
