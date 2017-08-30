'use strict';
var validateB3dm = require('../../lib/validateB3dm');
var specUtility = require('./specUtility.js');
var path = require('path');
var fs = require('fs');

var createB3dm = specUtility.createB3dm;
var createB3dmLegacy1 = specUtility.createB3dmLegacy1;
var createB3dmLegacy2 = specUtility.createB3dmLegacy2;

describe('validate b3dm', function() {
    it ('returns error message if the b3dm buffer\'s byte length is less than its header length', function() {
        expect(validateB3dm(Buffer.alloc(0))).toBe('Header must be 28 bytes.');
    });

    it('returns error message if the b3dm has invalid magic', function() {
        var b3dm = createB3dm();
        b3dm.write('xxxx', 0);
        expect(validateB3dm(b3dm)).toBe('Invalid magic: xxxx');
    });

    it('returns error message if the b3dm has an invalid version', function() {
        var b3dm = createB3dm();
        b3dm.writeUInt32LE(10, 4);
        expect(validateB3dm(b3dm)).toBe('Invalid version: 10. Version must be 1.');
    });

    it('returns error message if the b3dm has wrong byteLength', function() {
        var b3dm = createB3dm();
        b3dm.writeUInt32LE(0, 8);
        var message = validateB3dm(b3dm);
        expect(message).toBeDefined();
        expect(message.indexOf('byteLength of 0 does not equal the tile\'s actual byte length of') === 0).toBe(true);
    });

    it('returns error message if the b3dm header is a legacy version (1)', function() {
        expect(validateB3dm(createB3dmLegacy1())).toBe('Header is using the legacy format [batchLength] [batchTableByteLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength].');
    });

    it('returns error message if the b3dm header is a legacy version (2)', function() {
        expect(validateB3dm(createB3dmLegacy2())).toBe('Header is using the legacy format [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]. The new format is [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength].');
    });

    it('returns error message if the feature table binary is not aligned to an 8-byte boundary', function() {
        var b3dm = createB3dm({
            unalignedFeatureTableBinary : true
        });
        expect(validateB3dm(b3dm)).toBe('Feature table binary must be aligned to an 8-byte boundary.');
    });

    it('returns error message if the batch table binary is not aligned to an 8-byte boundary', function() {
        var b3dm = createB3dm({
            unalignedBatchTableBinary : true
        });
        expect(validateB3dm(b3dm)).toBe('Batch table binary must be aligned to an 8-byte boundary.');
    });

    it('returns error message if the glb is not aligned to an 8-byte boundary', function() {
        var b3dm = createB3dm({
            unalignedGlb : true
        });
        expect(validateB3dm(b3dm)).toBe('Glb must be aligned to an 8-byte boundary.');
    });

    it('returns error message if the byte lengths in the header exceed the tile\'s byte length', function() {
        var b3dm = createB3dm();
        b3dm.writeUInt32LE(60, 12);
        expect(validateB3dm(b3dm)).toBe('Feature table, batch table, and glb byte lengths exceed the tile\'s byte length.');
    });

    it('returns error message if feature table JSON could not be parsed: ', function() {
        var b3dm = createB3dm();
        var charCode = '!'.charCodeAt(0);
        b3dm.writeUInt8(charCode, 28); // Replace '{' with '!'
        expect(validateB3dm(b3dm)).toBe('Feature table JSON could not be parsed: Unexpected token ! in JSON at position 0');
    });

    it('returns error message if batch table JSON could not be parsed: ', function() {
        var b3dm = createB3dm({
            featureTableJson : {
                BATCH_LENGTH : 1
            },
            batchTableJson : {
                height : [0.0]
            }
        });
        var featureTableJsonByteLength = b3dm.readUInt32LE(12);
        var featureTableBinaryByteLength = b3dm.readUInt32LE(16);
        var batchTableJsonByteOffset = 28 + featureTableJsonByteLength + featureTableBinaryByteLength;
        var charCode = '!'.charCodeAt(0);
        b3dm.writeUInt8(charCode, batchTableJsonByteOffset); // Replace '{' with '!'
        expect(validateB3dm(b3dm)).toBe('Batch table JSON could not be parsed: Unexpected token ! in JSON at position 0');
    });

    it('returns error message if feature table does not contain a BATCH_LENGTH property: ', function() {
        var b3dm = createB3dm({
            featureTableJson : {
                PROPERTY : 0
            }
        });
        expect(validateB3dm(b3dm)).toBe('Feature table must contain a BATCH_LENGTH property.');
    });

    it('returns error message if feature table is invalid', function() {
        var b3dm = createB3dm({
            featureTableJson : {
                BATCH_LENGTH : 0,
                INVALID : 0
            }
        });
        expect(validateB3dm(b3dm)).toBe('Invalid feature table property "INVALID".');
    });

    it('returns error message if batch table is invalid', function() {
        var b3dm = createB3dm({
            featureTableJson : {
                BATCH_LENGTH : 1
            },
            batchTableJson : {
                height : {
                    byteOffset : 0,
                    type : 'SCALAR',
                    componentType : 'FLOAT'
                }
            }
        });

        expect(validateB3dm(b3dm)).toBe('Batch table binary property "height" exceeds batch table binary byte length.');
    });

    it('succeeds for valid b3dm with _BATCHID less than BATCH_LENGTH - 1 ', function() {
        var b3dmToGlbFilePath = path.join(__dirname, '../data/Tileset/extractedGlbToB3dmV2.b3dm');
        
        var filehandle = fs.openSync(b3dmToGlbFilePath, 'r');
        const stats = fs.statSync(b3dmToGlbFilePath);
        const fileSizeInBytes = stats.size;
        var b3dm = new Buffer(fileSizeInBytes);
        fs.readSync(filehandle, b3dm, 0, b3dm.length, 0);
        fs.closeSync(filehandle);

        expect(validateB3dm(b3dm)).toBeUndefined();
    });

    it('succeeds for valid b3dm with BATCH_LENGTH 0 and no batch table', function() {
        var b3dm = createB3dm({
            featureTableJson : {
                BATCH_LENGTH : 0
            }
        });
        expect(validateB3dm(b3dm)).toBeUndefined();
    });

    it('succeeds for valid b3dm with a feature table binary', function() {
        var b3dm = createB3dm({
            featureTableJson : {
                BATCH_LENGTH : {
                    byteOffset : 0
                }
            },
            featureTableBinary : Buffer.alloc(4)
        });
        expect(validateB3dm(b3dm)).toBeUndefined();
    });

    it('succeeds for valid b3dm with a batch table', function() {
        var b3dmToGlbFilePath = path.join(__dirname, '../data/Tileset/extractedGlbToB3dmV2.b3dm');
        
        var filehandle = fs.openSync(b3dmToGlbFilePath, 'r');
        const stats = fs.statSync(b3dmToGlbFilePath);
        const fileSizeInBytes = stats.size;
        var b3dm = new Buffer(fileSizeInBytes);
        fs.readSync(filehandle, b3dm, 0, b3dm.length, 0);
        fs.closeSync(filehandle);
        
        expect(validateB3dm(b3dm)).toBeUndefined();
    });
});
