'use strict';
const Cesium = require('cesium');
const path = require('path');
const fsExtra = require('fs-extra');
const validator = require('gltf-validator');
const bufferToJson = require('./bufferToJson');

const defaultValue = Cesium.defaultValue;

module.exports = validateGltf;

/**
 * Check if the gltf is valid.
 *
 * @param {Object} options An object with the following properties:
 * @param {Buffer} options.content The gltf buffer.
 * @param {String} options.filePath The tile's file path.
 * @param {String} options.directory The tile's directory.
 * @param {Object} options.reader The file reader.
 * @param {Boolean} [options.writeReports=false] Write glTF error report next to the glTF file in question.
 * @returns {Promise} A promise that resolves when the validation completes. If the validation fails, the promise will resolve to an error message.
 */
async function validateGltf(options) {
    const buffer = options.content;
    const filePath = options.filePath;
    const directory = options.directory;
    const reader = options.reader;
    const writeReports = defaultValue(options.writeReports, false);

    const gltf = bufferToJson(buffer);
    const version = gltf.asset.version;

    if (version !== '2.0') {
        return 'Invalid Gltf version: ' + version + '. Version must be 2.0';
    }

    try {
        const result = await validator.validateBytes(buffer, {
            uri: filePath,
            externalResourceFunction: (uri) =>
                new Promise((resolve, reject) => {
                    uri = path.resolve(directory, decodeURIComponent(uri));
                    reader.readBinary(uri)
                        .then(data => resolve(data))
                        .catch(error => reject(error.toString()));
                })
        });

        if (result.issues.numErrors > 0) {
            const validationText = JSON.stringify(result, null, '  ');
            if (writeReports) {
                await fsExtra.writeFile(`${filePath}_report.json`, validationText);
            }
            return validationText;
        }
    } catch (error) {
        return `glTF validation could not be performed: ${error.message}`;
    }
}
