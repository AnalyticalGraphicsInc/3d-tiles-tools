'use strict';
const path = require('path');
const validateB3dm = require('./validateB3dm');
const validateCmpt = require('./validateCmpt');
const validateI3dm = require('./validateI3dm');
const validatePnts = require('./validatePnts');
const validateGlb = require('../lib/validateGlb');
const validateGltf = require('../lib/validateGltf');

module.exports = validateTile;

/**
 * Check if the tile's content is valid.
 *
 * @param {Object} options An object with the following properties:
 * @param {Buffer} options.content A buffer containing the contents of the tile.
 * @param {String} options.filePath The tile's file path.
 * @param {String} options.directory The tile's directory.
 * @param {Object} options.reader The resource reader.
 * @param {Boolean} [options.writeReports=false] Write glTF error report next to the glTF file in question.
 * @returns {Promise} A promise that resolves when the validation completes. If the validation fails, the promise will resolve to an error message.
 */
async function validateTile(options) {
    if (path.extname(options.filePath) === '.gltf') {
        return await validateGltf(options);
    }
    const content = options.content;
    if (content.length < 4) {
        return `Cannot determine tile format from tile header, tile content is ${content.length} bytes.`;
    }
    const magic = content.toString('utf8', 0, 4);
    if (magic === 'b3dm') {
        return await validateB3dm(options);
    } else if (magic === 'i3dm') {
        return await validateI3dm(options);
    } else if (magic === 'pnts') {
        return await validatePnts(options);
    } else if (magic === 'cmpt') {
        return await validateCmpt(options);
    } else if (magic === 'glTF') {
        return await validateGlb(options);
    }
    return `Invalid magic: ${magic}`;
}
