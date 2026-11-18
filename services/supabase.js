const { createClient } = require('@supabase/supabase-js');
const { HttpError } = require('./http');

let clients;

function getCredentials() {
    return {
        url: process.env.SUPABASE_URL,
        publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
        secretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    };
}

function isValidProjectUrl(value) {
    try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:')
            && !['supabase.com', 'your-project-ref.supabase.co'].includes(url.hostname)
            && url.pathname === '/'
            && !url.search
            && !url.hash;
    } catch {
        return false;
    }
}

function getClients() {
    const { url, publishableKey, secretKey } = getCredentials();
    if (!isValidProjectUrl(url) || !publishableKey || !secretKey) {
        throw new HttpError(503, 'Supabase is not configured. Set the project API URL, publishable key, and secret key in backend/.env.');
    }

    if (!clients) {
        const auth = createClient(url, publishableKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        const database = createClient(url, secretKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        clients = { auth, database };
    }

    return clients;
}

function isConfigured() {
    const { url, publishableKey, secretKey } = getCredentials();
    return isValidProjectUrl(url) && Boolean(publishableKey && secretKey);
}

module.exports = { getClients, isConfigured };
