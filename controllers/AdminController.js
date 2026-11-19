const { getClients } = require('../services/supabase');
const { HttpError, isUuid } = require('../services/http');
const { uploadImage, deleteImage } = require('../services/cloudinary');
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

function memberSlug(name) {
    return name.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function validateMemberBody(body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const group = body.group;
    const bio = typeof body.bio === 'string' ? body.bio.trim() : '';

    if (!name || !role || !['cast', 'crew'].includes(group)) {
        throw new HttpError(400, 'Name, role, and a valid cast or crew group are required.');
    }
    if (bio.length > 2000) {
        throw new HttpError(400, 'Biography must be 2,000 characters or fewer.');
    }
    return { name, role, group, bio };
}

function isValidImageFile(file) {
    if (!file) return true;
    const { buffer, mimetype } = file;
    if (mimetype === 'image/jpeg') {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mimetype === 'image/png') {
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    return mimetype === 'image/webp'
        && buffer.toString('ascii', 0, 4) === 'RIFF'
        && buffer.toString('ascii', 8, 12) === 'WEBP';
}

async function removeImageAfterMutation(publicId, action) {
    if (!publicId) return null;
    try {
        await deleteImage(publicId);
        return null;
    } catch (error) {
        console.error('Cloudinary image cleanup failed:', error);
        return action === 'delete'
            ? 'The member was removed, but their Cloudinary portrait could not be deleted.'
            : 'The member was saved, but their old Cloudinary portrait could not be deleted.';
    }
}

async function cleanUpUnattachedImage(image) {
    if (!image?.image_public_id) return;
    try {
        await deleteImage(image.image_public_id);
    } catch (error) {
        console.error('Cloudinary cleanup failed after a database error:', error);
    }
}

async function listMembers(req, res) {
    const { database } = getClients();
    const { data, error } = await database
        .from('crew_members')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ members: data || [] });
}

async function addMember(req, res) {
    const member = validateMemberBody(req.body || {});
    const slug = memberSlug(member.name);
    if (!slug) throw new HttpError(400, 'Name must contain valid characters.');
    if (!isValidImageFile(req.file)) throw new HttpError(400, 'The selected file is not a valid JPG, PNG, or WebP image.');
    const { database } = getClients();
    const image = req.file ? await uploadImage(req.file.buffer) : null;

    const { data, error } = await database
        .from('crew_members')
        .insert({ ...member, ...(image || {}), slug })
        .select('*')
        .single();
    if (error) {
        await cleanUpUnattachedImage(image);
        if (error.code === '23505') throw new HttpError(409, 'A cast or crew member with this name already exists.');
        throw error;
    }
    res.status(201).json({ member: data });
}

async function updateMember(req, res) {
    if (!isUuid(req.params.id)) throw new HttpError(400, 'Member ID must be a valid UUID.');
    const member = validateMemberBody(req.body || {});
    const slug = memberSlug(member.name);
    if (!slug) throw new HttpError(400, 'Name must contain valid characters.');
    if (!isValidImageFile(req.file)) throw new HttpError(400, 'The selected file is not a valid JPG, PNG, or WebP image.');

    const { database } = getClients();
    const { data: current, error: currentError } = await database
        .from('crew_members')
        .select('id, image_public_id')
        .eq('id', req.params.id)
        .maybeSingle();
    if (currentError) throw currentError;
    if (!current) throw new HttpError(404, 'Cast or crew member not found.');

    const image = req.file ? await uploadImage(req.file.buffer) : null;
    const removeCurrentImage = req.body.removeImage === 'true';
    const update = { ...member, slug };
    if (image) Object.assign(update, image);
    else if (removeCurrentImage) {
        update.image = null;
        update.image_public_id = null;
    }

    const { data, error } = await database
        .from('crew_members')
        .update(update)
        .eq('id', req.params.id)
        .select('*')
        .maybeSingle();
    if (error || !data) {
        await cleanUpUnattachedImage(image);
        if (error?.code === '23505') throw new HttpError(409, 'A cast or crew member with this name already exists.');
        if (error) throw error;
        throw new HttpError(404, 'Cast or crew member not found.');
    }

    const replacedImage = image || removeCurrentImage;
    const cleanupWarning = replacedImage
        ? await removeImageAfterMutation(current.image_public_id)
        : null;
    res.json({ member: data, ...(cleanupWarning ? { warning: cleanupWarning } : {}) });
}

async function deleteMember(req, res) {
    if (!isUuid(req.params.id)) throw new HttpError(400, 'Member ID must be a valid UUID.');
    const { database } = getClients();
    const { data: current, error: currentError } = await database
        .from('crew_members')
        .select('id, image_public_id')
        .eq('id', req.params.id)
        .maybeSingle();
    if (currentError) throw currentError;
    if (!current) throw new HttpError(404, 'Cast or crew member not found.');

    const { data, error } = await database
        .from('crew_members')
        .delete()
        .eq('id', req.params.id)
        .select('id')
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Cast or crew member not found.');
    const warning = await removeImageAfterMutation(current.image_public_id, 'delete');
    res.json({ ok: true, ...(warning ? { warning } : {}) });
}

module.exports = {
    overview, adminReviews, createUser, addMovie, deleteMovie, deleteReview,
    listMembers, addMember, updateMember, deleteMember
};