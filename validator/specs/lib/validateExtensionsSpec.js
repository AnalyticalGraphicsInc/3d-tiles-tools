'use strict';
const Cesium = require('cesium');
const validateExtensions = require('../../lib/validateExtensions');

const clone = Cesium.clone;

const sampleTileset = {
    asset: {
        version: '1.0'
    },
    geometricError: 240,
    root: {
        boundingVolume: {
            region: [-1.3197209591796106, 0.6988424218, -1.3196390408203893, 0.6989055782, 0, 88]
        },
        geometricError: 70,
        refine: 'ADD'
    }
};

describe('validateExtensions', () => {
    it('returns error message when extensionsUsed is not an array of strings (1)', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensionsUsed = {};

        const message = validateExtensions({
            tileset: tileset
        });
        const error = 'extensionsUsed must be an array of strings';
        expect(message).toBe(error);
    });

    it('returns error message when extensionsUsed is not an array of strings (2)', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensionsUsed = ['3DTILES_content_gltf', 10];

        const message = validateExtensions({
            tileset: tileset
        });
        const error = 'extensionsUsed must be an array of strings';
        expect(message).toBe(error);
    });

    it('returns error message when extensionsRequired is not an array of strings (1)', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensionsRequired = {};

        const message = validateExtensions({
            tileset: tileset
        });
        const error = 'extensionsRequired must be an array of strings';
        expect(message).toBe(error);
    });

    it('returns error message when extensionsRequired is not an array of strings (2)', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensionsRequired = ['3DTILES_content_gltf', 10];

        const message = validateExtensions({
            tileset: tileset
        });
        const error = 'extensionsRequired must be an array of strings';
        expect(message).toBe(error);
    });

    it('returns error message when extension is not included in extensionsUsed', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensions = {
            '3DTILES_content_gltf' : {}
        };

        const message = validateExtensions({
            tileset: tileset
        });
        const error = '3DTILES_content_gltf must be included in extensionsUsed';
        expect(message).toBe(error);
    });

    it('returns error message when extension is required and is not included in extensionsRequired', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensions = {
            '3DTILES_content_gltf' : {}
        };

        tileset.extensionsUsed = ['3DTILES_content_gltf'];

        const message = validateExtensions({
            tileset: tileset
        });
        const error = '3DTILES_content_gltf must be included in extensionsRequired';
        expect(message).toBe(error);
    });

    it('validates 3DTILES_content_gltf', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensions = {
            '3DTILES_content_gltf' : {}
        };

        tileset.extensionsUsed = ['3DTILES_content_gltf'];
        tileset.extensionsRequired = ['3DTILES_content_gltf'];

        const message = validateExtensions({
            tileset: tileset
        });
        expect(message).toBeUndefined();
    });

    it('validates 3DTILES_content_gltf with glTF extensionsUsed and extensionsRequired', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensions = {
            '3DTILES_content_gltf' : {
                extensionsUsed : ['KHR_texture_transform'],
                extensionsRequired : ['KHR_texture_transform']
            }
        };

        tileset.extensionsUsed = ['3DTILES_content_gltf'];
        tileset.extensionsRequired = ['3DTILES_content_gltf'];

        const message = validateExtensions({
            tileset: tileset
        });
        expect(message).toBeUndefined();
    });

    it('returns error message when 3DTILES_content_gltf extensionsUsed is not an array of strings (1)', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensions = {
            '3DTILES_content_gltf' : {
                extensionsUsed : 'error'
            }
        };

        tileset.extensionsUsed = ['3DTILES_content_gltf'];
        tileset.extensionsRequired = ['3DTILES_content_gltf'];

        const message = validateExtensions({
            tileset: tileset
        });
        const error = 'Error in 3DTILES_content_gltf: extensionsUsed must be an array of strings';
        expect(message).toBe(error);
    });

    it('returns error message when 3DTILES_content_gltf extensionsUsed is not an array of strings (2)', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensions = {
            '3DTILES_content_gltf' : {
                extensionsUsed : ['KHR_texture_transform', 10]
            }
        };

        tileset.extensionsUsed = ['3DTILES_content_gltf'];
        tileset.extensionsRequired = ['3DTILES_content_gltf'];

        const message = validateExtensions({
            tileset: tileset
        });
        const error = 'Error in 3DTILES_content_gltf: extensionsUsed must be an array of strings';
        expect(message).toBe(error);
    });

    it('returns error message when 3DTILES_content_gltf extensionsRequired is not an array of strings (1)', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensions = {
            '3DTILES_content_gltf' : {
                extensionsRequired : 'error'
            }
        };

        tileset.extensionsUsed = ['3DTILES_content_gltf'];
        tileset.extensionsRequired = ['3DTILES_content_gltf'];

        const message = validateExtensions({
            tileset: tileset
        });
        const error = 'Error in 3DTILES_content_gltf: extensionsRequired must be an array of strings';
        expect(message).toBe(error);
    });

    it('returns error message when 3DTILES_content_gltf extensionsRequired is not an array of strings (2)', () => {
        const tileset = clone(sampleTileset, true);
        tileset.extensions = {
            '3DTILES_content_gltf' : {
                extensionsRequired : ['KHR_texture_transform', 10]
            }
        };

        tileset.extensionsUsed = ['3DTILES_content_gltf'];
        tileset.extensionsRequired = ['3DTILES_content_gltf'];

        const message = validateExtensions({
            tileset: tileset
        });
        const error = 'Error in 3DTILES_content_gltf: extensionsRequired must be an array of strings';
        expect(message).toBe(error);
    });
});
