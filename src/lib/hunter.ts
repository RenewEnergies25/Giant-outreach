// Hunter.io API Client for Email Finding

const HUNTER_API_BASE = 'https://api.hunter.io/v2';

export interface HunterEmailFinderResponse {
  data: {
    first_name: string;
    last_name: string;
    email: string;
    score: number;
    domain: string;
    accept_all: boolean;
    position?: string;
    twitter?: string;
    linkedin_url?: string;
    phone_number?: string;
    company?: string;
    sources?: Array<{
      domain: string;
      uri: string;
      extracted_on: string;
      last_seen_on: string;
      still_on_page: boolean;
    }>;
    verification?: {
      date: string;
      status: string;
    };
  };
  meta: {
    params: Record<string, string>;
  };
}

export interface HunterError {
  errors: Array<{
    id: string;
    code: number;
    details: string;
  }>;
}

export interface EmailFindResult {
  success: boolean;
  email?: string;
  score?: number;
  position?: string;
  linkedin_url?: string;
  error?: string;
}

/**
 * Extract domain from a website URL
 */
export function extractDomain(website: string): string {
  if (!website) return '';

  // Remove protocol and www
  let domain = website
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');

  // Remove path
  domain = domain.split('/')[0];

  // Remove port
  domain = domain.split(':')[0];

  return domain;
}

/**
 * Split a full name into first and last name
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Find email using Hunter.io Email Finder API
 */
export async function findEmail(params: {
  domain: string;
  firstName: string;
  lastName?: string;
  apiKey: string;
}): Promise<EmailFindResult> {
  const { domain, firstName, lastName, apiKey } = params;

  if (!domain || !firstName) {
    return { success: false, error: 'Domain and first name are required' };
  }

  if (!apiKey) {
    return { success: false, error: 'Hunter API key is required' };
  }

  try {
    const url = new URL(`${HUNTER_API_BASE}/email-finder`);
    url.searchParams.set('domain', domain);
    url.searchParams.set('first_name', firstName);
    if (lastName) {
      url.searchParams.set('last_name', lastName);
    }
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      const error = data as HunterError;
      return {
        success: false,
        error: error.errors?.[0]?.details || `Hunter API error: ${response.status}`,
      };
    }

    const result = data as HunterEmailFinderResponse;

    if (!result.data?.email) {
      return { success: false, error: 'No email found' };
    }

    return {
      success: true,
      email: result.data.email,
      score: result.data.score,
      position: result.data.position,
      linkedin_url: result.data.linkedin_url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to Hunter API',
    };
  }
}

/**
 * Verify email using Hunter.io Email Verifier API
 */
export async function verifyEmail(params: {
  email: string;
  apiKey: string;
}): Promise<{ success: boolean; status?: string; score?: number; error?: string }> {
  const { email, apiKey } = params;

  if (!email || !apiKey) {
    return { success: false, error: 'Email and API key are required' };
  }

  try {
    const url = new URL(`${HUNTER_API_BASE}/email-verifier`);
    url.searchParams.set('email', email);
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      const error = data as HunterError;
      return {
        success: false,
        error: error.errors?.[0]?.details || `Hunter API error: ${response.status}`,
      };
    }

    return {
      success: true,
      status: data.data?.status,
      score: data.data?.score,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to Hunter API',
    };
  }
}

/**
 * Get Hunter API account info (to check remaining credits)
 */
export async function getAccountInfo(apiKey: string): Promise<{
  success: boolean;
  searches_used?: number;
  searches_available?: number;
  error?: string;
}> {
  try {
    const url = new URL(`${HUNTER_API_BASE}/account`);
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: 'Invalid API key' };
    }

    return {
      success: true,
      searches_used: data.data?.requests?.searches?.used,
      searches_available: data.data?.requests?.searches?.available,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to Hunter API',
    };
  }
}
