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
   * Verify freelance deliverables against requirements using XAI/Grok
   */
  private async verifyWithXAI(
    requirements: string,
    deliverables: string,
    deliverableUrl?: string
  ): Promise<{ score: number; reasoning: string }> {
    if (!this.xaiApiKey || !this.xaiUrl) {
      throw new Error('XAI API not configured');
    }

    const prompt = `You are an impartial escrow verification AI. Your job is to evaluate whether freelance work deliverables meet the original requirements.

**Original Requirements:**
${requirements}

**Submitted Deliverables:**
${deliverables}

${deliverableUrl ? `**Deliverable URL/Link:**\n${deliverableUrl}\n` : ''}

Evaluate the deliverables against the requirements and provide:
1. A score from 0-100 (where 100 = perfect match, requirements fully met)
2. Clear reasoning explaining the score

**Scoring Guidelines:**
- 90-100: Exceeds or fully meets all requirements
- 70-89: Meets most requirements with minor gaps
- 50-69: Partially meets requirements, significant gaps exist
- 30-49: Major requirements not met
- 0-29: Does not meet requirements at all

Respond ONLY in this exact JSON format:
{
  "score": <number 0-100>,
  "reasoning": "<your detailed reasoning>"
}`;

    try {
      const response = await fetch(this.xaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.xaiApiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
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

      // Parse JSON response
      const result = JSON.parse(content);
      
      return {
        score: Math.max(0, Math.min(100, result.score)), // Clamp to 0-100
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error('Error calling XAI API:', error);
      throw new Error('AI verification failed');
    }
  }

  /**
   * Verify freelance deliverables against requirements using Claude
   */
  private async verifyWithClaude(
    requirements: string,
    deliverables: string,
    deliverableUrl?: string
  ): Promise<{ score: number; reasoning: string }> {
    if (!this.claudeClient) {
      throw new Error('Claude API not configured');
    }

    const prompt = `You are an impartial escrow verification AI. Your job is to evaluate whether freelance work deliverables meet the original requirements.

**Original Requirements:**
${requirements}

**Submitted Deliverables:**
${deliverables}

${deliverableUrl ? `**Deliverable URL/Link:**\n${deliverableUrl}\n` : ''}

Evaluate the deliverables against the requirements and provide:
1. A score from 0-100 (where 100 = perfect match, requirements fully met)
2. Clear reasoning explaining the score

**Scoring Guidelines:**
- 90-100: Exceeds or fully meets all requirements
- 70-89: Meets most requirements with minor gaps
- 50-69: Partially meets requirements, significant gaps exist
- 30-49: Major requirements not met
- 0-29: Does not meet requirements at all

Respond ONLY in this exact JSON format:
{
  "score": <number 0-100>,
  "reasoning": "<your detailed reasoning>"
}`;

    try {
      const response = await this.claudeClient.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse JSON response
      const result = JSON.parse(content.text);
      
      return {
        score: Math.max(0, Math.min(100, result.score)), // Clamp to 0-100
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error('AI verification failed');
    }
  }

  /**
   * Verify freelance deliverables against requirements
   * Automatically uses the configured AI service (XAI or Claude)
   */
  async verifyDeliverables(
    requirements: string,
    deliverables: string,
    deliverableUrl?: string
  ): Promise<{ score: number; reasoning: string }> {
    if (!this.isAvailable()) {
      throw new Error('No AI service configured');
    }

    if (this.aiService === 'xai') {
      return this.verifyWithXAI(requirements, deliverables, deliverableUrl);
    } else if (this.aiService === 'claude') {
      return this.verifyWithClaude(requirements, deliverables, deliverableUrl);
    } else {
      throw new Error('No AI service available');
    }
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
