const express = require('express');
const { getClients } = require('../services/supabase');
const { asyncHandler } = require('../services/http');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
    const { database } = getClients();
    const { data, error } = await database
        .from('crew_members')
        .select('id, name, role, "group", image, slug, bio, created_at')
        .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ members: data || [] });
}));

module.exports = router;
