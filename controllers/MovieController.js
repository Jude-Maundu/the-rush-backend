const { getClients } = require('../services/supabase');
const { HttpError, isUuid } = require('../services/http');

async function listMovies(req, res) {
    const { database } = getClients();
    let query = database.from('movies').select('*').order('created_at', { ascending: false });

    if (req.query.search) {
        const search = String(req.query.search).trim().replace(/[,%()]/g, '');
        if (search) query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ movies: data });
}

async function getMovie(req, res) {
    if (!isUuid(req.params.id)) throw new HttpError(400, 'Movie ID must be a valid UUID.');

    const { database } = getClients();
    const { data, error } = await database
        .from('movies')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError(404, 'Movie not found.');
    res.json({ movie: data });
}

module.exports = { listMovies, getMovie };
