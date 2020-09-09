#!/usr/bin/env node
'use strict';

import {
    Cartesian3,
    clone,
    defaultValue,
    defined,
    Math as CesiumMath,
    Matrix4,
    Quaternion
} from 'cesium';
import { Promise as Bluebird } from 'bluebird';
import { calculateFilenameExt } from '../lib/calculateFilenameExt';
import { createBatchTableHierarchy } from '../lib/createBatchTableHierarchy';
import { createInstancesTile } from '../lib/createInstancesTile';
import { InstanceSamplesNext } from '../lib/instanceSamplesNext';
import { GeneratorArgs } from '../lib/arguments';
import { CompositeSamplesNext } from '../lib/compositeSamplesNext';
import { BaseColorType, TranslucencyType } from '../lib/colorTypes';
import { createBuildingsTile } from '../lib/createBuildingsTile';
import { createPointCloudTile } from '../lib/createPointCloudTile';
import {
    buildingsTransform,
    buildingTemplate,
    childrenRegion,
    compositeGeometricError,
    compositeRegion,
    east,
    gzip,
    instancesAnimatedUri,
    instancesBoxLocal,
    instancesGeometricError,
    instancesLength,
    instancesModelSize,
    instancesRedUri,
    instancesRegion,
    instancesTexturedUri,
    instancesTileWidth,
    instancesTransform,
    instancesUri,
    largeGeometricError,
    latitude,
    latitudeExtent,
    llRegion,
    llTileOptions,
    longitude,
    longitudeExtent,
    lrRegion,
    lrTileOptions,
    north,
    outputDirectory,
    parentContentRegion,
    parentRegion,
    parentTileOptions,
    pointCloudGeometricError,
    pointCloudSphere,
    pointCloudSphereLocal,
    pointCloudTileWidth,
    pointCloudTransform,
    pointsLength,
    prettyJson,
    smallBoxLocal,
    smallGeometricError,
    smallRegion,
    smallSphere,
    smallSphereLocal,
    south,
    tileWidth,
    ulRegion,
    ulTileOptions,
    urRegion,
    urTileOptions,
    west
} from '../lib/constants';
import { createTilesetJsonSingle } from '../lib/createTilesetJsonSingle';
import { metersToLongitude, toCamelCase, wgs84Transform } from '../lib/utility';
import { TilesetSamplesNext } from '../lib/tilesetSamplesNext';
import { SamplesNext } from '../lib/samplesNext';

const fsExtra = require('fs-extra');
var gltfPipeline = require('gltf-pipeline');
var path = require('path');
var DataUriParser = require('datauri/parser');
var dataUriParser = new DataUriParser();
var gltfToGlb = gltfPipeline.gltfToGlb;
var gltfConversionOptions = { resourceDirectory: path.join(__dirname, '../') };

const createB3dm = require('../lib/createB3dm');
const createCmpt = require('../lib/createCmpt');
const createI3dm = require('../lib/createI3dm');
const getProperties = require('../lib/getProperties');
const saveBinary = require('../lib/saveBinary');
const saveJson = require('../lib/saveJson');

const processGlb = gltfPipeline.processGlb;

const argv = require('yargs')
    .help()
    .strict()
    .option('3d-tiles-next', {
        type: 'boolean',
        describe:
            'Export samples as 3D Tiles Next (.gltf). This flag is experimental and should not be used in production.'
    })
    .option('glb', {
        type: 'boolean',
        describe:
            'Export 3D Tiles Next in (.glb) form. Can only be used with --3d-tiles-next. This flag is experimental and should not be used in production.'
    })
    .check(function (argv) {
        if (argv.glb && !argv['3d-tiles-next']) {
            throw new Error(
                '--glb can only be used if --3d-tiles-next is also provided.'
            );
        }
        return true;
    }).argv;

var versionNumber = argv['3d-tiles-next'] ? '1.1' : '1.0';

const args: GeneratorArgs = {
    use3dTilesNext: argv['3d-tiles-next'],
    useGlb: argv['glb'],
    gltfConversionOptions: gltfConversionOptions,
    gzip: gzip,
    prettyJson: prettyJson,
    geometricError: instancesGeometricError,
    versionNumber: '1.1'
};

var promises = [
    // Batched
    createBatchedWithBatchTable(),
    createBatchedWithoutBatchTable(),
    createBatchedWithBatchTableBinary(),
    createBatchedTranslucent(),
    createBatchedTranslucentOpaqueMix(),
    createBatchedColors(),
    createBatchedColorsTranslucent(),
    createBatchedColorsMix(),
    createBatchedTextured(),
    createBatchedTexturedCompressed(),
    createBatchedWithBoundingSphere(),
    createBatchedWithTransformBox(),
    createBatchedWithTransformSphere(),
    createBatchedWithTransformRegion(),
    createBatchedWithRtcCenter(),
    createBatchedNoBatchIds(),
    createBatchedWGS84(),
    createBatchedDeprecated1(),
    createBatchedDeprecated2(),
    createBatchedExpiration(),
    createBatchedWithVertexColors(),
    createBatchedWithContentDataUri(),
    createBatchedAnimated(),
    // Point Cloud
    createPointCloudRGB(),
    createPointCloudRGBA(),
    createPointCloudRGB565(),
    createPointCloudConstantColor(),
    createPointCloudNoColor(),
    createPointCloudWGS84(),
    createPointCloudQuantized(),
    createPointCloudNormals(),
    createPointCloudNormalsOctEncoded(),
    createPointCloudQuantizedOctEncoded(),
    createPointCloudBatched(),
    createPointCloudWithPerPointProperties(),
    createPointCloudWithUnicodePropertyNames(),
    createPointCloudWithTransform(),
    createPointCloudDraco(),
    createPointCloudDracoPartial(),
    createPointCloudDracoBatched(),
    createPointCloudTimeDynamic(),
    createPointCloudTimeDynamicWithTransforms(),
    createPointCloudTimeDynamicDraco(),
    // Instanced
    createInstancedWithBatchTable(),
    createInstancedWithoutBatchTable(),
    createInstancedWithBatchTableBinary(),
    createInstancedGltfExternal(),
    createInstancedOrientation(),
    createInstancedOct32POrientation(),
    createInstancedQuantizedOct32POrientation(),
    createInstancedQuantized(),
    createInstancedScaleNonUniform(),
    createInstancedScale(),
    createInstancedRTC(),
    createInstancedWithTransform(),
    createInstancedRedMaterial(),
    createInstancedWithBatchIds(),
    createInstancedTextured(),
    createInstancedAnimated(),
    // Composite
    createComposite(),
    createCompositeOfComposite(),
    createCompositeOfInstanced(),
    // Hierarchy
    createHierarchy(),
    createHierarchyLegacy(),
    createHierarchyMultipleParents(),
    createHierarchyNoParents(),
    createHierarchyBinary(),
    // Tilesets
    createTileset(),
    createTilesetEmptyRoot(),
    createTilesetOfTilesets(),
    createTilesetWithExternalResources(),
    createTilesetRefinementMix(),
    createTilesetReplacement1(),
    createTilesetReplacement2(),
    createTilesetReplacement3(),
    createTilesetWithTransforms(),
    createTilesetWithViewerRequestVolume(),
    createTilesetReplacementWithViewerRequestVolume(),
    createTilesetSubtreeExpiration(),
    createTilesetPoints(),
    createTilesetUniform(),
    // Samples
    createDiscreteLOD(),
    createTreeBillboards(),
    createRequestVolume(),
    createExpireTileset()
];

async function main() {
    let tilesNextPromises: (() => Promise<void>)[] = [];
    if (args.use3dTilesNext) {
        tilesNextPromises = [
            // Instanced
            async () => InstanceSamplesNext.createInstancedWithBatchTable(args),
            async () =>
                InstanceSamplesNext.createInstancedWithBatchTableBinary(args),
            async () => InstanceSamplesNext.createInstancedOrientation(args),
            async () =>
                InstanceSamplesNext.createInstancedScaleNonUniform(args),
            async () => InstanceSamplesNext.createInstancedScale(args),
            async () => InstanceSamplesNext.createInstancedRTC(args),
            async () => InstanceSamplesNext.createInstancedWithTransform(args),
            async () => InstanceSamplesNext.createInstancedRedMaterial(args),

            // Composite
            async () => CompositeSamplesNext.createComposite(args),
            async () => CompositeSamplesNext.createCompositeOfInstanced(args),

            // Tileset
            async () => TilesetSamplesNext.createTileset(args),
            async () => TilesetSamplesNext.createTilesetEmptyRoot(args),
            async () => TilesetSamplesNext.createTilesetOfTilesets(args),
            async () => TilesetSamplesNext.createTilesetRefinementMix(args),
            async () => TilesetSamplesNext.createTilesetReplacement1(args),
            async () => TilesetSamplesNext.createTilesetReplacement2(args),
            async () => TilesetSamplesNext.createTilesetReplacement3(args),
            async () => TilesetSamplesNext.createTilesetWithTransforms(args),
            async () =>
                TilesetSamplesNext.createTilesetWithViewerRequestVolume(args),
            async () =>
                TilesetSamplesNext.createTilesetReplacementWithViewerRequestVolume(
                    args
                ),
            async () => TilesetSamplesNext.createTilesetSubtreeExpiration(args),
            async () => TilesetSamplesNext.createTilesetPoints(args),
            async () => TilesetSamplesNext.createTilesetUniform(args),

            // Samples
            async () => SamplesNext.createDiscreteLOD(args),
            async () => SamplesNext.createTreeBillboards(args),
            async () => SamplesNext.createRequestVolume(args),
            async () => SamplesNext.createExpireTileset(args)
        ];
    }

    // 3d-tiles-next
    try {
        if (args.use3dTilesNext) {
            for (const promise of tilesNextPromises) {
                await promise();
            }
        }
    } catch (error) {
        console.log(error.message);
        console.log(error.stack);
    }

    // legacy code path
    return Bluebird.all(promises).catch(function (error) {
        console.log(error.message);
        console.log(error.stack);
    });
}

main();

function createBatchedWithBatchTable() {
    var tileOptions = {
        createBatchTable: true,
        createBatchTableExtra: true
    };
    return saveBatchedTileset('BatchedWithBatchTable', tileOptions);
}

function createBatchedWithoutBatchTable() {
    var tileOptions = {
        createBatchTable: false
    };
    return saveBatchedTileset('BatchedWithoutBatchTable', tileOptions);
}

function createBatchedWithBatchTableBinary() {
    var tileOptions = {
        createBatchTable: true,
        createBatchTableBinary: true
    };
    return saveBatchedTileset('BatchedWithBatchTableBinary', tileOptions);
}

function createBatchedTranslucent() {
    var buildingOptions = clone(buildingTemplate);
    buildingOptions.translucencyType = TranslucencyType.Translucent;
    var tileOptions = {
        buildingOptions: buildingOptions
    };
    return saveBatchedTileset('BatchedTranslucent', tileOptions);
}

function createBatchedTranslucentOpaqueMix() {
    var buildingOptions = clone(buildingTemplate);
    buildingOptions.translucencyType = TranslucencyType.Mix;
    var tileOptions = {
        buildingOptions: buildingOptions
    };
    return saveBatchedTileset('BatchedTranslucentOpaqueMix', tileOptions);
}

function createBatchedTextured() {
    var buildingOptions = clone(buildingTemplate);
    buildingOptions.baseColorType = BaseColorType.Texture;
    var tileOptions = {
        buildingOptions: buildingOptions
    };
    return saveBatchedTileset('BatchedTextured', tileOptions);
}

function createBatchedTexturedCompressed() {
    var buildingOptions = clone(buildingTemplate);
    buildingOptions.baseColorType = BaseColorType.CompressedTexture;
    var tileOptions = {
        buildingOptions: buildingOptions
    };
    return saveBatchedTileset('BatchedTexturedCompressed', tileOptions);
}

function createBatchedColors() {
    var buildingOptions = clone(buildingTemplate);
    buildingOptions.baseColorType = BaseColorType.Color;
    var tileOptions = {
        buildingOptions: buildingOptions
    };
    return saveBatchedTileset('BatchedColors', tileOptions);
}

function createBatchedColorsTranslucent() {
    var buildingOptions = clone(buildingTemplate);
    buildingOptions.baseColorType = BaseColorType.Color;
    buildingOptions.translucencyType = TranslucencyType.Translucent;
    var tileOptions = {
        buildingOptions: buildingOptions
    };
    return saveBatchedTileset('BatchedColorsTranslucent', tileOptions);
}

function createBatchedColorsMix() {
    var buildingOptions = clone(buildingTemplate);
    buildingOptions.baseColorType = BaseColorType.Color;
    buildingOptions.translucencyType = TranslucencyType.Mix;
    var tileOptions = {
        buildingOptions: buildingOptions
    };
    return saveBatchedTileset('BatchedColorsMix', tileOptions);
}

function createBatchedWithBoundingSphere() {
    var tilesetOptions = {
        sphere: smallSphere
    };
    return saveBatchedTileset(
        'BatchedWithBoundingSphere',
        undefined,
        tilesetOptions
    );
}

function createBatchedWithTransformBox() {
    var tileOptions = {
        transform: Matrix4.IDENTITY,
        relativeToCenter: false
    };
    var tilesetOptions = {
        box: smallBoxLocal,
        transform: buildingsTransform
    };
    return saveBatchedTileset(
        'BatchedWithTransformBox',
        tileOptions,
        tilesetOptions
    );
}

function createBatchedWithTransformSphere() {
    var tileOptions = {
        transform: Matrix4.IDENTITY,
        relativeToCenter: false
    };
    var tilesetOptions = {
        sphere: smallSphereLocal,
        transform: buildingsTransform
    };
    return saveBatchedTileset(
        'BatchedWithTransformSphere',
        tileOptions,
        tilesetOptions
    );
}

function createBatchedWithTransformRegion() {
    var tileOptions = {
        transform: Matrix4.IDENTITY,
        relativeToCenter: false
    };
    var tilesetOptions = {
        region: smallRegion,
        transform: buildingsTransform
    };
    return saveBatchedTileset(
        'BatchedWithTransformRegion',
        tileOptions,
        tilesetOptions
    );
}

function createBatchedWithRtcCenter() {
    var tileOptions = {
        transform: Matrix4.IDENTITY,
        relativeToCenter: false,
        rtcCenterPosition: [0.1, 0.2, 0.3]
    };
    var tilesetOptions = {
        region: smallRegion,
        transform: buildingsTransform
    };
    return saveBatchedTileset(
        'BatchedWithRtcCenter',
        tileOptions,
        tilesetOptions
    );
}

function createBatchedNoBatchIds() {
    var tileOptions = {
        useBatchIds: false
    };
    return saveBatchedTileset('BatchedNoBatchIds', tileOptions);
}

function createBatchedWGS84() {
    // Only for testing - vertices are defined directly in WGS84 causing visual artifacts due to lack of precision.
    var tileOptions = {
        relativeToCenter: false
    };
    return saveBatchedTileset('BatchedWGS84', tileOptions);
}

function createBatchedDeprecated1() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    // Save the b3dm with the deprecated 20-byte header and the glTF with the BATCHID semantic
    var tileOptions = {
        deprecated1: true,
        transform: Matrix4.IDENTITY,
        relativeToCenter: false
    };
    var tilesetOptions = {
        transform: buildingsTransform
    };
    return saveBatchedTileset(
        'BatchedDeprecated1',
        tileOptions,
        tilesetOptions
    );
}

function createBatchedDeprecated2() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    // Save the b3dm with the deprecated 24-byte header and the glTF with the BATCHID semantic
    var tileOptions = {
        deprecated2: true,
        transform: Matrix4.IDENTITY,
        relativeToCenter: false
    };
    var tilesetOptions = {
        transform: buildingsTransform
    };
    return saveBatchedTileset(
        'BatchedDeprecated2',
        tileOptions,
        tilesetOptions
    );
}

function createBatchedExpiration() {
    var tilesetOptions = {
        expire: {
            duration: 5.0
        }
    };
    return saveBatchedTileset('BatchedExpiration', undefined, tilesetOptions);
}

function createBatchedWithVertexColors() {
    var buildingOptions = clone(buildingTemplate);
    buildingOptions.baseColorType = BaseColorType.Color;
    var tileOptions = {
        buildingOptions: buildingOptions,
        useVertexColors: true
    };
    return saveBatchedTileset('BatchedWithVertexColors', tileOptions);
}

function createBatchedWithContentDataUri() {
    return saveBatchedTileset('BatchedWithContentDataUri', undefined, {
        contentDataUri: true
    });
}

function createBatchedAnimated() {
    return saveBatchedTileset('BatchedAnimated', {
        animated: true
    });
}

function createPointCloudRGB() {
    var tileOptions = {
        colorMode: 'rgb'
    };
    return savePointCloudTileset('PointCloudRGB', tileOptions);
}

function createPointCloudRGBA() {
    var tileOptions = {
        colorMode: 'rgba'
    };
    return savePointCloudTileset('PointCloudRGBA', tileOptions);
}

function createPointCloudRGB565() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        colorMode: 'rgb565'
    };
    return savePointCloudTileset('PointCloudRGB565', tileOptions);
}

function createPointCloudConstantColor() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        colorMode: 'constant'
    };
    return savePointCloudTileset('PointCloudConstantColor', tileOptions);
}

function createPointCloudNoColor() {
    var tileOptions = {
        colorMode: 'none'
    };
    return savePointCloudTileset('PointCloudNoColor', tileOptions);
}

function createPointCloudWGS84() {
    // Only for testing - positions are defined directly in WGS84 causing visual artifacts due to lack of precision.
    var tileOptions = {
        relativeToCenter: false
    };
    return savePointCloudTileset('PointCloudWGS84', tileOptions);
}

function createPointCloudQuantized() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        quantizePositions: true
    };
    return savePointCloudTileset('PointCloudQuantized', tileOptions);
}

function createPointCloudNormals() {
    var tileOptions = {
        generateNormals: true,
        shape: 'sphere'
    };
    return savePointCloudTileset('PointCloudNormals', tileOptions);
}

function createPointCloudNormalsOctEncoded() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        generateNormals: true,
        octEncodeNormals: true,
        shape: 'sphere'
    };
    return savePointCloudTileset('PointCloudNormalsOctEncoded', tileOptions);
}

function createPointCloudQuantizedOctEncoded() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        quantizePositions: true,
        generateNormals: true,
        octEncodeNormals: true,
        shape: 'sphere'
    };
    return savePointCloudTileset('PointCloudQuantizedOctEncoded', tileOptions);
}

function createPointCloudBatched() {
    var tileOptions = {
        batched: true,
        colorMode: 'none',
        shape: 'sphere',
        generateNormals: true
    };
    return savePointCloudTileset('PointCloudBatched', tileOptions);
}

function createPointCloudWithPerPointProperties() {
    var tileOptions = {
        perPointProperties: true,
        transform: Matrix4.IDENTITY,
        relativeToCenter: false
    };
    var tilesetOptions = {
        transform: pointCloudTransform,
        sphere: pointCloudSphereLocal
    };
    return savePointCloudTileset(
        'PointCloudWithPerPointProperties',
        tileOptions,
        tilesetOptions
    );
}

function createPointCloudWithUnicodePropertyNames() {
  var tileOptions = {
      perPointProperties: true,
      transform: Matrix4.IDENTITY,
      relativeToCenter: false,
      unicodePropertyNames: true
  };
  var tilesetOptions = {
      transform: pointCloudTransform,
      sphere: pointCloudSphereLocal
  };
  return savePointCloudTileset(
      'PointCloudWithUnicodePropertyNames',
      tileOptions,
      tilesetOptions
  );
}

function createPointCloudWithTransform() {
    var tileOptions = {
        transform: Matrix4.IDENTITY,
        relativeToCenter: false
    };
    var tilesetOptions = {
        transform: pointCloudTransform,
        sphere: pointCloudSphereLocal
    };
    return savePointCloudTileset(
        'PointCloudWithTransform',
        tileOptions,
        tilesetOptions
    );
}

function createPointCloudDraco() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        colorMode: 'rgb',
        shape: 'sphere',
        generateNormals: true,
        perPointProperties: true,
        draco: true
    };
    return savePointCloudTileset('PointCloudDraco', tileOptions);
}

function createPointCloudDracoPartial() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        colorMode: 'rgb',
        shape: 'sphere',
        generateNormals: true,
        perPointProperties: true,
        draco: true,
        dracoSemantics: ['POSITION']
    };
    return savePointCloudTileset('PointCloudDracoPartial', tileOptions);
}

function createPointCloudDracoBatched() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        colorMode: 'rgb',
        shape: 'sphere',
        generateNormals: true,
        batched: true,
        draco: true
    };
    return savePointCloudTileset('PointCloudDracoBatched', tileOptions);
}

function createPointCloudTimeDynamic() {
    var options = {
        useGlb: argv['glb'],
        use3dTilesNext: argv['3d-tiles-next']
    };
    return savePointCloudTimeDynamic('PointCloudTimeDynamic', options);
}

function createPointCloudTimeDynamicWithTransforms() {
    var options = {
        transform: true,
        useGlb: argv['glb'],
        use3dTilesNext: argv['3d-tiles-next']
    };
    return savePointCloudTimeDynamic(
        'PointCloudTimeDynamicWithTransform',
        options
    );
}

function createPointCloudTimeDynamicDraco() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var options = {
        draco: true
    };
    return savePointCloudTimeDynamic('PointCloudTimeDynamicDraco', options);
}

function createInstancedWithBatchTable() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        createBatchTable: true
    };
    return saveInstancedTileset('InstancedWithBatchTable', tileOptions);
}

function createInstancedWithoutBatchTable() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        createBatchTable: false
    };
    return saveInstancedTileset('InstancedWithoutBatchTable', tileOptions);
}

function createInstancedWithBatchTableBinary() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        createBatchTable: true,
        createBatchTableBinary: true
    };
    return saveInstancedTileset('InstancedWithBatchTableBinary', tileOptions);
}

function createInstancedGltfExternal() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        embed: false
    };
    return saveInstancedTileset('InstancedGltfExternal', tileOptions);
}

function createInstancedOrientation() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        orientations: true
    };
    return saveInstancedTileset('InstancedOrientation', tileOptions);
}

function createInstancedOct32POrientation() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        orientations: true,
        octEncodeOrientations: true
    };
    return saveInstancedTileset('InstancedOct32POrientation', tileOptions);
}

function createInstancedQuantized() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        quantizePositions: true
    };
    return saveInstancedTileset('InstancedQuantized', tileOptions);
}

function createInstancedQuantizedOct32POrientation() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        quantizePositions: true,
        orientations: true,
        octEncodeOrientations: true
    };
    return saveInstancedTileset(
        'InstancedQuantizedOct32POrientation',
        tileOptions
    );
}

function createInstancedScaleNonUniform() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        nonUniformScales: true
    };
    return saveInstancedTileset('InstancedScaleNonUniform', tileOptions);
}

function createInstancedScale() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        uniformScales: true
    };
    return saveInstancedTileset('InstancedScale', tileOptions);
}

function createInstancedRTC() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        relativeToCenter: true
    };
    return saveInstancedTileset('InstancedRTC', tileOptions);
}

function createInstancedWithTransform() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        transform: Matrix4.IDENTITY,
        eastNorthUp: false
    };
    var tilesetOptions = {
        transform: instancesTransform,
        box: instancesBoxLocal
    };
    return saveInstancedTileset(
        'InstancedWithTransform',
        tileOptions,
        tilesetOptions
    );
}

function createInstancedRedMaterial() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        uri: instancesRedUri
    };
    return saveInstancedTileset('InstancedRedMaterial', tileOptions);
}

function createInstancedWithBatchIds() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        batchIds: true
    };
    return saveInstancedTileset('InstancedWithBatchIds', tileOptions);
}

function createInstancedTextured() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        uri: instancesTexturedUri
    };
    return saveInstancedTileset('InstancedTextured', tileOptions);
}

function createInstancedAnimated() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tileOptions = {
        uri: instancesAnimatedUri
    };
    return saveInstancedTileset('InstancedAnimated', tileOptions);
}

function createComposite() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var i3dmOptions = {
        uri: instancesUri,
        tileWidth: instancesTileWidth,
        transform: instancesTransform,
        instancesLength: instancesLength,
        modelSize: instancesModelSize,
        eastNorthUp: true
    };

    var b3dmOptions = {
        buildingOptions: buildingTemplate,
        transform: buildingsTransform,
        relativeToCenter: true
    };

    return Bluebird.all([
        createBuildingsTile(b3dmOptions),
        createInstancesTile(i3dmOptions)
    ]).then(function (results) {
        var b3dm = results[0].b3dm;
        var i3dm = results[1].i3dm;
        var b3dmBatchTable = results[0].batchTableJson;
        var i3dmBatchTable = results[1].batchTableJson;
        return saveCompositeTileset(
            'Composite',
            [b3dm, i3dm],
            [b3dmBatchTable, i3dmBatchTable]
        );
    });
}

function createCompositeOfComposite() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var i3dmOptions = {
        uri: instancesUri,
        tileWidth: instancesTileWidth,
        transform: instancesTransform,
        instancesLength: instancesLength,
        modelSize: instancesModelSize,
        eastNorthUp: true
    };

    var b3dmOptions = {
        buildingOptions: buildingTemplate,
        transform: buildingsTransform,
        relativeToCenter: true
    };

    return Bluebird.all([
        createBuildingsTile(b3dmOptions),
        createInstancesTile(i3dmOptions)
    ]).then(function (results) {
        var b3dm = results[0].b3dm;
        var i3dm = results[1].i3dm;
        var b3dmBatchTable = results[0].batchTableJson;
        var i3dmBatchTable = results[1].batchTableJson;
        var cmpt = createCmpt([b3dm, i3dm]);
        return saveCompositeTileset(
            'CompositeOfComposite',
            [cmpt],
            [b3dmBatchTable, i3dmBatchTable]
        );
    });
}

function createCompositeOfInstanced() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var i3dmOptions1 = {
        uri: instancesUri,
        tileWidth: instancesTileWidth,
        transform: instancesTransform,
        instancesLength: instancesLength,
        modelSize: instancesModelSize,
        eastNorthUp: true,
        embed: false
    };

    var i3dmOptions2 = {
        uri: instancesUri,
        tileWidth: instancesTileWidth,
        transform: instancesTransform,
        instancesLength: instancesLength,
        modelSize: instancesModelSize,
        eastNorthUp: true,
        embed: false
    };

    return Bluebird.all([
        createInstancesTile(i3dmOptions1),
        createInstancesTile(i3dmOptions2)
    ])
        .then(function (results) {
            var i3dm1 = results[0].i3dm;
            var i3dm2 = results[1].i3dm;
            var i3dm1BatchTable = results[0].batchTableJson;
            var i3dm2BatchTable = results[1].batchTableJson;
            return saveCompositeTileset(
                'CompositeOfInstanced',
                [i3dm1, i3dm2],
                [i3dm1BatchTable, i3dm2BatchTable]
            );
        })
        .then(function () {
            var tilesetDirectory = path.join(
                outputDirectory,
                'Composite',
                'CompositeOfInstanced'
            );
            var copyPath = path.join(
                tilesetDirectory,
                path.basename(instancesUri)
            );
            return fsExtra.copy(instancesUri, copyPath);
        });
}

function saveCompositeTileset(
    tilesetName,
    tiles,
    batchTables,
    tilesetOptions?
) {
    var tilesetDirectory = path.join(outputDirectory, 'Composite', tilesetName);
    var contentUri = toCamelCase(tilesetName) + '.cmpt';
    var tilePath = path.join(tilesetDirectory, contentUri);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');

    tilesetOptions = defaultValue(tilesetOptions, {});
    tilesetOptions.contentUri = contentUri;
    tilesetOptions.geometricError = compositeGeometricError;
    if (
        !defined(tilesetOptions.region) &&
        !defined(tilesetOptions.sphere) &&
        !defined(tilesetOptions.box)
    ) {
        tilesetOptions.region = compositeRegion;
    }

    var cmpt = createCmpt(tiles);

    tilesetOptions.properties = getProperties(batchTables);
    var tilesetJson = createTilesetJsonSingle(tilesetOptions);

    return Bluebird.all([
        saveJson(tilesetPath, tilesetJson, prettyJson, gzip),
        saveBinary(tilePath, cmpt, gzip)
    ]);
}

async function saveInstancedTileset(tilesetName, tileOptions, tilesetOptions?) {
    var tilesetDirectory = path.join(outputDirectory, 'Instanced', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var use3dTilesNext = defaultValue(argv['3d-tiles-next'], false);
    var useGlb = defaultValue(argv['glb'], false);

    tileOptions = defaultValue(tileOptions, {});
    tileOptions.uri = defaultValue(tileOptions.uri, instancesUri);
    tileOptions.tileWidth = instancesTileWidth;
    tileOptions.transform = defaultValue(
        tileOptions.transform,
        instancesTransform
    );
    tileOptions.instancesLength = instancesLength;
    tileOptions.modelSize = instancesModelSize;
    tileOptions.eastNorthUp = defaultValue(tileOptions.eastNorthUp, true);
    tileOptions.use3dTilesNext = use3dTilesNext;
    tileOptions.useGlb = useGlb;

    tilesetOptions = defaultValue(tilesetOptions, {});
    var ext = calculateFilenameExt(argv['3d-tiles-next'], argv.glb, '.i3dm');

    tilesetOptions.contentUri = toCamelCase(tilesetName) + ext;
    var tilePath = path.join(tilesetDirectory, tilesetOptions.contentUri);

    tilesetOptions.geometricError = instancesGeometricError;
    if (
        !defined(tilesetOptions.region) &&
        !defined(tilesetOptions.sphere) &&
        !defined(tilesetOptions.box)
    ) {
        tilesetOptions.region = instancesRegion;
    }

    const result = await createInstancesTile(tileOptions);
    var tilesetJson = createTilesetJsonSingle(tilesetOptions);

    const i3dm = result.i3dm;
    const batchTableJson = result.batchTableJson;
    tilesetOptions.properties = getProperties(batchTableJson);
    const promises = [
        saveJson(tilesetPath, tilesetJson, prettyJson, gzip),
        saveBinary(tilePath, i3dm, gzip)
    ];
    if (tileOptions.embed === false) {
        const copyPath = path.join(
            tilesetDirectory,
            path.basename(tileOptions.uri)
        );
        promises.push(fsExtra.copy(tileOptions.uri, copyPath));
    }
    return Bluebird.all(promises);
}

function saveBatchedTileset(tilesetName, tileOptions, tilesetOptions?) {
    var tilesetDirectory = path.join(outputDirectory, 'Batched', tilesetName);

    tileOptions = defaultValue(tileOptions, {});
    tileOptions.buildingOptions = defaultValue(
        tileOptions.buildingOptions,
        buildingTemplate
    );
    tileOptions.transform = defaultValue(
        tileOptions.transform,
        buildingsTransform
    );
    tileOptions.relativeToCenter = defaultValue(
        tileOptions.relativeToCenter,
        true
    );
    tilesetOptions = defaultValue(tilesetOptions, {});

    var ext = calculateFilenameExt(argv['3d-tiles-next'], argv.glb, '.b3dm');
    tileOptions.use3dTilesNext = argv['3d-tiles-next'];
    tileOptions.useGlb = argv.glb;

    var contentUri = toCamelCase(tilesetName) + ext;
    tilesetOptions.contentUri = contentUri;
    tilesetOptions.geometricError = smallGeometricError;
    if (
        !defined(tilesetOptions.region) &&
        !defined(tilesetOptions.sphere) &&
        !defined(tilesetOptions.box)
    ) {
        tilesetOptions.region = smallRegion;
    }

    var tilePath = path.join(tilesetDirectory, contentUri);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');

    return createBuildingsTile(tileOptions).then(function (result) {
        var batchTableJson = result.batchTableJson;
        tilesetOptions.properties = getProperties(batchTableJson);
        tilesetOptions.versionNumber = versionNumber;

        if (argv['3d-tiles-next']) {
            if (argv.glb) {
                // only save tileset.json if contentDataUri is present (the glb / gltf is embedded in the tileset.json)
                if (tilesetOptions.contentDataUri) {
                    tilesetOptions.contentUri =
                        'data:model/gltf-binary;base64,' +
                        Buffer.from(result.glb).toString('base64');
                    return saveJson(
                        tilesetPath,
                        createTilesetJsonSingle(tilesetOptions),
                        prettyJson,
                        gzip
                    );
                }

                return Bluebird.all([
                    saveBinary(tilePath, result.glb, gzip),
                    saveJson(
                        tilesetPath,
                        createTilesetJsonSingle(tilesetOptions),
                        prettyJson,
                        gzip
                    )
                ]);
            }

            if (tilesetOptions.contentDataUri) {
                tilesetOptions.contentUri =
                    'data:model/gltf+json;base64,' +
                    Buffer.from(JSON.stringify(result.gltf)).toString('base64');
                return saveJson(
                    tilesetPath,
                    createTilesetJsonSingle(tilesetOptions),
                    prettyJson,
                    gzip
                );
            }

            return Bluebird.all([
                saveJson(
                    tilesetPath,
                    createTilesetJsonSingle(tilesetOptions),
                    prettyJson,
                    gzip
                ),
                saveJson(tilePath, result.gltf, prettyJson, gzip)
            ]);
        }

        // old .b3dm
        var b3dm = result.b3dm;
        if (tilesetOptions.contentDataUri) {
            var dataUri = dataUriParser.format('.b3dm', b3dm);
            tilesetOptions.contentUri = dataUri;
            return saveJson(
                tilesetPath,
                createTilesetJsonSingle(tilesetOptions),
                prettyJson,
                gzip
            );
        }

        var tilesetJson = createTilesetJsonSingle(tilesetOptions);
        return Bluebird.all([
            saveJson(tilesetPath, tilesetJson, prettyJson, gzip),
            saveBinary(tilePath, b3dm, gzip)
        ]);
    });
}

async function savePointCloudTileset(tilesetName, tileOptions, tilesetOptions?) {
    var tilesetDirectory = path.join(
        outputDirectory,
        'PointCloud',
        tilesetName
    );
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');

    tileOptions = defaultValue(tileOptions, {});
    tileOptions.tileWidth = pointCloudTileWidth;
    tileOptions.transform = defaultValue(
        tileOptions.transform,
        pointCloudTransform
    );
    tileOptions.pointsLength = pointsLength;
    tileOptions.use3dTilesNext = argv['3d-tiles-next'];

    var ext = calculateFilenameExt(argv['3d-tiles-next'], argv.glb, '.pnts');

    var contentUri = toCamelCase(tilesetName) + ext;
    var tilePath = path.join(tilesetDirectory, contentUri);

    var result = await createPointCloudTile(tileOptions);
    var batchTableJson = result.batchTableJson;
    var extensions = result.extensions;

    tilesetOptions = defaultValue(tilesetOptions, {});
    tilesetOptions.versionNumber = versionNumber;
    tilesetOptions.contentUri = contentUri;
    tilesetOptions.properties = getProperties(batchTableJson);
    tilesetOptions.geometricError = pointCloudGeometricError;
    tilesetOptions.extensions = extensions;
    if (
        !defined(tilesetOptions.region) &&
        !defined(tilesetOptions.sphere) &&
        !defined(tilesetOptions.box)
    ) {
        tilesetOptions.sphere = pointCloudSphere;
    }

    var tilesetJson = createTilesetJsonSingle(tilesetOptions);
    if (argv['3d-tiles-next'] && !argv.glb) {
        return Bluebird.all([
            saveJson(tilePath, result.gltf, prettyJson, gzip),
            saveJson(tilesetPath, tilesetJson, prettyJson, gzip)
        ]);
    }

    if (argv['3d-tiles-next'] && argv.glb) {
        return Bluebird.all([
            gltfToGlb(result.gltf, gltfConversionOptions).then(function (
                result
            ) {
                return saveBinary(tilePath, result.glb, gzip);
            }),
            saveJson(tilesetPath, tilesetJson, prettyJson, gzip)
        ]);
    }

    return Bluebird.all([
        saveJson(tilesetPath, tilesetJson, prettyJson, gzip),
        saveBinary(tilePath, result.pnts, gzip)
    ]);
}

async function savePointCloudTimeDynamic(name, options) {
    options = defaultValue(options, {});
    var useTransform = defaultValue(options.transform, false);
    var directory = path.join(outputDirectory, 'PointCloud', name);
    var use3dTilesNext = defaultValue(options.use3dTilesNext, false);
    var useGlb = defaultValue(options.useGlb, false);

    var transform = pointCloudTransform;
    var relativeToCenter = true;

    if (useTransform) {
        transform = Matrix4.IDENTITY;
        relativeToCenter = false;
    }

    var pointCloudOptions = {
        tileWidth: pointCloudTileWidth,
        pointsLength: pointsLength,
        perPointProperties: true,
        transform: transform,
        relativeToCenter: relativeToCenter,
        color: 'noise',
        shape: 'box',
        draco: options.draco,
        use3dTilesNext: use3dTilesNext,
        useGlb: useGlb
    };

    var ext = calculateFilenameExt(use3dTilesNext, useGlb, '.pnts');
    var tilePath;

    function getSaveBinaryFunction(tilePath) {
        return function (result) {
            return saveBinary(tilePath, result.glb, gzip);
        };
    }

    var tilePromises = [];

    for (var i = 0; i < 5; ++i) {
        var tileOptions = clone(pointCloudOptions);
        tileOptions.time = i * 0.1; // Seed for noise
        var result = await createPointCloudTile(tileOptions);
        tilePath = path.join(directory, i + ext);
        if (use3dTilesNext && !useGlb) {
            tilePromises.push(
                saveJson(tilePath, result.gltf, prettyJson, gzip)
            );
        } else if (useGlb) {
            tilePromises.push(
                gltfToGlb(result.gltf, gltfConversionOptions).then(
                    getSaveBinaryFunction(tilePath)
                )
            );
        } else {
            tilePromises.push(saveBinary(tilePath, result.pnts, gzip));
        }
    }

    return Bluebird.all(tilePromises);
}

function createHierarchy() {
    return createBatchTableHierarchy({
        directory: path.join(
            outputDirectory,
            'Hierarchy',
            'BatchTableHierarchy'
        ),
        transform: buildingsTransform,
        gzip: gzip,
        prettyJson: prettyJson,
        use3dTilesNext: argv['3d-tiles-next'],
        useGlb: argv.glb
    });
}

function createHierarchyLegacy() {
    if (argv['3d-tiles-next']) {
        return Promise.resolve();
    }

    return createBatchTableHierarchy({
        directory: path.join(
            outputDirectory,
            'Hierarchy',
            'BatchTableHierarchyLegacy'
        ),
        transform: buildingsTransform,
        gzip: gzip,
        prettyJson: prettyJson,
        legacy: true,
        use3dTilesNext: argv['3d-tiles-next'],
        useGlb: argv.glb
    });
}

function createHierarchyMultipleParents() {
    return createBatchTableHierarchy({
        directory: path.join(
            outputDirectory,
            'Hierarchy',
            'BatchTableHierarchyMultipleParents'
        ),
        transform: buildingsTransform,
        multipleParents: true,
        gzip: gzip,
        prettyJson: prettyJson,
        use3dTilesNext: argv['3d-tiles-next'],
        useGlb: argv.glb
    });
}

function createHierarchyNoParents() {
    return createBatchTableHierarchy({
        directory: path.join(
            outputDirectory,
            'Hierarchy',
            'BatchTableHierarchyNoParents'
        ),
        transform: buildingsTransform,
        noParents: true,
        gzip: gzip,
        prettyJson: prettyJson,
        use3dTilesNext: argv['3d-tiles-next'],
        useGlb: argv.glb
    });
}

function createHierarchyBinary() {
    return createBatchTableHierarchy({
        directory: path.join(
            outputDirectory,
            'Hierarchy',
            'BatchTableHierarchyBinary'
        ),
        transform: buildingsTransform,
        batchTableBinary: true,
        multipleParents: true,
        gzip: gzip,
        prettyJson: prettyJson,
        use3dTilesNext: argv['3d-tiles-next'],
        useGlb: argv.glb
    });
}

function saveTilesetFiles(
    tileOptions,
    tileNames,
    tilesetDirectory,
    tilesetPath,
    tilesetJson,
    saveProperties
) {
    return Bluebird.map(tileOptions, function (tileOptions, index) {
        return createBuildingsTile(tileOptions).then(function (result) {
            var b3dm = result.b3dm;
            var batchTable = result.batchTableJson;
            var tilePath = path.join(tilesetDirectory, tileNames[index]);
            return saveBinary(tilePath, b3dm, gzip).then(function () {
                return batchTable;
            });
        });
    }).then(function (batchTables) {
        if (saveProperties) {
            tilesetJson.properties = getProperties(batchTables);
        }
        return saveJson(tilesetPath, tilesetJson, prettyJson, gzip);
    });
}

function createTileset() {
    // Create a tileset with one root tile and four child tiles
    var tilesetName = 'Tileset';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileNames = ['parent.b3dm', 'll.b3dm', 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var tileOptions = [
        parentTileOptions,
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];

    var tilesetJson = {
        asset: {
            version: versionNumber,
            tilesetVersion: '1.2.3'
        },
        extras: {
            name: 'Sample Tileset'
        },
        properties: undefined,
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: parentRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            content: {
                uri: 'parent.b3dm',
                boundingVolume: {
                    region: parentContentRegion
                }
            },
            children: [
                {
                    boundingVolume: {
                        region: llRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'll.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: lrRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'lr.b3dm'
                    },
                    extras: {
                        id: 'Special Tile'
                    }
                },
                {
                    boundingVolume: {
                        region: urRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ur.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: ulRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ul.b3dm'
                    }
                }
            ]
        }
    };

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        true
    );
}

function createTilesetEmptyRoot() {
    // Create a tileset with one empty root tile and four child tiles
    var tilesetName = 'TilesetEmptyRoot';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileNames = ['ll.b3dm', 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var tileOptions = [
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: smallGeometricError,
        root: {
            boundingVolume: {
                region: childrenRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            children: [
                {
                    boundingVolume: {
                        region: llRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'll.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: lrRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'lr.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: urRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ur.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: ulRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ul.b3dm'
                    }
                }
            ]
        }
    };

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        true
    );
}

function createTilesetOfTilesets() {
    // Create a tileset that references an external tileset
    var tilesetName = 'TilesetOfTilesets';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileset2Path = path.join(tilesetDirectory, 'tileset2.json');
    var tileset3Path = path.join(tilesetDirectory, 'tileset3', 'tileset3.json');
    var llPath = path.join('tileset3', 'll.b3dm');
    var tileNames = ['parent.b3dm', llPath, 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var tileOptions = [
        parentTileOptions,
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];

    var tilesetJson = {
        asset: {
            version: versionNumber,
            tilesetVersion: '1.2.3'
        },
        properties: undefined,
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: parentRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            content: {
                uri: 'tileset2.json'
            }
        }
    };

    var tileset2Json = {
        asset: {
            version: versionNumber
        },
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: parentRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            content: {
                uri: 'parent.b3dm'
            },
            children: [
                {
                    boundingVolume: {
                        region: llRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'tileset3/tileset3.json'
                    }
                },
                {
                    boundingVolume: {
                        region: lrRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'lr.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: urRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ur.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: ulRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ul.b3dm'
                    }
                }
            ]
        }
    };

    var tileset3Json = {
        asset: {
            version: versionNumber
        },
        geometricError: smallGeometricError,
        root: {
            boundingVolume: {
                region: llRegion
            },
            geometricError: 0.0,
            refine: 'ADD',
            content: {
                uri: 'll.b3dm'
            }
        }
    };

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        true
    ).then(function () {
        return Bluebird.all([
            saveJson(tileset2Path, tileset2Json, prettyJson, gzip),
            saveJson(tileset3Path, tileset3Json, prettyJson, gzip)
        ]);
    });
}

function modifyImageUri(glb, resourceDirectory, newResourceDirectory) {
    var gltfOptions = {
        resourceDirectory: resourceDirectory,
        customStages: [
            function (gltf) {
                gltf.images[0].uri = newResourceDirectory + gltf.images[0].uri;
                return gltf;
            }
        ]
    };
    return processGlb(glb, gltfOptions).then(function (results) {
        return results.glb;
    });
}

async function createTilesetWithExternalResources() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    // Create a tileset that references an external tileset where tiles reference external resources
    var tilesetName = 'TilesetWithExternalResources';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileset2Path = path.join(tilesetDirectory, 'tileset2', 'tileset2.json');
    var glbPath = 'data/textured_box_separate/textured_box.glb';
    var glbBasePath = 'data/textured_box_separate/';
    var glbCopyPath = path.join(tilesetDirectory, 'textured_box_separate/');

    var tilePaths = [
        path.join(tilesetDirectory, 'external.b3dm'),
        path.join(tilesetDirectory, 'external.i3dm'),
        path.join(tilesetDirectory, 'embed.i3dm'),
        path.join(tilesetDirectory, 'tileset2', 'external.b3dm'),
        path.join(tilesetDirectory, 'tileset2', 'external.i3dm'),
        path.join(tilesetDirectory, 'tileset2', 'embed.i3dm')
    ];

    var offset = metersToLongitude(20, latitude);
    var transforms = [
        Matrix4.pack(
            wgs84Transform(
                longitude + offset * 3,
                latitude,
                instancesModelSize / 2.0
            ),
            new Array(16)
        ),
        Matrix4.pack(
            wgs84Transform(
                longitude + offset * 2,
                latitude,
                instancesModelSize / 2.0
            ),
            new Array(16)
        ),
        Matrix4.pack(
            wgs84Transform(
                longitude + offset,
                latitude,
                instancesModelSize / 2.0
            ),
            new Array(16)
        ),
        Matrix4.pack(
            wgs84Transform(longitude, latitude, instancesModelSize / 2.0),
            new Array(16)
        ),
        Matrix4.pack(
            wgs84Transform(
                longitude - offset,
                latitude,
                instancesModelSize / 2.0
            ),
            new Array(16)
        ),
        Matrix4.pack(
            wgs84Transform(
                longitude - offset * 2,
                latitude,
                instancesModelSize / 2.0
            ),
            new Array(16)
        )
    ];

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        geometricError: smallGeometricError,
        root: {
            boundingVolume: {
                region: smallRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            children: [
                {
                    boundingVolume: {
                        region: smallRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    content: {
                        uri: 'tileset2/tileset2.json'
                    }
                },
                {
                    boundingVolume: {
                        region: smallRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    content: {
                        uri: 'external.b3dm'
                    },
                    transform: transforms[0]
                },
                {
                    boundingVolume: {
                        region: smallRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    content: {
                        uri: 'external.i3dm'
                    },
                    transform: transforms[1]
                },
                {
                    boundingVolume: {
                        region: smallRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    content: {
                        uri: 'embed.i3dm'
                    },
                    transform: transforms[2]
                }
            ]
        }
    };

    var tileset2Json = {
        asset: {
            version: versionNumber
        },
        geometricError: smallGeometricError,
        root: {
            boundingVolume: {
                region: smallRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            children: [
                {
                    boundingVolume: {
                        region: smallRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    content: {
                        uri: 'external.b3dm'
                    },
                    transform: transforms[3]
                },
                {
                    boundingVolume: {
                        region: smallRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    content: {
                        uri: 'external.i3dm'
                    },
                    transform: transforms[4]
                },
                {
                    boundingVolume: {
                        region: smallRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    content: {
                        uri: 'embed.i3dm'
                    },
                    transform: transforms[5]
                }
            ]
        }
    };

    // Simple i3dm
    var featureTableBinary = Buffer.alloc(12, 0); // [0, 0, 0]
    var featureTableJson = {
        INSTANCES_LENGTH: 1,
        POSITION: {
            byteOffset: 0
        }
    };

    const glb = await fsExtra.readFile(glbPath)

    const glbs = (await Promise.all([
        modifyImageUri(glb, glbBasePath, 'textured_box_separate/'),
        modifyImageUri(glb, glbBasePath, '../textured_box_separate/')
    ])) as Buffer[];

    const tiles = [
        createB3dm({
            glb: glbs[0]
        }),
        createI3dm({
            featureTableJson: featureTableJson,
            featureTableBinary: featureTableBinary,
            uri: 'textured_box_separate/textured_box.glb'
        }),
        createI3dm({
            featureTableJson: featureTableJson,
            featureTableBinary: featureTableBinary,
            glb: glbs[0]
        }),
        createB3dm({
            glb: glbs[1]
        }),
        createI3dm({
            featureTableJson: featureTableJson,
            featureTableBinary: featureTableBinary,
            uri: '../textured_box_separate/textured_box.glb'
        }),
        createI3dm({
            featureTableJson: featureTableJson,
            featureTableBinary: featureTableBinary,
            glb: glbs[1]
        })
    ];

    for (let i = 0; i < tiles.length; ++i) {
        const tile = tiles[i];
        await saveBinary(tilePaths[i], tile, gzip);
    }

    await saveJson(tilesetPath, tilesetJson, prettyJson, gzip);
    await saveJson(tileset2Path, tileset2Json, prettyJson, gzip);
    await fsExtra.copy(glbBasePath, glbCopyPath);
}

function createTilesetRefinementMix() {
    // Create a tileset with a mix of additive and replacement refinement
    // A - add
    // R - replace
    //          A
    //      A       R (not rendered)
    //    R   A   R   A
    var tilesetName = 'TilesetRefinementMix';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileNames = ['parent.b3dm', 'll.b3dm', 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var tileOptions = [
        parentTileOptions,
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: parentRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            content: {
                uri: 'parent.b3dm',
                boundingVolume: {
                    region: parentContentRegion
                }
            },
            children: [
                {
                    boundingVolume: {
                        region: parentContentRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'REPLACE',
                    content: {
                        uri: 'parent.b3dm'
                    },
                    children: [
                        {
                            boundingVolume: {
                                region: llRegion
                            },
                            geometricError: 0.0,
                            refine: 'ADD',
                            content: {
                                uri: 'll.b3dm'
                            }
                        },
                        {
                            boundingVolume: {
                                region: urRegion
                            },
                            geometricError: 0.0,
                            refine: 'REPLACE',
                            content: {
                                uri: 'ur.b3dm'
                            }
                        }
                    ]
                },
                {
                    boundingVolume: {
                        region: parentContentRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    content: {
                        uri: 'parent.b3dm'
                    },
                    children: [
                        {
                            boundingVolume: {
                                region: ulRegion
                            },
                            geometricError: 0.0,
                            refine: 'ADD',
                            content: {
                                uri: 'ul.b3dm'
                            }
                        },
                        {
                            boundingVolume: {
                                region: lrRegion
                            },
                            geometricError: 0.0,
                            refine: 'REPLACE',
                            content: {
                                uri: 'lr.b3dm'
                            }
                        }
                    ]
                }
            ]
        }
    };

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        true
    );
}

function createTilesetReplacement1() {
    // No children have content, but all grandchildren have content. Root uses replacement refinement.
    // C - content
    // E - empty
    //          C
    //      E       E
    //    C   C   C   C
    var tilesetName = 'TilesetReplacement1';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileNames = ['parent.b3dm', 'll.b3dm', 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var tileOptions = [
        parentTileOptions,
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: parentRegion
            },
            geometricError: smallGeometricError,
            refine: 'REPLACE',
            content: {
                uri: 'parent.b3dm',
                boundingVolume: {
                    region: parentContentRegion
                }
            },
            children: [
                {
                    boundingVolume: {
                        region: childrenRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    children: [
                        {
                            boundingVolume: {
                                region: llRegion
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'll.b3dm'
                            }
                        },
                        {
                            boundingVolume: {
                                region: urRegion
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'ur.b3dm'
                            }
                        }
                    ]
                },
                {
                    boundingVolume: {
                        region: childrenRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    children: [
                        {
                            boundingVolume: {
                                region: lrRegion
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'lr.b3dm'
                            }
                        },
                        {
                            boundingVolume: {
                                region: ulRegion
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'ul.b3dm'
                            }
                        }
                    ]
                }
            ]
        }
    };

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        true
    );
}

function createTilesetReplacement2() {
    //          C
    //          E
    //        C   E
    //            C (smaller geometric error)
    //
    var tilesetName = 'TilesetReplacement2';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileNames = ['parent.b3dm', 'll.b3dm', 'ur.b3dm'];
    var tileOptions = [parentTileOptions, llTileOptions, urTileOptions];

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: parentRegion
            },
            geometricError: smallGeometricError,
            refine: 'REPLACE',
            content: {
                uri: 'parent.b3dm',
                boundingVolume: {
                    region: parentContentRegion
                }
            },
            children: [
                {
                    boundingVolume: {
                        region: childrenRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    children: [
                        {
                            boundingVolume: {
                                region: urRegion
                            },
                            geometricError: 7.0,
                            refine: 'REPLACE',
                            children: [
                                {
                                    boundingVolume: {
                                        region: urRegion
                                    },
                                    geometricError: 0.0,
                                    content: {
                                        uri: 'ur.b3dm'
                                    }
                                }
                            ]
                        },
                        {
                            boundingVolume: {
                                region: llRegion
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'll.b3dm'
                            }
                        }
                    ]
                }
            ]
        }
    };

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        true
    );
}

function createTilesetReplacement3() {
    //          C
    //          T (external tileset ref)
    //          E (root of external tileset)
    //     C  C  C  C
    var tilesetName = 'TilesetReplacement3';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileset2Path = path.join(tilesetDirectory, 'tileset2.json');
    var tileNames = ['parent.b3dm', 'll.b3dm', 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var tileOptions = [
        parentTileOptions,
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: parentRegion
            },
            geometricError: smallGeometricError,
            refine: 'REPLACE',
            content: {
                uri: 'parent.b3dm',
                boundingVolume: {
                    region: parentContentRegion
                }
            },
            children: [
                {
                    boundingVolume: {
                        region: childrenRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'ADD',
                    content: {
                        uri: 'tileset2.json'
                    }
                }
            ]
        }
    };

    var tileset2Json = {
        asset: {
            version: versionNumber
        },
        geometricError: smallGeometricError,
        root: {
            boundingVolume: {
                region: childrenRegion
            },
            geometricError: smallGeometricError,
            refine: 'REPLACE',
            children: [
                {
                    boundingVolume: {
                        region: llRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'll.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: lrRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'lr.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: urRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ur.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: ulRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ul.b3dm'
                    }
                }
            ]
        }
    };

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        true
    ).then(function () {
        return saveJson(tileset2Path, tileset2Json, prettyJson, gzip);
    });
}

function createTilesetWithTransforms() {
    var tilesetName = 'TilesetWithTransforms';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var buildingsTileName = 'buildings.b3dm';
    var buildingsTilePath = path.join(tilesetDirectory, buildingsTileName);
    var instancesTileName = 'instances.i3dm';
    var instancesTilePath = path.join(tilesetDirectory, instancesTileName);

    var rootTransform = Matrix4.pack(buildingsTransform, new Array(16));

    var rotation = Quaternion.fromAxisAngle(
        Cartesian3.UNIT_Z,
        CesiumMath.PI_OVER_FOUR
    );
    var translation = new Cartesian3(0, 0, 5.0);
    var scale = new Cartesian3(0.5, 0.5, 0.5);
    var childMatrix = Matrix4.fromTranslationQuaternionRotationScale(
        translation,
        rotation,
        scale
    );
    var childTransform = Matrix4.pack(childMatrix, new Array(16));

    var instancesOptions = {
        tileWidth: instancesTileWidth,
        transform: Matrix4.IDENTITY,
        instancesLength: instancesLength,
        uri: instancesUri,
        modelSize: instancesModelSize,
        eastNorthUp: false
    };

    var buildingsOptions = {
        buildingOptions: buildingTemplate,
        transform: Matrix4.IDENTITY
    };

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: smallGeometricError,
        root: {
            boundingVolume: {
                box: smallBoxLocal
            },
            transform: rootTransform,
            geometricError: instancesGeometricError,
            refine: 'ADD',
            content: {
                uri: buildingsTileName
            },
            children: [
                {
                    boundingVolume: {
                        box: instancesBoxLocal
                    },
                    transform: childTransform,
                    geometricError: 0.0,
                    content: {
                        uri: instancesTileName
                    }
                }
            ]
        }
    };

    return Bluebird.all([
        createInstancesTile(instancesOptions),
        createBuildingsTile(buildingsOptions)
    ]).then(function (results) {
        var i3dm = results[0].i3dm;
        var b3dm = results[1].b3dm;
        return Bluebird.all([
            saveBinary(instancesTilePath, i3dm, gzip),
            saveBinary(buildingsTilePath, b3dm, gzip),
            saveJson(tilesetPath, tilesetJson, prettyJson, gzip)
        ]);
    });
}

async function createTilesetWithViewerRequestVolume() {
    // Create a tileset with one root tile and four child tiles
    var tilesetName = 'TilesetWithViewerRequestVolume';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileNames = ['ll.b3dm', 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var tileOptions = [
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];
    var pointCloudTileName = 'points.pnts';
    var pointCloudTilePath = path.join(tilesetDirectory, pointCloudTileName);

    var pointsLength = 1000;
    var pointCloudTileWidth = 20.0;
    var pointCloudRadius = pointCloudTileWidth / 2.0;
    var pointCloudSphereLocal = [0.0, 0.0, 0.0, pointCloudRadius];
    var pointCloudHeight = pointCloudRadius + 5.0;
    var pointCloudMatrix = wgs84Transform(
        longitude,
        latitude,
        pointCloudHeight
    );
    var pointCloudTransform = Matrix4.pack(pointCloudMatrix, new Array(16));
    var pointCloudViewerRequestSphere = [
        0.0,
        0.0,
        0.0,
        pointCloudTileWidth * 50.0
    ]; // Point cloud only become visible when you are inside the request volume

    var pointCloudOptions = {
        tileWidth: pointCloudTileWidth,
        pointsLength: pointsLength,
        transform: Matrix4.IDENTITY,
        shape: 'sphere'
    };

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: childrenRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            children: [
                {
                    boundingVolume: {
                        region: llRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'll.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: lrRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'lr.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: urRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ur.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: ulRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ul.b3dm'
                    }
                },
                {
                    transform: pointCloudTransform,
                    viewerRequestVolume: {
                        sphere: pointCloudViewerRequestSphere
                    },
                    boundingVolume: {
                        sphere: pointCloudSphereLocal
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'points.pnts'
                    }
                }
            ]
        }
    };

    var pnts = (await createPointCloudTile(pointCloudOptions)).pnts;

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        false
    ).then(function () {
        return saveBinary(pointCloudTilePath, pnts, gzip);
    });
}

function createTilesetReplacementWithViewerRequestVolume() {
    var tilesetName = 'TilesetReplacementWithViewerRequestVolume';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileNames = ['parent.b3dm', 'll.b3dm', 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var tileOptions = [
        parentTileOptions,
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];

    var requestHeight = 50.0;
    var childRequestRegion = [
        longitude - longitudeExtent / 2.0,
        latitude - latitudeExtent / 2.0,
        longitude + longitudeExtent / 2.0,
        latitude + latitudeExtent / 2.0,
        0.0,
        requestHeight
    ];

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: parentRegion
            },
            geometricError: largeGeometricError,
            refine: 'REPLACE',
            children: [
                {
                    boundingVolume: {
                        region: parentRegion
                    },
                    geometricError: smallGeometricError,
                    refine: 'REPLACE',
                    content: {
                        uri: 'parent.b3dm',
                        boundingVolume: {
                            region: parentContentRegion
                        }
                    },
                    children: [
                        {
                            boundingVolume: {
                                region: llRegion
                            },
                            viewerRequestVolume: {
                                region: childRequestRegion
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'll.b3dm'
                            }
                        },
                        {
                            boundingVolume: {
                                region: lrRegion
                            },
                            viewerRequestVolume: {
                                region: childRequestRegion
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'lr.b3dm'
                            }
                        },
                        {
                            boundingVolume: {
                                region: urRegion
                            },
                            viewerRequestVolume: {
                                region: childRequestRegion
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'ur.b3dm'
                            }
                        },
                        {
                            boundingVolume: {
                                region: ulRegion
                            },
                            viewerRequestVolume: {
                                region: childRequestRegion
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'ul.b3dm'
                            }
                        }
                    ]
                }
            ]
        }
    };

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        true
    );
}

function createTilesetSubtreeExpiration() {
    var tilesetName = 'TilesetSubtreeExpiration';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var subtreePath = path.join(tilesetDirectory, 'subtree.json');
    var tileNames = ['parent.b3dm', 'll.b3dm', 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var tileOptions = [
        parentTileOptions,
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: largeGeometricError,
        root: {
            boundingVolume: {
                region: parentRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            content: {
                boundingVolume: {
                    region: parentContentRegion
                },
                uri: 'parent.b3dm'
            },
            children: [
                {
                    expire: {
                        duration: 5.0
                    },
                    boundingVolume: {
                        region: childrenRegion
                    },
                    geometricError: smallGeometricError,
                    content: {
                        uri: 'subtree.json'
                    }
                }
            ]
        }
    };

    var subtreeJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: smallGeometricError,
        root: {
            boundingVolume: {
                region: childrenRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            children: [
                {
                    boundingVolume: {
                        region: llRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'll.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: lrRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'lr.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: urRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ur.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: ulRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ul.b3dm'
                    }
                }
            ]
        }
    };

    return Bluebird.all([
        saveTilesetFiles(
            tileOptions,
            tileNames,
            tilesetDirectory,
            tilesetPath,
            tilesetJson,
            true
        ),
        saveJson(subtreePath, subtreeJson, prettyJson, gzip)
    ]);
}

async function createTilesetPoints() {
    // Create a tileset with one root tile and eight child tiles
    var tilesetName = 'TilesetPoints';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');

    var pointsLength = 1000;
    var parentTileWidth = 10.0;
    var parentTileHalfWidth = parentTileWidth / 2.0;
    var parentGeometricError = 1.732 * parentTileWidth; // Diagonal of the point cloud box
    var parentMatrix = wgs84Transform(longitude, latitude, parentTileHalfWidth);
    var parentTransform = Matrix4.pack(parentMatrix, new Array(16));
    var parentBoxLocal = [
        0.0,
        0.0,
        0.0, // center
        parentTileHalfWidth,
        0.0,
        0.0, // width
        0.0,
        parentTileHalfWidth,
        0.0, // depth
        0.0,
        0.0,
        parentTileHalfWidth // height
    ];
    var parentTile = (await createPointCloudTile({
        tileWidth: parentTileWidth * 2.0,
        pointsLength: pointsLength,
        relativeToCenter: false
    })).pnts;

    var childrenJson = [];
    var childTiles = [];
    var childTileWidth = 5.0;
    var childTileHalfWidth = childTileWidth / 2.0;
    var childGeometricError = 1.732 * childTileWidth; // Diagonal of the point cloud box
    var childCenters = [
        [-childTileHalfWidth, -childTileHalfWidth, -childTileHalfWidth],
        [-childTileHalfWidth, childTileHalfWidth, childTileHalfWidth],
        [-childTileHalfWidth, -childTileHalfWidth, childTileHalfWidth],
        [-childTileHalfWidth, childTileHalfWidth, -childTileHalfWidth],
        [childTileHalfWidth, -childTileHalfWidth, -childTileHalfWidth],
        [childTileHalfWidth, childTileHalfWidth, -childTileHalfWidth],
        [childTileHalfWidth, -childTileHalfWidth, childTileHalfWidth],
        [childTileHalfWidth, childTileHalfWidth, childTileHalfWidth]
    ];

    var i;
    for (i = 0; i < 8; ++i) {
        var childCenter = childCenters[i];
        var childTransform = Matrix4.fromTranslation(
            Cartesian3.unpack(childCenter)
        );
        childTiles.push(
            (await createPointCloudTile({
                tileWidth: childTileWidth * 2.0,
                transform: childTransform,
                pointsLength: pointsLength,
                relativeToCenter: false
            })).pnts
        );
        var childBoxLocal = [
            childCenter[0],
            childCenter[1],
            childCenter[2],
            childTileHalfWidth,
            0.0,
            0.0, // width
            0.0,
            childTileHalfWidth,
            0.0, // depth
            0.0,
            0.0,
            childTileHalfWidth // height
        ];
        childrenJson.push({
            boundingVolume: {
                box: childBoxLocal
            },
            geometricError: 0.0,
            content: {
                uri: i + '.pnts'
            }
        });
    }

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: parentGeometricError,
        root: {
            boundingVolume: {
                box: parentBoxLocal
            },
            transform: parentTransform,
            geometricError: childGeometricError,
            refine: 'ADD',
            content: {
                uri: 'parent.pnts'
            },
            children: childrenJson
        }
    };

    var promises = [];
    promises.push(
        saveBinary(path.join(tilesetDirectory, 'parent.pnts'), parentTile, gzip)
    );
    for (i = 0; i < 8; ++i) {
        promises.push(
            saveBinary(
                path.join(tilesetDirectory, i + '.pnts'),
                childTiles[i],
                gzip
            )
        );
    }
    promises.push(saveJson(tilesetPath, tilesetJson, prettyJson, gzip));

    return Bluebird.all(promises);
}

function createTilesetUniform() {
    if (argv['3d-tiles-next']) {
        return Bluebird.resolve();
    }

    var tilesetName = 'TilesetUniform';
    var tilesetDirectory = path.join(outputDirectory, 'Tilesets', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var tileset2Path = path.join(tilesetDirectory, 'tileset2.json');

    // Only subdivide the middle tile in level 1. Helps reduce tileset size.
    var subdivideCallback = function (level, x, y) {
        return level === 0 || (level === 1 && x === 1 && y === 1);
    };

    var results = createUniformTileset(3, 3, subdivideCallback);
    var tileOptions = results.tileOptions;
    var tileNames = results.tileNames;
    var tilesetJson: any = results.tilesetJson;

    // Insert an external tileset
    var externalTile1 = clone(tilesetJson.root, true);
    delete externalTile1.transform;
    delete externalTile1.refine;
    delete externalTile1.children;
    externalTile1.content.uri = 'tileset2.json';

    var externalTile2 = clone(tilesetJson.root, true);
    delete externalTile2.transform;
    delete externalTile2.content;

    var tileset2Json = clone(tilesetJson, true);
    tileset2Json.root = externalTile2;
    tilesetJson.root.children = [externalTile1];

    return saveTilesetFiles(
        tileOptions,
        tileNames,
        tilesetDirectory,
        tilesetPath,
        tilesetJson,
        true
    ).then(function () {
        saveJson(tileset2Path, tileset2Json, prettyJson, gzip);
    });
}

function createUniformTileset(depth, divisions, subdivideCallback) {
    depth = Math.max(depth, 1);
    divisions = Math.max(divisions, 1);

    var tileOptions = [];
    var tileNames = [];

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: largeGeometricError
    };

    divideTile(
        0,
        0,
        0,
        divisions,
        depth,
        tilesetJson,
        tileOptions,
        tileNames,
        subdivideCallback
    );

    return {
        tilesetJson: tilesetJson,
        tileOptions: tileOptions,
        tileNames: tileNames
    };
}

function divideTile(
    level,
    x,
    y,
    divisions,
    depth,
    parent,
    tileOptions,
    tileNames,
    subdivideCallback
) {
    var uri = level + '_' + x + '_' + y + '.b3dm';
    var tilesPerAxis = Math.pow(divisions, level);

    var buildingsLength = divisions * divisions;
    var buildingsPerAxis = Math.sqrt(buildingsLength);

    var tileWidthMeters = tileWidth / tilesPerAxis;
    var tileLongitudeExtent = longitudeExtent / tilesPerAxis;
    var tileLatitudeExtent = latitudeExtent / tilesPerAxis;
    var tileHeightMeters = tileWidthMeters / (buildingsPerAxis * 3);

    var xOffset = -tileWidth / 2.0 + (x + 0.5) * tileWidthMeters;
    var yOffset = -tileWidth / 2.0 + (y + 0.5) * tileWidthMeters;
    var transform = Matrix4.fromTranslation(
        new Cartesian3(xOffset, yOffset, 0)
    );

    var west = longitude - longitudeExtent / 2.0 + x * tileLongitudeExtent;
    var south = latitude - latitudeExtent / 2.0 + y * tileLatitudeExtent;
    var east = west + tileLongitudeExtent;
    var north = south + tileLatitudeExtent;
    var tileLongitude = west + (east - west) / 2.0;
    var tileLatitude = south + (north - south) / 2.0;
    var region = [west, south, east, north, 0, tileHeightMeters];

    var isLeaf = level === depth - 1;
    var isRoot = level === 0;
    var subdivide =
        !isLeaf &&
        (!defined(subdivideCallback) || subdivideCallback(level, x, y));
    var geometricError = isLeaf
        ? 0.0
        : largeGeometricError / Math.pow(2, level + 1);
    var children = subdivide ? [] : undefined;

    var tileJson: any = {
        boundingVolume: {
            region: region
        },
        geometricError: geometricError,
        content: {
            uri: uri
        },
        children: children
    };

    if (isRoot) {
        parent.root = tileJson;
        tileJson.transform = Matrix4.pack(buildingsTransform, new Array(16));
        tileJson.refine = 'REPLACE';
    } else {
        parent.children.push(tileJson);
    }

    tileOptions.push({
        buildingOptions: {
            uniform: true,
            numberOfBuildings: buildingsLength,
            tileWidth: tileWidthMeters,
            longitude: tileLongitude,
            latitude: tileLatitude
        },
        createBatchTable: true,
        transform: transform
    });

    tileNames.push(uri);

    var nextLevel = level + 1;
    var nextX = divisions * x;
    var nextY = divisions * y;

    if (subdivide) {
        for (var i = 0; i < divisions; ++i) {
            for (var j = 0; j < divisions; ++j) {
                divideTile(
                    nextLevel,
                    nextX + i,
                    nextY + j,
                    divisions,
                    depth,
                    tileJson,
                    tileOptions,
                    tileNames,
                    subdivideCallback
                );
            }
        }
    }
}

function createDiscreteLOD() {
    var glbPaths = [
        'data/dragon_high.glb',
        'data/dragon_medium.glb',
        'data/dragon_low.glb'
    ];
    var tileNames = [
        'dragon_high.b3dm',
        'dragon_medium.b3dm',
        'dragon_low.b3dm'
    ];
    var tilesetName = 'TilesetWithDiscreteLOD';
    var tilesetDirectory = path.join(outputDirectory, 'Samples', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');

    var dragonWidth = 14.191;
    var dragonHeight = 10.075;
    var dragonDepth = 6.281;
    var dragonBox = [
        0.0,
        0.0,
        0.0, // center
        dragonWidth / 2.0,
        0.0,
        0.0, // width
        0.0,
        dragonDepth / 2.0,
        0.0, // depth
        0.0,
        0.0,
        dragonHeight / 2.0 // height
    ];

    var dragonScale = 100.0;
    var dragonOffset = (dragonHeight / 2.0) * dragonScale;
    var wgs84Matrix = wgs84Transform(longitude, latitude, dragonOffset);
    var scaleMatrix = Matrix4.fromUniformScale(dragonScale);
    var dragonMatrix = Matrix4.multiply(
        wgs84Matrix,
        scaleMatrix,
        new Matrix4()
    );
    var dragonTransform = Matrix4.pack(dragonMatrix, new Array(16));

    // At runtime a tile's geometric error is scaled by its computed scale. This doesn't apply to the top-level geometric error.
    var dragonLowGeometricError = 5.0;
    var dragonMediumGeometricError = 1.0;
    var dragonHighGeometricError = 0.1;
    var dragonTilesetGeometricError = dragonLowGeometricError * dragonScale;

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        geometricError: dragonTilesetGeometricError,
        root: {
            transform: dragonTransform,
            boundingVolume: {
                box: dragonBox
            },
            geometricError: dragonMediumGeometricError,
            refine: 'REPLACE',
            content: {
                uri: 'dragon_low.b3dm'
            },
            children: [
                {
                    boundingVolume: {
                        box: dragonBox
                    },
                    geometricError: dragonHighGeometricError,
                    content: {
                        uri: 'dragon_medium.b3dm'
                    },
                    children: [
                        {
                            boundingVolume: {
                                box: dragonBox
                            },
                            geometricError: 0.0,
                            content: {
                                uri: 'dragon_high.b3dm'
                            }
                        }
                    ]
                }
            ]
        }
    };

    var tilesBluebird = Bluebird.map(glbPaths, function (glbPath, index) {
        return fsExtra.readFile(glbPath).then(function (glb) {
            var b3dm = createB3dm({
                glb: glb
            });
            var tilePath = path.join(tilesetDirectory, tileNames[index]);
            return saveBinary(tilePath, b3dm, gzip);
        });
    });

    var tilesetBluebird = saveJson(tilesetPath, tilesetJson, prettyJson, gzip);

    return Bluebird.all([tilesBluebird, tilesetBluebird]);
}

function createTreeBillboards() {
    // Billboard effect is coded in the tree_billboard vertex shader
    var glbPaths = ['data/tree.glb', 'data/tree_billboard.glb'];
    var tileNames = ['tree.i3dm', 'tree_billboard.i3dm'];
    var tilesetName = 'TilesetWithTreeBillboards';
    var tilesetDirectory = path.join(outputDirectory, 'Samples', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');

    var treeBillboardGeometricError = 100.0;
    var treeGeometricError = 10.0;

    var treesCount = 25;
    var treesHeight = 20.0;
    var treesTileWidth = tileWidth;
    var treesRegion = [west, south, east, north, 0.0, treesHeight];

    var options = {
        tileWidth: treesTileWidth,
        instancesLength: treesCount,
        embed: true,
        modelSize: treesHeight,
        createBatchTable: true,
        eastNorthUp: true
    };

    var treeOptions = clone(options);
    treeOptions.uri = glbPaths[0];
    treeOptions.transform = wgs84Transform(longitude, latitude, 0.0); // Detailed model's base is at the origin

    var billboardOptions = clone(options);
    billboardOptions.uri = glbPaths[1];
    billboardOptions.transform = wgs84Transform(
        longitude,
        latitude,
        treesHeight / 2.0
    ); // Billboard model is centered about the origin

    var optionsArray = [treeOptions, billboardOptions];

    var tilesetJson: any = {
        asset: {
            version: versionNumber
        },
        geometricError: treeBillboardGeometricError,
        root: {
            boundingVolume: {
                region: treesRegion
            },
            geometricError: treeGeometricError,
            refine: 'REPLACE',
            content: {
                uri: 'tree_billboard.i3dm'
            },
            children: [
                {
                    boundingVolume: {
                        region: treesRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'tree.i3dm'
                    }
                }
            ]
        }
    };

    return Bluebird.map(optionsArray, function (options, index) {
        return createInstancesTile(options).then(function (result) {
            var i3dm = result.i3dm;
            var batchTable = result.batchTableJson;
            var tilePath = path.join(tilesetDirectory, tileNames[index]);
            return saveBinary(tilePath, i3dm, gzip).then(function () {
                return batchTable;
            });
        });
    }).then(function (batchTables) {
        tilesetJson.properties = getProperties(batchTables);
        return saveJson(tilesetPath, tilesetJson, prettyJson, gzip);
    });
}

async function createRequestVolume() {
    var tilesetName = 'TilesetWithRequestVolume';
    var tilesetDirectory = path.join(outputDirectory, 'Samples', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var buildingGlbPath = 'data/building.glb';
    var buildingTileName = 'building.b3dm';
    var buildingTilePath = path.join(tilesetDirectory, buildingTileName);
    var pointCloudTileName = 'points.pnts';
    var pointCloudTilePath = path.join(tilesetDirectory, pointCloudTileName);

    var cityTilesetPath = path.join(tilesetDirectory, 'city', 'tileset.json');
    var cityTileNames = ['ll.b3dm', 'lr.b3dm', 'ur.b3dm', 'ul.b3dm'];
    var cityTileOptions = [
        llTileOptions,
        lrTileOptions,
        urTileOptions,
        ulTileOptions
    ];

    var buildingWidth = 3.738;
    var buildingDepth = 3.72;
    var buildingHeight = 13.402;
    var buildingGeometricError = 100.0; // Estimate based on diagonal
    var buildingScale = 5.0;
    var wgs84Matrix = wgs84Transform(longitude, latitude, 0.0);
    var scaleMatrix = Matrix4.fromUniformScale(buildingScale);
    var buildingMatrix = Matrix4.multiply(
        wgs84Matrix,
        scaleMatrix,
        new Matrix4()
    );
    var buildingTransform = Matrix4.pack(buildingMatrix, new Array(16));
    var buildingBoxLocal = [
        0.0,
        0.0,
        buildingHeight / 2.0, // center
        buildingWidth / 2.0,
        0.0,
        0.0, // width
        0.0,
        buildingDepth / 2.0,
        0.0, // depth
        0.0,
        0.0,
        buildingHeight / 2.0 // height
    ];

    var pointsLength = 125000;
    var pointCloudTileWidth = 2.5;
    var pointCloudRadius = pointCloudTileWidth / 2.0;
    var pointCloudSphereLocal = [0.0, 0.0, 0.0, pointCloudRadius];
    var pointCloudHeight = pointCloudRadius + 0.2; // Try to place it in one of the building's floors
    var pointCloudMatrix = wgs84Transform(
        longitude,
        latitude,
        pointCloudHeight
    );
    var pointCloudTransform = Matrix4.pack(pointCloudMatrix, new Array(16));
    var pointCloudViewerRequestSphere = [
        0.0,
        0.0,
        0.0,
        pointCloudTileWidth * 6.0
    ]; // Point cloud only become visible when you are inside the request volume

    var pointCloudOptions = {
        tileWidth: pointCloudTileWidth,
        pointsLength: pointsLength,
        transform: Matrix4.IDENTITY,
        relativeToCenter: false,
        shape: 'sphere'
    };

    var totalRegion = clone(childrenRegion);
    totalRegion[5] = buildingHeight * buildingScale;

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        geometricError: buildingGeometricError,
        root: {
            boundingVolume: {
                region: totalRegion
            },
            geometricError: buildingGeometricError,
            refine: 'ADD',
            children: [
                {
                    boundingVolume: {
                        region: childrenRegion
                    },
                    geometricError: smallGeometricError,
                    content: {
                        uri: 'city/tileset.json'
                    }
                },
                {
                    transform: buildingTransform,
                    boundingVolume: {
                        box: buildingBoxLocal
                    },
                    geometricError: 0.0,
                    content: {
                        uri: buildingTileName
                    }
                },
                {
                    transform: pointCloudTransform,
                    viewerRequestVolume: {
                        sphere: pointCloudViewerRequestSphere
                    },
                    boundingVolume: {
                        sphere: pointCloudSphereLocal
                    },
                    geometricError: 0.0,
                    content: {
                        uri: pointCloudTileName
                    }
                }
            ]
        }
    };

    var cityTilesetJson = {
        asset: {
            version: versionNumber
        },
        properties: undefined,
        geometricError: smallGeometricError,
        root: {
            boundingVolume: {
                region: childrenRegion
            },
            geometricError: smallGeometricError,
            refine: 'ADD',
            children: [
                {
                    boundingVolume: {
                        region: llRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'll.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: lrRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'lr.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: urRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ur.b3dm'
                    }
                },
                {
                    boundingVolume: {
                        region: ulRegion
                    },
                    geometricError: 0.0,
                    content: {
                        uri: 'ul.b3dm'
                    }
                }
            ]
        }
    };

    var pnts = (await createPointCloudTile(pointCloudOptions)).pnts;

    var cityTilePromises = Bluebird.map(cityTileOptions, function (
        tileOptions,
        index
    ) {
        return createBuildingsTile(tileOptions).then(function (result) {
            var tilePath = path.join(
                tilesetDirectory,
                'city',
                cityTileNames[index]
            );
            return saveBinary(tilePath, result.b3dm, gzip);
        });
    });

    var buildingBluebird = fsExtra
        .readFile(buildingGlbPath)
        .then(function (glb) {
            return createB3dm({
                glb: glb
            });
        })
        .then(function (b3dm) {
            saveBinary(buildingTilePath, b3dm, gzip);
        });

    return Bluebird.all([
        cityTilePromises,
        buildingBluebird,
        saveBinary(pointCloudTilePath, pnts, gzip),
        saveJson(tilesetPath, tilesetJson, prettyJson, gzip),
        saveJson(cityTilesetPath, cityTilesetJson, prettyJson, gzip)
    ]);
}

async function createExpireTileset() {
    var tilesetName = 'TilesetWithExpiration';
    var tilesetDirectory = path.join(outputDirectory, 'Samples', tilesetName);
    var tilesetPath = path.join(tilesetDirectory, 'tileset.json');
    var pointCloudTileName = 'points.pnts';
    var pointCloudTilePath = path.join(tilesetDirectory, pointCloudTileName);

    var pointsLength = 8000;
    var pointCloudTileWidth = 200.0;
    var pointCloudSphereLocal = [0.0, 0.0, 0.0, pointCloudTileWidth / 2.0];
    var pointCloudGeometricError = 1.732 * pointCloudTileWidth; // Diagonal of the point cloud box
    var pointCloudMatrix = wgs84Transform(
        longitude,
        latitude,
        pointCloudTileWidth / 2.0
    );
    var pointCloudTransform = Matrix4.pack(pointCloudMatrix, new Array(16));

    var pointCloudOptions = {
        tileWidth: pointCloudTileWidth,
        pointsLength: pointsLength,
        perPointProperties: true,
        transform: Matrix4.IDENTITY,
        relativeToCenter: false,
        color: 'noise',
        shape: 'box'
    };

    var tilePromises = [];

    var pnts = (await createPointCloudTile(pointCloudOptions)).pnts;
    tilePromises.push(saveBinary(pointCloudTilePath, pnts, gzip));

    // Save a few tiles for the server cache
    for (var i = 0; i < 5; ++i) {
        var tilePath = path.join(
            tilesetDirectory,
            'cache',
            'points_' + i + '.pnts'
        );
        var tileOptions = clone(pointCloudOptions);
        tileOptions.time = i * 0.1;
        var tile = (await createPointCloudTile(tileOptions)).pnts;
        tilePromises.push(saveBinary(tilePath, tile, gzip));
    }

    var tilesetJson = {
        asset: {
            version: versionNumber
        },
        geometricError: pointCloudGeometricError,
        root: {
            expire: {
                duration: 5.0
            },
            transform: pointCloudTransform,
            boundingVolume: {
                sphere: pointCloudSphereLocal
            },
            geometricError: 0.0,
            refine: 'ADD',
            content: {
                uri: pointCloudTileName
            }
        }
    };

    return Bluebird.all([
        saveJson(tilesetPath, tilesetJson, prettyJson, gzip),
        Bluebird.all(tilePromises)
    ]);
}
