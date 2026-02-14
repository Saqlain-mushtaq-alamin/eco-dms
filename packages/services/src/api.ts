export interface ApiConfig {
    baseUrl: string;
    timeout?: number;
    headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
    data: T;
    status: number;
    message?: string;
}

export interface ApiError {
    message: string;
    status: number;
    code?: string;
}

/**
 * Shared API service for backend communication
 * Works across web and mobile platforms
 */
export class ApiService {
    private config: ApiConfig;

    constructor(config: ApiConfig) {
        this.config = {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
            ...config,
        };
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${this.config.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.config.headers,
                    ...options.headers,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw {
                    message: `API error: ${response.statusText}`,
                    status: response.status,
                } as ApiError;
            }

            const data = await response.json();
            return {
                data,
                status: response.status,
            };
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw {
                message: error.message || 'Network error',
                status: error.status || 0,
                code: error.code,
            } as ApiError;
        }
    }

    async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
        const query = params ? `?${new URLSearchParams(params).toString()}` : '';
        return this.request<T>(`${endpoint}${query}`, { method: 'GET' });
    }

    async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }

    setAuthToken(token: string) {
        this.config.headers = {
            ...this.config.headers,
            Authorization: `Bearer ${token}`,
        };
    }

    clearAuthToken() {
        const { Authorization, ...headers } = this.config.headers || {};
        this.config.headers = headers;
    }
}
