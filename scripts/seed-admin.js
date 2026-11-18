require('dotenv').config();

const { getClients } = require('../services/supabase');

const email = (process.env.ADMIN_EMAIL || 'admin@gmail.com').trim().toLowerCase();

function promptSecret(message) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        return Promise.reject(new Error('Run this command from an interactive terminal to enter the new admin password securely.'));
    }

    return new Promise((resolve, reject) => {
        const input = process.stdin;
        let value = '';

        function cleanup() {
            input.removeListener('data', onData);
            input.setRawMode(false);
            input.pause();
            process.stdout.write('\n');
        }

        function onData(character) {
            if (character === '\u0003') {
                cleanup();
                reject(new Error('Admin seeding cancelled.'));
                return;
            }

            if (character === '\r' || character === '\n') {
                cleanup();
                resolve(value);
                return;
            }

            if (character === '\u007f' || character === '\b') {
                value = value.slice(0, -1);
                return;
            }

            if (character >= ' ') value += character;
        }

        process.stdout.write(message);
        input.setEncoding('utf8');
        input.setRawMode(true);
        input.resume();
        input.on('data', onData);
    });
}

async function findUser(auth) {
    const perPage = 100;
    for (let page = 1; ; page += 1) {
        const { data, error } = await auth.admin.listUsers({ page, perPage });
        if (error) throw error;

        const user = data.users.find(account => account.email?.toLowerCase() === email);
        if (user) return user;
        if (data.users.length < perPage) return null;
    }
}

async function createAdminUser(auth) {
    const password = await promptSecret(`Create password for ${email} (minimum 8 characters): `);
    if (password.length < 8) {
        throw new Error('Admin password must be at least 8 characters.');
    }

    const confirmation = await promptSecret('Confirm new admin password: ');
    if (password !== confirmation) {
        throw new Error('Passwords do not match.');
    }

    const { data, error } = await auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: 'Admin' }
    });
    if (error) throw error;
    if (!data.user) throw new Error('Supabase did not return the created admin account.');
    return data.user;
}

async function seedAdmin() {
    if (!email || !email.includes('@')) {
        throw new Error('Set ADMIN_EMAIL to a valid email address.');
    }

    const { database } = getClients();
    const { error: schemaError } = await database
        .from('profiles')
        .select('id, name, role')
        .limit(1);
    if (schemaError) {
        if (schemaError.code === 'PGRST205') {
            throw new Error('The public.profiles table is missing. Run supabase/schema.sql in this Supabase project, then rerun this command.');
        }
        throw schemaError;
    }

    const existingUser = await findUser(database.auth);
    const user = existingUser || await createAdminUser(database.auth);

    const { data: profile, error: profileError } = await database
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();
    if (profileError) throw profileError;

    const { error } = await database
        .from('profiles')
        .upsert({
            id: user.id,
            name: profile?.name || user.user_metadata?.name || 'Admin',
            role: 'admin'
        }, { onConflict: 'id' });
    if (error) throw error;

    if (existingUser) {
        console.log(`Existing Supabase account ${email} promoted to admin; its password was not changed.`);
    } else {
        console.log(`Supabase account ${email} created and promoted to admin.`);
    }
}

seedAdmin().catch(error => {
    console.error(`Admin seeding failed: ${error.message}`);
    process.exitCode = 1;
});
