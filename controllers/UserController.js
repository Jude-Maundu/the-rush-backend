const { getClients } = require('../services/supabase');
const { HttpError } = require('../services/http');

function normalizeUser(user, profile) {
    return {
        id: user.id,
        email: user.email,
        name: profile?.name || user.user_metadata?.name || user.email,
        role: profile?.role || 'member'
    };
}

async function profileFor(userId) {
    const { database } = getClients();
    const { data, error } = await database
        .from('profiles')
        .select('id, name, role')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

function authError(error) {
    return new HttpError(error.status || 400, error.message);
}

async function signup(req, res) {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || !name.trim()
        || typeof email !== 'string' || !email.trim()
        || typeof password !== 'string' || password.length < 8) {
        throw new HttpError(400, 'Name, a valid email, and a password of at least 8 characters are required.');
    }

    const { auth } = getClients();
    const { data, error } = await auth.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() } }
    });
    if (error) throw authError(error);

    const profile = data.user ? await profileFor(data.user.id) : null;
    res.status(201).json({
        user: data.user ? normalizeUser(data.user, profile) : null,
        token: data.session?.access_token || null,
        message: data.session ? undefined : 'Check your email to confirm your account, then sign in.'
    });
}

async function signin(req, res) {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || !email.trim()
        || typeof password !== 'string' || !password) {
        throw new HttpError(400, 'Email and password are required.');
    }

    const { auth } = getClients();
    const { data, error } = await auth.auth.signInWithPassword({
        email: email.trim(),
        password
    });
    if (error) throw authError(error);

    const profile = await profileFor(data.user.id);
    res.json({
        user: normalizeUser(data.user, profile),
        token: data.session.access_token
    });
}

function session(req, res) {
    res.json({ user: req.user });
}

function signout(req, res) {
    res.json({ ok: true });
}

async function changePassword(req, res) {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        throw new HttpError(400, 'Provide your current password and a new password of at least 8 characters.');
    }

    const { auth, database } = getClients();
    const { error: verifyError } = await auth.auth.signInWithPassword({
        email: req.user.email,
        password: currentPassword
    });
    if (verifyError) throw new HttpError(400, 'Current password is incorrect.');

    const { error } = await database.auth.admin.updateUserById(req.user.id, {
        password: newPassword
    });
    if (error) throw authError(error);
    res.json({ ok: true });
}

module.exports = { signup, signin, session, signout, changePassword };