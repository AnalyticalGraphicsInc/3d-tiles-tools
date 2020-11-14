'use strict';
const Cesium = require('cesium');
const validateTileset = require('../../lib/validateTileset');

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
        refine: 'ADD',
        children: [
            {
                boundingVolume: {
                    region: [-1.3197209591796106, 0.6988424218, -1.31968, 0.698874, 0, 20]
                },
                geometricError: 50,
                children: [
                    {
                        boundingVolume: {
                            region: [-1.3197209591796106, 0.6988424218, -1.31968, 0.698874, 0, 10]
                        },
                        geometricError: 0
                    }
                ]
            },
            {
                boundingVolume: {
                    region: [-1.31968, 0.6988424218, -1.3196390408203893, 0.698874, 0, 20]
                },
                geometricError: 0
            }
        ]
    }
};

describe('validateTileset', () => {
    it('returns error message when the geometricError is not defined', async () => {
        const tileset = clone(sampleTileset, true);
        delete tileset.root.children[0].geometricError;
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = 'Each tile must define geometricError';
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('returns error message when the geometricError is less than 0.0', async () => {
        const tileset = clone(sampleTileset, true);
        tileset.root.children[0].geometricError = -1;
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = 'geometricError must be greater than or equal to 0.0';
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('returns error message when child has geometricError greater than parent', async () => {
        const tileset = clone(sampleTileset, true);
        tileset.root.children[0].geometricError = 80;
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = 'Child has geometricError greater than parent';
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('returns error message when refine property of tile has incorrect value', async () => {
        const tileset = clone(sampleTileset, true);
        tileset.root.children[0].refine = 'NEW';
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = 'Refine property in tile must have either "ADD" or "REPLACE" as its value.';
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('returns error message when the top-level geometricError is missing', async () => {
        const tileset = clone(sampleTileset, true);
        delete tileset.geometricError;
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        expect(message).toBe('Tileset must declare its geometricError as a top-level property.');
    });

    it('returns error message when refine property is not defined in root tile', async () => {
        const tileset = clone(sampleTileset, true);
        delete tileset.root.refine;
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = 'Tileset must define refine property in root tile';
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('returns error message when the top-level asset is missing', async () => {
        const tileset = clone(sampleTileset, true);
        delete tileset.asset;
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        expect(message).toBe('Tileset must declare its asset as a top-level property.');
    });

    it('returns error message when asset.version property is missing', async () => {
        const tileset = clone(sampleTileset, true);
        delete tileset.asset.version;
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        expect(message).toBe('Tileset must declare a version in its asset property');
    });

    it('returns error message when asset.version property value is incorrect', async () => {
        const tileset = clone(sampleTileset, true);
        tileset.asset.version = '0.0';
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        expect(message).toBe(`Tileset version must be 1.0 or 2.0.0-alpha.0. Tileset version provided: ${tileset.asset.version}`);
    });

    it('returns error message when a content\'s box type boundingVolume is not within it\'s tile\'s box type boundingVolume [invalid aligned bounding boxes]', async () => {
        const tileBoundingVolume = {
            box: [
                0, 0, 0,
                7.0955, 0, 0,
                0, 3.1405, 0,
                0, 0, 5.0375
            ]
        };
        const contentBoundingVolume = {
            box: [
                0, 0, 0,
                7.0955, 0, 0,
                0, 3.1405, 0,
                0, 0, 5.04
            ]
        };
        const tileset = createSampleTileset(tileBoundingVolume, contentBoundingVolume);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = `content bounding volume is not within tile bounding volume: box [${contentBoundingVolume.box}] is not within box [${tileBoundingVolume.box}]`;
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('returns error message when a content\'s box type boundingVolume is not within it\'s tile\'s box type boundingVolume [invalid unaligned bounding boxes]', async () => {
        const tileBoundingVolume = {
            box: [
                0, 0, 0,
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            ]
        };
        const contentBoundingVolume = {
            box: [
                0, 0, 0,
                1, 1, 0,
                1, 1, 0,
                0, 0, 1
            ]
        };
        const tileset = createSampleTileset(tileBoundingVolume, contentBoundingVolume);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = `content bounding volume is not within tile bounding volume: box [${contentBoundingVolume.box}] is not within box [${tileBoundingVolume.box}]`;
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('succeeds when a content\'s box type boundingVolume is within it\'s tile\'s box type boundingVolume [valid bounding boxes]', async () => {
        const tileBoundingVolume = {
            box: [
                0, 0, 0,
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            ]
        };
        const contentBoundingVolume = {
            box: [
                0, 0, 0,
                0.5, 0.5, 0,
                0.5, 0.5, 0,
                0, 0, 1
            ]
        };
        const tileset = createSampleTileset(tileBoundingVolume, contentBoundingVolume);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        expect(message).toBeUndefined();
    });

    it('returns error message when content\'s box type boundingVolume is not within it\'s tile\'s sphere type boundingVolume', async () => {
        const tileBoundingVolume = {
            sphere: [0, 0, 0, 1]
        };
        const contentBoundingVolume = {
            box: [
                0, 0, 0,
                1, 0, 0,
                0, 0.5, 0,
                0, 0, 0.7
            ]
        };
        const tileset = createSampleTileset(tileBoundingVolume, contentBoundingVolume);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = `content bounding volume is not within tile bounding volume: box [${contentBoundingVolume.box}] is not within sphere [${tileBoundingVolume.sphere}]`;
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('succeeds when content\'s box type boundingVolume is within it\'s tile\'s sphere type boundingVolume', async () => {
        const tileBoundingVolume = {
            sphere: [0, 0, 0, 1]
        };
        const contentBoundingVolume = {
            box: [
                0, 0, 0,
                0.5, 0, 0,
                0, 0.5, 0,
                0, 0, 0.5
            ]
        };
        const tileset = createSampleTileset(tileBoundingVolume, contentBoundingVolume);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        expect(message).toBeUndefined();
    });

    it('returns error message when content\'s sphere type boundingVolume is entirely outside tile\'s box type boundingVolume', async () => {
        const tileBoundingVolume = {
            box: [
                0, 0, 0,
                7, 0, 0,
                0, 3, 0,
                0, 0, 5
            ]
        };
        const contentBoundingVolume = {
            sphere: [10, 10, 10, 1]
        };
        const tileset = createSampleTileset(tileBoundingVolume, contentBoundingVolume);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = `content bounding volume is not within tile bounding volume: sphere [${contentBoundingVolume.sphere}] is not within box [${tileBoundingVolume.box}]`;
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('returns error message when content\'s bounding sphere\'s center is within the tile\'s bounding box but it\'s radius extends beyond', async () => {
        const tileBoundingVolume = {
            box: [
                0, 0, 0,
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            ]
        };
        const contentBoundingVolume = {
            sphere: [0, 0, 0, 1.1]
        };
        const tileset = createSampleTileset(tileBoundingVolume, contentBoundingVolume);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = `content bounding volume is not within tile bounding volume: sphere [${contentBoundingVolume.sphere}] is not within box [${tileBoundingVolume.box}]`;
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('returns error message when content\'s bounding sphere\'s center is outside tile\'s bounding box and the volumes intersect', async () => {
        const tileBoundingVolume = {
            box: [
                0, 0, 0,
                7, 0, 0,
                0, 3, 0,
                0, 0, 5
            ]
        };
        const contentBoundingVolume = {
            sphere: [0, 5, 0, 3]
        };
        const tileset = createSampleTileset(tileBoundingVolume, contentBoundingVolume);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        const error = `content bounding volume is not within tile bounding volume: sphere [${contentBoundingVolume.sphere}] is not within box [${tileBoundingVolume.box}]`;
        expect(message.slice(0, error.length)).toBe(error);
    });

    it('succeeds when content\'s bounding sphere is within tile\'s bounding box', async () => {
        const tileBoundingVolume = {
            box: [
                0, 0, 0,
                7, 0, 0,
                0, 3, 0,
                0, 0, 5
            ]
        };
        const contentBoundingVolume = {
            sphere: [0, 0, 0, 2]
        };
        const tileset = createSampleTileset(tileBoundingVolume, contentBoundingVolume);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        expect(message).toBeUndefined();
    });

    it('succeeds when child\'s box type boundingVolume is completely within it\'s parents\'s box type boundingVolume', async () => {
        const parentBoundingVolume = {
            box: [
                0, 0, 0,
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            ]
        };
        const childBoundingVolume = {
            box: [
                0, 0, 0,
                0.5, 0, 0,
                0, 0.5, 0,
                0, 0, 0.5
            ]
        };
        const childTransform = {
            transform: [
                0.87, 0.5, 0, 0,
                -0.5, 0.87, 0, 0,
                0, 0 , 1, 0,
                0, 0, 0, 0
            ]
        };
        const tileset = createParentChildTileset(parentBoundingVolume, childBoundingVolume, childTransform, undefined);
        const message = await validateTileset({
            tileset: tileset,
            filePath: 'filepath',
            directory: '.'
        });
        expect(message).toBeUndefined();
    });

    it('succeeds for valid tileset', async () => {
        const message = await validateTileset({
            tileset: sampleTileset,
            filePath: 'filepath',
            directory: '.'
        });
        expect(message).toBeUndefined();
    });
});

function createSampleTileset(tileBoundingVolume, contentBoundingVolume) {
    const sampleTileset = {
        asset: {
            version: '1.0'
        },
        geometricError: 500,
        root: {
            boundingVolume: tileBoundingVolume,
            geometricError: 100,
            refine: 'ADD',
            content: {
                boundingVolume: contentBoundingVolume
            }
        }
    };
    return sampleTileset;
}

function createParentChildTileset(parentBoundingVolume, childBoundingVolume, childTransform, parentTransform) {
    const sampleTileset = {
        asset: {
            version: '1.0'
        },
        geometricError: 500,
        root: {
            transform: parentTransform,
            boundingVolume: parentBoundingVolume,
            geometricError: 100,
            refine: 'ADD',
            children: [
                {
                    transform: childTransform.transform,
                    boundingVolume: childBoundingVolume,
                    geometricError: 50,
                    refine: 'ADD'
                }
            ]
        }
    };
    return sampleTileset;
}
