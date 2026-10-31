export class DevosApiError extends Error {
  statusCode?: number;
  exitCode: number;
  data?: unknown;

  constructor(message: string, exitCode = 2, statusCode?: number, data?: unknown) {
    super(message);
    this.name = 'DevosApiError';
    this.exitCode = exitCode;
    this.statusCode = statusCode;
    this.data = data;
  }
}

export class DevosApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl?: string, token?: string) {
    const raw = baseUrl || process.env.DEVOS_API_URL || 'http://127.0.0.1:3000';
    this.baseUrl = raw.replace(/\/+$/, '');
    this.token = token || process.env.DEVOS_API_TOKEN;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    let res: Response;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      res = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new DevosApiError(
        `Failed to connect to DEVOS API at ${this.baseUrl}: ${err.message || 'Connection refused'}`,
        3
      );
    }

    const text = await res.text();
    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }

    if (!res.ok) {
      const errMsg = json?.error?.message || json?.message || `HTTP ${res.status}: ${res.statusText}`;
      throw new DevosApiError(errMsg, res.status >= 500 ? 1 : 2, res.status, json);
    }

    return json as T;
  }

  async checkServerHealth(): Promise<{ status: string; timestamp?: string }> {
    return this.request<{ status: string; timestamp?: string }>('/api/health');
  }

  async listRepositories(): Promise<Array<{ id: string; name: string; path: string }>> {
    const res = await this.request<any>('/api/repositories');
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.repositories)) return res.repositories;
    return [];
  }

  async createRepository(name: string, path: string): Promise<{ id: string; name: string; path: string }> {
    return this.request<{ id: string; name: string; path: string }>('/api/repositories', {
      method: 'POST',
      body: JSON.stringify({ name, path }),
    });
  }

  async createAnalysis(payload: {
    repositoryId: string;
    baseSha: string;
    headSha: string;
  }): Promise<{ id: string; status: string; repositoryId: string; baseSha: string; headSha: string }> {
    return this.request('/api/analyses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getAnalysis(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}`);
  }

  async getRiskReport(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/risk`);
  }

  async getChangeReview(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/review`);
  }

  async getReleaseNotes(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/release-notes`);
  }

  async getHealthReport(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/health`);
  }

  async evaluateReleaseGate(id: string, policy?: Record<string, unknown>): Promise<any> {
    return this.request(`/api/analyses/${id}/health/gate`, {
      method: 'POST',
      body: JSON.stringify({ policy }),
    });
  }

  async completeAnalysis(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getGraph(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/graph`);
  }

  async getFindings(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/findings`);
  }

  async getComprehensiveReport(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/report`);
  }

  async getGuardEvaluation(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/guard`);
  }

  async postGuardEvaluation(id: string, payload: any = {}): Promise<any> {
    return this.request(`/api/analyses/${id}/guard`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getActions(id: string): Promise<any> {
    return this.request(`/api/analyses/${id}/actions`);
  }

  async getAction(actionId: string): Promise<any> {
    return this.request(`/api/actions/${actionId}`);
  }

  async approveAction(actionId: string, payload: any = {}): Promise<any> {
    return this.request(`/api/actions/${actionId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async executeAction(actionId: string): Promise<any> {
    return this.request(`/api/actions/${actionId}/execute`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getAuthStatus(): Promise<any> {
    return this.request('/api/auth/me');
  }

  async logout(): Promise<any> {
    return this.request('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}
