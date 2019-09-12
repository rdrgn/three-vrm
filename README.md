# [deprecated] three-vrm

<!--
[![Latest NPM release][npm-badge]][npm-badge-url]
[![Install Size][npm-size-badge]][npm-size-badge-url]
[![License][license-badge]][license-badge-url]
[![Build Status][travis-ci-badge]][travis-ci-badge-url]
-->

**This package is deprecated.**
**Use [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) instead.**
**(@pixiv/three-vrm is NOT our product and it is NOT compatible with this package.)**

**本パッケージは開発を停止しています。**
**[@pixiv/three-vrm](https://github.com/pixiv/three-vrm)を使用してください。**
**(本パッケージとは開発者が異なり、互換性がありません。)**

[VRM](https://dwango.github.io/en/vrm/) file loader and utilities for three.js, written in TypeScript.

[VRM](https://dwango.github.io/vrm/) 形式の 3D モデルを three.js で描画するためのパッケージです。

## Dependencies

- [three.js](https://github.com/mrdoob/three.js/)

```sh
yarn add three
```

## Usage

Install the [package][npm-badge-url] from `npm` and import it.

```sh
yarn add three-vrm
```

This TypeScript code loads a VRM file with `VRMLoader`.
You have to create a `Camera`, a `Light`, and a `WebGLRenderer` to render the `Scene`.
See the usage of three.js.

```ts
import * as THREE from 'three';
import { VRM, VRMLoader } from 'three-vrm';

const scene = new THREE.Scene();

const vrmLoader = new VRMLoader();

vrmLoader.load(
  'model.vrm',
  (vrm: VRM) => {
    scene.add(vrm.model);
    // Render the scene.
  },
  (progress: ProgressEvent) => {
    console.log(progress.loaded / progress.total);
  },
  (error: ErrorEvent) => {
    console.error(error);
  }
);
```

Alternatively, if you work with HTML and a copy of `three.js`, you may copy only `node_modules/three-vrm/lib/index.js` and include it.
Rename the file as necessary.
This file assigns all exported classes to `THREE`.

```html
<script src="js/three.js"></script>
<script src="js/three-vrm.js"></script>
<script>
  var scene = new THREE.Scene();

  var vrmLoader = new THREE.VRMLoader();

  vrmLoader.load(
    'model.vrm',
    function(vrm) {
      scene.add(vrm.model);
      // Render the scene.
    },
    function(progress) {
      console.log(progress.loaded / progress.total);
    },
    function(error) {
      console.error(error);
    }
  );
</script>
```

### VRMLoader

A loader for VRM resources.

#### `new VRMLoader ( manager? : THREE.LoadingManager )`

Creates a new VRMLoader.

#### `.load ( url : string, onLoad? : Function, onProgress? : Function, onError? : Function ) : void`

Loads a VRM model.

### VRM

Model data loaded by `VRMLoader`.

#### `.asset : object`

A glTF asset property.

#### `.model : THREE.Object3D`

A `Object3D`.

#### `.parser : object`

A `GLTFParser` created by `GLTFLoader`.

#### `.userData : object`

A dictionary object with extension data.
Raw json of VRM extensions is in `.userData.gltfExtensions.VRM`.

#### `.materialProperties : Array`

An array of VRM material properties.

#### `.humanoid : object`

VRM bone mapping.

#### `.meta : object`

VRM model information.

#### `.blendShapeMaster : object`

VRM blendShapeMaster with an array of BlendShapeGroups to group BlendShape.

#### `.firstPerson : object`

VRM first-person settings.

#### `.secondaryAnimation : object`

VRM swaying object settings.

#### `.getNode ( index : number ) : THREE.Object3D`

Returns a reference to the `Object3D` in `.model`, corresponding to the node index.

#### `.setBlendShapeWeight ( meshIndex : number, blendShapeIndex : number, value : number ) : void`

Morphs the mesh.

#### `.setBlendShapeGroupWeight ( index : number, value : number ) : void`

Morphs all meshes in the BlendShapeGroup.

### VRMPhysics

A Physics handler for `VRM`.

```ts
const clock = new THREE.Clock();
const physics = new VRMPhysics(vrm);

function render() {
  const delta = clock.getDelta();
  physics.update(delta);
  renderer.render(scene, camera);
}
```

#### `new VRMPhysics ( vrm : VRM )`

Creates a new VRMPhysics.

#### `.update ( deltaTime : number ) : VRMPhysics`

`deltaTime` - Time in second.

Advances Physics calculation and updates bones.

## Development

```sh
yarn
yarn start
```

Open `localhost:8080` with a browser.

## License

[MIT][license-badge-url]

[npm-badge]: https://img.shields.io/npm/v/three-vrm.svg
[npm-badge-url]: https://www.npmjs.com/package/three-vrm
[npm-size-badge]: https://packagephobia.now.sh/badge?p=three-vrm
[npm-size-badge-url]: https://packagephobia.now.sh/result?p=three-vrm
[license-badge]: https://img.shields.io/npm/l/three-vrm.svg
[license-badge-url]: ./LICENSE
[travis-ci-badge]: https://travis-ci.org/rdrgn/three-vrm.svg?branch=master
[travis-ci-badge-url]: https://travis-ci.org/rdrgn/three-vrm
