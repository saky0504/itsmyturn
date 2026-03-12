import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as http from 'http';

// Load environment variables from the root .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Since the handler is dynamic, we must use a dynamic import for it to work with Vite/TSX 
// cleanly or just standard import since it's tsx.
import searchPricesHandler from '../api/search-prices';

const PORT = parseInt(process.env.API_PORT || '3001', 10);

const server = http.createServer((req, res) => {
    // CORS setup - allow frontend requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    // Only handle /api/search-prices
    if (req.url === '/api/search-prices' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                let parsedBody = {};
                if (body) {
                    parsedBody = JSON.parse(body);
                }

                // Create a mock VercelRequest
                const vercelReq: any = {
                    ...req,
                    method: req.method,
                    url: req.url,
                    body: parsedBody,
                    query: {},
                    cookies: {},
                };

                // Create a mock VercelResponse
                const vercelRes: any = {
                    ...res,
                    status: (code: number) => {
                        res.statusCode = code;
                        return vercelRes;
                    },
                    json: (data: any) => {
                        if (!res.headersSent) {
                            res.setHeader('Content-Type', 'application/json');
                        }
                        res.end(JSON.stringify(data));
                    },
                    send: (data: any) => {
                        res.end(data);
                    },
                    setHeader: (name: string, value: string) => {
                        res.setHeader(name, value);
                        return vercelRes;
                    }
                };

                await searchPricesHandler(vercelReq, vercelRes);

            } catch (err) {
                console.error('[Local API Error]', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Internal Dev Server Error', details: String(err) }));
            }
        });
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n🚀 Local API proxy server running on http://127.0.0.1:${PORT}`);
    console.log(`📡 Use this to test Vercel serverless functions locally!\n`);
});
