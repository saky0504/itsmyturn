// Deno type definitions for Supabase Edge Functions
declare global {
  namespace Deno {
    interface Env {
      get(key: string): string | undefined;
    }
    
    const env: Env;
    
    function serve(handler: (request: Request) => Response | Promise<Response>): void;
  }
}

// Hono types
declare module 'npm:hono' {
  export class Hono {
    constructor();
    use(path: string, middleware: any): this;
    get(path: string, handler: (c: any) => any): this;
    post(path: string, handler: (c: any) => any): this;
    put(path: string, handler: (c: any) => any): this;
    delete(path: string, handler: (c: any) => any): this;
    route(path: string, app: Hono): this;
    fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  }
}

declare module 'npm:hono/cors' {
  export function cors(options: any): any;
}

declare module 'npm:hono/logger' {
  export function logger(logFn?: (message: string) => void): any;
}

// Supabase types
declare module 'jsr:@supabase/supabase-js@2.49.8' {
  export function createClient(url: string, key: string): any;
}

export {};
