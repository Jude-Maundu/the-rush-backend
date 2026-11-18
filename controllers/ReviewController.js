const { getClients } = require('../services/supabase');
const { HttpError, isUuid } = require('../services/http');

const sortOptions = {
    newest: { column: 'created_at', ascending: false },
    oldest: { column: 'created_at', ascending: true },
    highest: { column: 'rating', ascending: false },
    lowest: { column: 'rating', ascending: true }
};

async function listReviews(req, res) {
    const { database } = getClients();
    const sort = sortOptions[req.query.sort] || sortOptions.newest;
    const { data: reviews, error } = await database
        .from('reviews')
        .select('id, user_id, movie_id, rating, body, created_at')
        .order(sort.column, { ascending: sort.ascending });

    if (error) throw error;

    const userIds = [...new Set(reviews.map(review => review.user_id))];
    let profiles = [];
    if (userIds.length) {
        const { data, error: profileError } = await database
            .from('profiles')
            .select('id, name')
            .in('id', userIds);
        if (profileError) throw profileError;
        profiles = data;
    }

    const names = new Map(profiles.map(profile => [profile.id, profile.name]));
    res.json({
        reviews: reviews.map(review => ({
            id: review.id,
            movieId: review.movie_id,
            name: names.get(review.user_id) || 'Member',
            rating: review.rating,
            body: review.body,
            createdAt: review.created_at
        }))
    });
}

async function addReview(req, res) {
    const { rating, body, movieId } = req.body || {};
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5
        || typeof body !== 'string' || !body.trim() || body.trim().length > 500) {
        throw new HttpError(400, 'A review must include a rating from 1 to 5 and 1-500 characters of feedback.');
    }
    if (movieId != null && !isUuid(movieId)) {
        throw new HttpError(400, 'Movie ID must be a valid UUID.');
    }

    const { database } = getClients();
    const { data, error } = await database
        .from('reviews')
        .insert({
            user_id: req.user.id,
            movie_id: movieId || null,
            rating: numericRating,
            body: body.trim()
        })
        .select('id, movie_id, rating, body, created_at')
        .single();

    if (error) throw error;
    res.status(201).json({
        review: {
            id: data.id,
            movieId: data.movie_id,
            name: req.user.name,
            rating: data.rating,
            body: data.body,
            createdAt: data.created_at
        }
    });
}

module.exports = { listReviews, addReview };
