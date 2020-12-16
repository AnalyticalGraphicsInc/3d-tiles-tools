'use strict';
const Cesium = require('cesium');

const bufferToJson = require('./bufferToJson');
const isDataUri = require('./isDataUri');
const validateBatchTable = require('./validateBatchTable');
const validateFeatureTable = require('./validateFeatureTable');
const validateGlb = require('./validateGlb');

const defined = Cesium.defined;

module.exports = validateB3dm;

const featureTableSemantics = {
    BATCH_LENGTH: {
        global: true,
        type: 'SCALAR',
        componentType: 'UNSIGNED_INT'
    },
    RTC_CENTER: {
        global: true,
        type: 'VEC3',
        componentType: 'FLOAT'
    }
};

/**
 * Checks if the provided buffer has valid b3dm tile content
 *
 * @param {Object} options An object with the following properties:
 * @param {Buffer} options.content A buffer containing the contents of a b3dm tile.
 * @param {String} options.filePath The tile's file path.
 * @param {String} options.directory The tile's directory.
 * @param {Object} options.reader The resource reader.
 * @param {Boolean} [options.writeReports=false] Write glTF error report next to the glTF file in question.
 * @returns {Promise} A promise that resolves when the validation completes. If the validation fails, the promise will resolve to an error message.
 */
async function validateB3dm(options) {
    const content = options.content;

    const headerByteLength = 28;
    if (content.length < headerByteLength) {
        return 'Header must be 28 bytes.';
    }

    const magic = content.toString('utf8', 0, 4);
    const version = content.readUInt32LE(4);
    const byteLength = content.readUInt32LE(8);
    const featureTableJsonByteLength = content.readUInt32LE(12);
    const featureTableBinaryByteLength = content.readUInt32LE(16);
    const batchTableJsonByteLength = content.readUInt32LE(20);
    const batchTableBinaryByteLength = content.readUInt32LE(24);

    if (magic !== 'b3dm') {
        return `Invalid magic: ${magic}`;
    }

    if (version !== 1) {
        return `Invalid version: ${version}. Version must be 1.`;
    }

    if (byteLength !== content.length) {
        return `byteLength of ${byteLength} does not equal the tile\'s actual byte length of ${content.length}.`;
    }

    if (byteLength % 8 > 0) {
        return `byteLength of ${byteLength} must be aligned to an 8-byte boundary.`;
    }

    // Legacy header #1: [batchLength] [batchTableByteLength]
    // Legacy header #2: [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]
    // Current header: [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength]
    // If the header is in the first legacy format 'batchTableJsonByteLength' will be the start of the JSON string (a quotation mark) or the glTF magic.
    // Accordingly its first byte will be either 0x22 or 0x67, and so the minimum uint32 expected is 0x22000000 = 570425344 = 570MB. It is unlikely that the batch table JSON will exceed this length.
    // The check for the second legacy format is similar, except it checks 'batchTableBinaryByteLength' instead
    if (batchTableJsonByteLength >= 570425344) {
        return 'Header is using the legacy format [batchLength] [batchTableByteLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength].';
    } else if (batchTableBinaryByteLength >= 570425344) {
        return 'Header is using the legacy format [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength].';
    }

    const featureTableJsonByteOffset = headerByteLength;
    const featureTableBinaryByteOffset = featureTableJsonByteOffset + featureTableJsonByteLength;
    const batchTableJsonByteOffset = featureTableBinaryByteOffset + featureTableBinaryByteLength;
    const batchTableBinaryByteOffset = batchTableJsonByteOffset + batchTableJsonByteLength;
    const glbByteOffset = batchTableBinaryByteOffset + batchTableBinaryByteLength;
    let glbByteLength = Math.max(byteLength - glbByteOffset, 0);

    if (featureTableBinaryByteOffset % 8 > 0) {
        return 'Feature table Json must end on an 8-byte boundary.';
    }

    if (batchTableJsonByteOffset % 8 > 0) {
        return 'Feature table binary must end on an 8-byte boundary.';
    }

    if (batchTableBinaryByteOffset % 8 > 0) {
        return 'Batch table Json must end on an 8-byte boundary.';
    }

    if (glbByteOffset % 8 > 0) {
        return 'Batch table binary must end on an 8-byte boundary.';
    }

    if (headerByteLength + featureTableJsonByteLength + featureTableBinaryByteLength + batchTableJsonByteLength + batchTableBinaryByteLength + glbByteLength > byteLength) {
        return 'Feature table, batch table, and glb byte lengths exceed the tile\'s byte length.';
    }

    const featureTableJsonBuffer = content.slice(featureTableJsonByteOffset, featureTableBinaryByteOffset);
    const featureTableBinary = content.slice(featureTableBinaryByteOffset, batchTableJsonByteOffset);
    const batchTableJsonBuffer = content.slice(batchTableJsonByteOffset, batchTableBinaryByteOffset);
    const batchTableBinary = content.slice(batchTableBinaryByteOffset, glbByteOffset);

    glbByteLength = content.readUInt32LE(glbByteOffset + 8);
    const glb = content.slice(glbByteOffset, glbByteOffset + glbByteLength);

    let featureTableJson;
    let batchTableJson;

    try {
        featureTableJson = bufferToJson(featureTableJsonBuffer);
    } catch (error) {
        return `Feature table JSON could not be parsed: ${error.message}`;
    }

    try {
        batchTableJson = bufferToJson(batchTableJsonBuffer);
    } catch (error) {
        return `Batch table JSON could not be parsed: ${error.message}`;
    }

    const featuresLength = featureTableJson.BATCH_LENGTH;
    if (!defined(featuresLength)) {
        return 'Feature table must contain a BATCH_LENGTH property.';
    }

    const featureTableMessage = validateFeatureTable(featureTableJson, featureTableBinary, featuresLength, featureTableSemantics);
    if (defined(featureTableMessage)) {
        return featureTableMessage;
    }

    const batchTableMessage = validateBatchTable(batchTableJson, batchTableBinary, featuresLength);
    if (defined(batchTableMessage)) {
        return batchTableMessage;
    }

    const filePath = isDataUri(options.filePath) ? options.filePath : `${options.filePath}.glb`;
    const glbMessage = await validateGlb({
        content: glb,
        reader: options.reader,
        filePath: filePath,
        directory: options.directory,
        writeReports: options.writeReports
    });
    if (defined(glbMessage)) {
        return glbMessage;
    }
}
