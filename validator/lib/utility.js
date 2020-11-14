'use strict';
const Cesium = require('cesium');

const BoundingSphere = Cesium.BoundingSphere;
const Cartesian3 = Cesium.Cartesian3;
const CesiumMath = Cesium.Math;
const Intersect = Cesium.Intersect;
const Matrix3 = Cesium.Matrix3;
const Matrix4 = Cesium.Matrix4;
const Plane = Cesium.Plane;

module.exports = {
    boxInsideBox: boxInsideBox,
    boxInsideSphere: boxInsideSphere,
    componentTypeToByteLength: componentTypeToByteLength,
    isBufferValidUtf8: isBufferValidUtf8,
    regionInsideRegion: regionInsideRegion,
    sphereInsideBox: sphereInsideBox,
    sphereInsideSphere: sphereInsideSphere,
    typeToComponentsLength: typeToComponentsLength,
    normalizePath: normalizePath
};

function normalizePath(path) {
    // on Windows, the paths get backslashes (due to path.join)
    // normalize that to be able to deal with internal zip paths
    const res = path.replace(/\.\//, '');
    return res.replace(/\\/g, '/');
}

function typeToComponentsLength(type) {
    switch (type) {
        case 'SCALAR':
            return 1;
        case 'VEC2':
            return 2;
        case 'VEC3':
            return 3;
        case 'VEC4':
            return 4;
        default:
            return undefined;
    }
}

function componentTypeToByteLength(componentType) {
    switch (componentType) {
        case 'BYTE':
        case 'UNSIGNED_BYTE':
            return 1;
        case 'SHORT':
        case 'UNSIGNED_SHORT':
            return 2;
        case 'INT':
        case 'UNSIGNED_INT':
        case 'FLOAT':
            return 4;
        case 'DOUBLE':
            return 8;
        default:
            return undefined;
    }
}

function isBufferValidUtf8(buffer){
    return Buffer.compare(Buffer.from(buffer.toString()), buffer) === 0;
}

function regionInsideRegion(regionInner, regionOuter) {
    return (regionInner[0] >= regionOuter[0]) &&
        (regionInner[1] >= regionOuter[1]) &&
        (regionInner[2] <= regionOuter[2]) &&
        (regionInner[3] <= regionOuter[3]) &&
        (regionInner[4] >= regionOuter[4]) &&
        (regionInner[5] <= regionOuter[5]);
}

const scratchInnerCenter = new Cartesian3();
const scratchOuterCenter = new Cartesian3();

function sphereInsideSphere(sphereInner, sphereOuter) {
    const radiusInner = sphereInner[3];
    const radiusOuter = sphereOuter[3];
    const centerInner = Cartesian3.unpack(sphereInner, 0, scratchInnerCenter);
    const centerOuter = Cartesian3.unpack(sphereOuter, 0, scratchOuterCenter);
    const distance = Cartesian3.distance(centerInner, centerOuter);
    return distance <= (radiusOuter - radiusInner);
}

const scratchInnerHalfAxes = new Matrix3();
const scratchOuterHalfAxes = new Matrix3();

function boxInsideBox(boxInner, boxOuter) {
    const centerInner = Cartesian3.fromElements(boxInner[0], boxInner[1], boxInner[2], scratchInnerCenter);
    const halfAxesInner = Matrix3.fromArray(boxInner, 3, scratchInnerHalfAxes);
    const transformInner = Matrix4.fromRotationTranslation(halfAxesInner, centerInner);

    const centerOuter = Cartesian3.fromElements(boxOuter[0], boxOuter[1], boxOuter[2], scratchOuterCenter);
    const halfAxesOuter = Matrix3.fromArray(boxOuter, 3, scratchOuterHalfAxes);
    const transformOuter = Matrix4.fromRotationTranslation(halfAxesOuter, centerOuter);

    const cube = createUnitCube();

    const transformInnerInverse = Matrix4.inverse(transformOuter, transformOuter);
    for (let i = 0; i < 8; i++) {
        cube[i] = Matrix4.multiplyByPoint(transformInner, cube[i], cube[i]);
        cube[i] = Matrix4.multiplyByPoint(transformInnerInverse, cube[i], cube[i]);
        const min = Cartesian3.minimumComponent(cube[i]);
        const max = Cartesian3.maximumComponent(cube[i]);
        if (min < -1.0 - CesiumMath.EPSILON8 || max > 1.0 + CesiumMath.EPSILON8) {
            return false;
        }
    }
    return true;
}

const scratchBoxCenter = new Cartesian3();
const scratchSphereCenter = new Cartesian3();
const scratchBoxHalfAxes = new Matrix3();

function boxInsideSphere(box, sphere) {
    const centerBox = Cartesian3.fromElements(box[0], box[1], box[2], scratchBoxCenter);
    const halfAxesBox = Matrix3.fromArray(box, 3, scratchBoxHalfAxes);
    const transformBox = Matrix4.fromRotationTranslation(halfAxesBox, centerBox);

    const radiusSphere = sphere[3];
    const centerSphere = Cartesian3.unpack(sphere, 0, scratchSphereCenter);

    const cube = createUnitCube();

    for (let i = 0; i < 8; i++) {
        cube[i] = Matrix4.multiplyByPoint(transformBox, cube[i], cube[i]);
        const distance = Cartesian3.distance(cube[i], centerSphere);
        if (distance > radiusSphere) {
            return false;
        }
    }
    return true;
}

function sphereInsideBox(sphere, box) {
    const centerBox = Cartesian3.fromElements(box[0], box[1], box[2], scratchBoxCenter);
    const halfAxesBox = Matrix3.fromArray(box, 3, scratchBoxHalfAxes);
    const transformBox = Matrix4.fromRotationTranslation(halfAxesBox, centerBox);

    const radiusSphere = sphere[3];
    const centerSphere = Cartesian3.unpack(sphere, 0, scratchSphereCenter);

    const cube = createUnitCube();

    for (let i = 0; i < 8; i++) {
        cube[i] = Matrix4.multiplyByPoint(transformBox, cube[i], cube[i]);
    }

    const face = new Array(6);
    face[0] = planeFromPoints(cube[0], cube[1], cube[2]);
    face[1] = planeFromPoints(cube[2], cube[6], cube[7]);
    face[2] = planeFromPoints(cube[6], cube[5], cube[4]);
    face[3] = planeFromPoints(cube[5], cube[1], cube[0]);
    face[4] = planeFromPoints(cube[6], cube[2], cube[1]);
    face[5] = planeFromPoints(cube[0], cube[3], cube[7]);

    const boundingSphere = new BoundingSphere(centerSphere, radiusSphere);
    for (let i = 0; i < 6; i++) {
        const intersection = BoundingSphere.intersectPlane(boundingSphere, face[i]);
        if (intersection !== Intersect.INSIDE) {
            return false;
        }
    }
    return true;
}

function planeFromPoints(point1, point2, point3) {
    const a = new Cartesian3();
    const b = new Cartesian3();
    const c = new Cartesian3();
    const normal = new Cartesian3();

    Cartesian3.subtract(point2, point1, a);
    Cartesian3.subtract(point3, point2, b);
    Cartesian3.cross(a, b, c);
    Cartesian3.normalize(c, normal);

    return Plane.fromPointNormal(point1, normal);
}

function createUnitCube() {
    const cube = new Array(8);
    cube[0] = new Cartesian3(-1, -1, -1);
    cube[1] = new Cartesian3(-1, -1, 1);
    cube[2] = new Cartesian3(1, -1, 1);
    cube[3] = new Cartesian3(1, -1, -1);
    cube[4] = new Cartesian3(-1, 1, -1);
    cube[5] = new Cartesian3(-1, 1, 1);
    cube[6] = new Cartesian3(1, 1, 1);
    cube[7] = new Cartesian3(1, 1, -1);
    return cube;
}
