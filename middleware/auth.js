const { getClients } = require('../services/supabase');
const { HttpError, asyncHandler } = require('../services/http');

function bearerToken(req) {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
}

async function loadUser(token) {
    const { auth, database } = getClients();
    const { data, error } = await auth.auth.getUser(token);
    if (error || !data.user) {
        throw new HttpError(401, 'Your session is invalid or has expired. Please sign in again.');
    }

    const { data: profile, error: profileError } = await database
        .from('profiles')
        .select('id, name, role')
        .eq('id', data.user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    return {
        id: data.user.id,
        email: data.user.email,
        name: profile?.name || data.user.user_metadata?.name || data.user.email,
        role: profile?.role || 'member'
    };
}

const optionalAuth = asyncHandler(async (req, res, next) => {
    const token = bearerToken(req);
    req.user = token ? await loadUser(token) : null;
    next();
});

const requireAuth = asyncHandler(async (req, res, next) => {
    const token = bearerToken(req);
    if (!token) throw new HttpError(401, 'Sign in to continue.');
    req.user = await loadUser(token);
    req.accessToken = token;
    next();
});

const requireAdmin = [
    requireAuth,
    (req, res, next) => {
        if (req.user.role !== 'admin') {
            return next(new HttpError(403, 'Administrator access is required.'));
        }
        next();
    }
];

module.exports = { optionalAuth, requireAuth, requireAdmin };
