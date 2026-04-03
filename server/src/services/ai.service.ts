/**
 * AI Service
 * Handles AI-powered verification for Freelance escrows
 * Supports both Claude API and XAI/Grok API
 */

import Anthropic from '@anthropic-ai/sdk';

interface XAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface AIVerificationResult {
  score: number;
  verdict: string;
  recommendation: 'RELEASE' | 'REFUND' | 'PARTIAL';
  analysis: string;
}

interface DeliverablesInput {
  githubUrl?: string;
  description: string;
}

class AIService {
  private claudeClient: Anthropic | null = null;
  private xaiApiKey: string | null = null;
  private xaiUrl: string | null = null;
  private aiService: 'claude' | 'xai' | null = null;
  private model: string;

  constructor() {
    // Determine which AI service to use
    const aiServiceType = process.env.AI_SERVICE?.toLowerCase();
    
    if (aiServiceType === 'xai' || process.env.XAI_API_KEY) {
      // Use XAI/Grok
      this.xaiApiKey = process.env.XAI_API_KEY || null;
      this.xaiUrl = process.env.XAI_API_URL || 'https://api.x.ai/v1/chat/completions';
      this.model = process.env.XAI_MODEL || 'grok-2-latest';
      this.aiService = 'xai';
      
      if (this.xaiApiKey) {
        console.log('✅ AI Service initialized with XAI/Grok API');
      } else {
        console.warn('⚠️  XAI API key not set');
      }
    } else {
      // Use Claude (fallback)
      const claudeApiKey = process.env.CLAUDE_API_KEY;
      this.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
      
      if (claudeApiKey) {
        this.claudeClient = new Anthropic({ apiKey: claudeApiKey });
        this.aiService = 'claude';
        console.log('✅ AI Service initialized with Claude API');
      } else {
        console.warn('⚠️  No AI API keys configured');
      }
    }
  }

  /**
   * Internal method to call XAI/Grok API
   */
  private async callXAI(prompt: string): Promise<string> {
    if (!this.xaiApiKey || !this.xaiUrl) {
      throw new Error('XAI API not configured');
    }

    const response = await fetch(this.xaiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.xaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`XAI API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as XAIResponse;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in XAI response');
    }

    return content;
  }

  /**
   * Internal method to call Claude API
   */
  private async callClaude(prompt: string): Promise<string> {
    if (!this.claudeClient) {
      throw new Error('Claude API not configured');
    }

    const response = await this.claudeClient.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    return content.text;
  }

  /**
   * Call the configured AI service
   */
  private async callAI(prompt: string): Promise<string> {
    if (this.aiService === 'xai') {
      return this.callXAI(prompt);
    } else if (this.aiService === 'claude') {
      return this.callClaude(prompt);
    }
    throw new Error('No AI service available');
  }

  /**
   * Verify freelance deliverables against requirements
   * This is the main method called by routes
   */
  async verifyDeliverables(
    appId: number,
    requirements: string,
    deliverables: DeliverablesInput
  ): Promise<AIVerificationResult> {
    if (!this.isAvailable()) {
      throw new Error('No AI service configured');
    }

    const prompt = `You are an impartial escrow verification AI for blockchain smart contracts. Evaluate whether freelance work deliverables meet the original requirements.

**Escrow App ID:** ${appId}

**Original Requirements:**
${requirements}

**Submitted Deliverables:**
Description: ${deliverables.description}
${deliverables.githubUrl ? `GitHub/URL: ${deliverables.githubUrl}` : ''}

Evaluate carefully and provide:
1. A score from 0-100 (where 100 = perfect match, requirements fully met)
2. A recommendation: RELEASE (score >= 70), REFUND (score < 40), or PARTIAL (40-69)
3. A brief verdict summary (1-2 sentences)
4. Detailed analysis explaining the score

**Scoring Guidelines:**
- 90-100: Exceeds or fully meets all requirements → RELEASE
- 70-89: Meets most requirements with minor gaps → RELEASE
- 50-69: Partially meets requirements, significant gaps exist → PARTIAL
- 40-49: Major requirements not met → PARTIAL
- 0-39: Does not meet requirements at all → REFUND

Respond ONLY in this exact JSON format:
{
  "score": <number 0-100>,
  "recommendation": "<RELEASE|REFUND|PARTIAL>",
  "verdict": "<1-2 sentence summary>",
  "analysis": "<detailed reasoning>"
}`;

    try {
      const content = await this.callAI(prompt);
      
      // Parse JSON response (handle potential markdown code blocks)
      let jsonStr = content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          jsonStr = match[1];
        }
      }

      const result = JSON.parse(jsonStr.trim());
      
      // Validate and normalize result
      const score = Math.max(0, Math.min(100, result.score || 0));
      let recommendation: 'RELEASE' | 'REFUND' | 'PARTIAL' = 'PARTIAL';
      
      if (result.recommendation) {
        const rec = result.recommendation.toUpperCase();
        if (rec === 'RELEASE' || rec === 'REFUND' || rec === 'PARTIAL') {
          recommendation = rec;
        }
      } else {
        // Auto-determine from score
        if (score >= 70) recommendation = 'RELEASE';
        else if (score < 40) recommendation = 'REFUND';
        else recommendation = 'PARTIAL';
      }

      return {
        score,
        recommendation,
        verdict: result.verdict || `Score: ${score}/100`,
        analysis: result.analysis || result.reasoning || 'No detailed analysis provided',
      };
    } catch (error) {
      console.error('Error in AI verification:', error);
      throw new Error('AI verification failed');
    }
  }

  /**
   * Simple check for deliverables (backward compatible method)
   */
  async simpleVerify(
    requirements: string,
    deliverables: string,
    deliverableUrl?: string
  ): Promise<{ score: number; reasoning: string }> {
    const result = await this.verifyDeliverables(0, requirements, {
      description: deliverables,
      githubUrl: deliverableUrl,
    });
    
    return {
      score: result.score,
      reasoning: result.analysis,
    };
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return this.aiService !== null && (
      (this.aiService === 'xai' && this.xaiApiKey !== null) ||
      (this.aiService === 'claude' && this.claudeClient !== null)
    );
  }

  /**
   * Get current AI service info
   */
  getServiceInfo() {
    return {
      service: this.aiService,
      model: this.model,
      available: this.isAvailable(),
    };
  }
}

export const aiService = new AIService();
