import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
try {
    const envPath = resolve(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach((line, index) => {
        const trimmedLine = line.trim();
        // Debug log for first few characters to check parsing
        if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                // Log what we found (partially masked)
                console.log(`[Debug Line ${index + 1}] Found key: '${key.trim()}', Value starts with: '${value.substring(0, 5)}...', Length: ${value.length}`);

                if (!process.env[key.trim()]) {
                    process.env[key.trim()] = value;
                }
            }
        }
    });
} catch (error) {
    console.error('❌ .env file not found or could not be read.');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function decodeJwt(token: string) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

console.log('\n🔍 Verifying Supabase Credentials...\n');

if (!supabaseUrl) {
    console.log('❌ VITE_SUPABASE_URL: Missing');
} else {
    console.log(`✅ VITE_SUPABASE_URL: ${supabaseUrl}`);
}

if (!anonKey) {
    console.log('❌ VITE_SUPABASE_ANON_KEY: Missing');
} else {
    const decoded = decodeJwt(anonKey);
    if (anonKey.startsWith('sb_')) {
        console.log(`⚠️  VITE_SUPABASE_ANON_KEY: "Supabase API Key" format detected (starts with sb_).`);
        console.log(`   👉 Please use the "Legacy anon, service_role API keys" tab in the Supabase Dashboard to get the JWT (starts with ey...).`);
    } else if (decoded) {
        console.log(`✅ VITE_SUPABASE_ANON_KEY: Found`);
        console.log(`   - Prefix: ${anonKey.substring(0, 10)}...`);
        console.log(`   - Role in Token: [${decoded.role}] ${decoded.role === 'anon' ? '✅ Correct' : '❌ INCORRECT (Should be anon)'}`);
    } else {
        console.log(`❌ VITE_SUPABASE_ANON_KEY: Invalid JWT format (should start with ey...)`);
    }
}

if (!serviceRoleKey) {
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY: Missing (Needed for scripts)');
} else {
    const decoded = decodeJwt(serviceRoleKey);
    if (serviceRoleKey.startsWith('sb_')) {
        console.log(`⚠️  SUPABASE_SERVICE_ROLE_KEY: "Supabase API Key" format detected (starts with sb_).`);
        console.log(`   👉 Please use the "Legacy anon, service_role API keys" tab in the Supabase Dashboard to get the JWT (starts with ey...).`);
    } else if (decoded) {
        console.log(`✅ SUPABASE_SERVICE_ROLE_KEY: Found`);
        console.log(`   - Prefix: ${serviceRoleKey.substring(0, 10)}...`);
        console.log(`   - Role in Token: [${decoded.role}] ${decoded.role === 'service_role' ? '✅ Correct' : '❌ INCORRECT (Should be service_role)'}`);
    } else {
        console.log(`❌ SUPABASE_SERVICE_ROLE_KEY: Invalid JWT format (should start with ey...)`);
    }
}

console.log('\n----------------------------------------\n');
