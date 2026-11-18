const { getClients } = require('../services/supabase');
const { HttpError, isUuid } = require('../services/http');
const { listReviews } = require('./ReviewController');

async function overview(req, res) {
    const { database } = getClients();
    const [users, reviews, ratings] = await Promise.all([
        database.from('profiles').select('id', { count: 'exact', head: true }),
        database.from('reviews').select('id', { count: 'exact', head: true }),
        database.from('reviews').select('rating')
    ]);

    for (const result of [users, reviews, ratings]) {
        if (result.error) throw result.error;
    }

    const ratingRows = ratings.data || [];
    const averageRating = ratingRows.length
        ? ratingRows.reduce((total, review) => total + review.rating, 0) / ratingRows.length
        : 0;

    res.json({
        overview: {
            userCount: users.count || 0,
            reviewCount: reviews.count || 0,
            averageRating: Number(averageRating.toFixed(1))
        }
    });
}

async function adminReviews(req, res) {
    await listReviews(req, res);
}

async function createUser(req, res) {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || !name.trim()
        || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        || typeof password !== 'string' || password.length < 8) {
        throw new HttpError(400, 'Name, a valid email, and a password of at least 8 characters are required.');
    }

    const { database } = getClients();
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await database.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { name: name.trim() }
    });
    if (error) {
        if (['email_exists', 'user_already_exists'].includes(error.code)
            || /email.+already (?:exists|registered)/i.test(error.message || '')) {
            throw new HttpError(409, 'An account with this email already exists.');
        }
        throw error;
    }
    if (!data.user) throw new Error('Supabase did not return the created user.');

    const { data: profile, error: profileError } = await database
        .from('profiles')
        .upsert({
            id: data.user.id,
            name: name.trim(),
            role: 'member'
        }, { onConflict: 'id' })
        .select('id, name, role')
        .single();
    if (profileError) throw profileError;

    res.status(201).json({
        user: {
            id: data.user.id,
            email: data.user.email,
            name: profile.name,
            role: profile.role
        }
    });
}

async function addMovie(req, res) {
    const { title, year, genre, poster } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || !Number.isInteger(Number(year))
        || typeof genre !== 'string' || !genre.trim()
        || typeof poster !== 'string' || !poster.trim()) {
        throw new HttpError(400, 'Title, release year, genre, and poster URL are required.');
    }

    const { database } = getClients();
    const fields = ['backdrop', 'description', 'trailer', 'director', 'duration'];
    const movie = {
        title: title.trim(),
        year: Number(year),
        genre: genre.trim(),
        poster: poster.trim()
    };
    for (const field of fields) {
        if (typeof req.body[field] === 'string') movie[field] = req.body[field].trim();
    }
    if (Array.isArray(req.body.cast)) movie.cast = req.body.cast;

    const { data, error } = await database.from('movies').insert(movie).select('*').single();
    if (error) throw error;
    res.status(201).json({ movie: data });
}

async function deleteMovie(req, res) {
    if (!isUuid(req.params.id)) throw new HttpError(400, 'Movie ID must be a valid UUID.');

    const { database } = getClients();
    const { data, error } = await database
        .from('movies')
        .delete()
        .eq('id', req.params.id)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError(404, 'Movie not found.');
    res.json({ ok: true });
}

async function deleteReview(req, res) {
    if (!isUuid(req.params.id)) throw new HttpError(400, 'Review ID must be a valid UUID.');

    const { database } = getClients();
    const { data, error } = await database
        .from('reviews')
        .delete()
        .eq('id', req.params.id)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError(404, 'Review not found.');
    res.json({ ok: true });
}

module.exports = { overview, adminReviews, createUser, addMovie, deleteMovie, deleteReview };