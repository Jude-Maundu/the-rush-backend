const cloudinary = require('cloudinary').v2;
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { HttpError } = require('./http');

const localImageDirectory = path.join(__dirname, '..', 'uploads', 'cast-crew');
const extensionByMimeType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
};

function getCloudinary() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new HttpError(503, 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the backend.');
    }

    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET
    });
    return cloudinary;
}

function uploadImage(buffer) {
    return new Promise((resolve, reject) => {
        let client;
        try {
            client = getCloudinary();
        } catch (error) {
            reject(error);
            return;
        }
        const stream = client.uploader.upload_stream({
            folder: 'the-rush/cast-crew',
            resource_type: 'image'
        }, (error, result) => {
            if (error) return reject(error);
            if (!result?.secure_url || !result?.public_id) {
                return reject(new Error('Cloudinary did not return the uploaded image details.'));
            }
            resolve({
                image: result.secure_url,
                image_public_id: result.public_id,
                image_storage: 'cloudinary',
                image_storage_key: null
            });
        });
        stream.end(buffer);
    });
}

async function saveImageLocally(buffer, mimeType) {
    const extension = extensionByMimeType[mimeType];
    if (!extension) throw new Error('Unsupported portrait image type.');

    await fs.mkdir(localImageDirectory, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await fs.writeFile(path.join(localImageDirectory, filename), buffer, { flag: 'wx' });

    const baseUrl = process.env.BACKEND_PUBLIC_URL
        || process.env.RENDER_EXTERNAL_URL
        || (process.env.NODE_ENV === 'production'
            ? 'https://the-rush-backend.onrender.com'
            : `http://localhost:${Number(process.env.PORT) || 5000}`);
    return {
        image: `${baseUrl.replace(/\/+$/, '')}/uploads/cast-crew/${filename}`,
        image_public_id: null,
        image_storage: 'local',
        image_storage_key: filename
    };
}

async function uploadPortrait(buffer, mimeType) {
    try {
        return { ...(await uploadImage(buffer)), warning: null };
    } catch (error) {
        console.error('Cloudinary portrait upload failed; using temporary local storage:', error);
        const localImage = await saveImageLocally(buffer, mimeType);
        return {
            ...localImage,
            warning: 'Cloudinary is unavailable, so this portrait is stored temporarily on the backend.'
        };
    }
}

async function deleteImage(member) {
    if (member.image_storage === 'local') {
        const filename = member.image_storage_key;
        if (!filename || path.basename(filename) !== filename) {
            throw new Error('The local portrait storage key is invalid.');
        }
        try {
            await fs.unlink(path.join(localImageDirectory, filename));
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        return;
    }

    if (!member.image_public_id) return;
    const result = await getCloudinary().uploader.destroy(member.image_public_id, {
        invalidate: true,
        resource_type: 'image'
    });
    if (!['ok', 'not found'].includes(result.result)) {
        throw new Error(`Cloudinary could not remove image ${member.image_public_id}.`);
    }
}

module.exports = { uploadPortrait, deleteImage, localImageDirectory };
