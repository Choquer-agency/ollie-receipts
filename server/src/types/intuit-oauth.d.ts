declare module 'intuit-oauth' {
  export default class OAuthClient {
    constructor(config: {
      clientId: string;
      clientSecret: string;
      environment: 'sandbox' | 'production';
      redirectUri: string;
    });

    authorizeUri(options: { scope: string[]; state?: string }): string;
    createToken(code: string): Promise<any>;
    refresh(): Promise<any>;
    revoke(): Promise<any>;
    setToken(token: any): void;
    token: any;
  }
}

