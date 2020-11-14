'use strict';
const path = require('path');
const Cesium = require('cesium');
const defaultValue = Cesium.defaultValue;
const defined = Cesium.defined;
module.exports = isTile;

const EMPTY_ARRAY = [];

/**
 * Checks whether the given file path is a tile file path.
 *
 * @param {String} filePath The file path.
 * @param {Object} [options] Options object
 * @returns {Boolean} True if the file path is a tile file path, false if not.
 */
function isTile(filePath, options) {
    const extension = path.extname(filePath);
    if (defined(options)) {
        const version = options.version;
        const tileset = options.tileset;
        const extensionsUsed = defaultValue(tileset.extensionsUsed, EMPTY_ARRAY);
        const hasContentGltfExtension = extensionsUsed.indexOf('3DTILES_content_gltf') > -1;

        // Version "2.0.0-alpha.0" was used during early development of 3D Tiles Next
        // and is included here for backwards compatibility purposes
        if (version === '2.0.0-alpha.0' || hasContentGltfExtension) {
            return (
                extension === '.gltf' ||
                extension === '.glb' ||
                extension === '.b3dm' ||
                extension === '.i3dm' ||
                extension === '.pnts' ||
                extension === '.cmpt');
        } else if (version === '1.0') {
            return (
                extension === '.b3dm' ||
                extension === '.i3dm' ||
                extension === '.pnts' ||
                extension === '.cmpt');
        }
        return false;
    }

    // if no version specified, match any
    return (
        extension === '.gltf' ||
        extension === '.glb' ||
        extension === '.b3dm' ||
        extension === '.i3dm' ||
        extension === '.pnts' ||
        extension === '.cmpt');
}
