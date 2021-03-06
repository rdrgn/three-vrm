import * as THREE from 'three';
import { USERDATA_KEY_VRM, VRM } from '../data';

// cf. https://github.com/dwango/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/SpringBone/VRMSpringBone.cs
export class VRMPhysics {
  private vrm: VRM;
  private springBoneGroups: SpringBoneGroup[];
  private sphereColliderGroups: SphereColliderGroup[];

  constructor(vrm: VRM) {
    this.vrm = vrm;

    this.sphereColliderGroups = this.vrm.secondaryAnimation.colliderGroups.map(colliderGroup => {
      const group = new SphereColliderGroup(this.vrm.getNode(colliderGroup.node));
      colliderGroup.colliders.forEach(c => {
        group.createSphereCollider(new THREE.Vector3(c.offset.x, c.offset.y, -c.offset.z), c.radius);
      });
      return group;
    });

    this.springBoneGroups = this.vrm.secondaryAnimation.boneGroups.map(boneGroup => {
      const g = new SpringBoneGroup();
      g.stiffnessForce = boneGroup.stiffiness;
      g.gravityPower = boneGroup.gravityPower;
      g.gravityDirection = new THREE.Vector3(
        boneGroup.gravityDir.x,
        boneGroup.gravityDir.y,
        boneGroup.gravityDir.z
      ).normalize();
      g.dragForce = boneGroup.dragForce;
      g.center = boneGroup.center !== -1 ? this.vrm.getNode(boneGroup.center) : undefined;
      g.hitRadius = boneGroup.hitRadius;
      boneGroup.bones.forEach(node => {
        this.vrm.getNode(node).traverse(object3d => {
          if (object3d.type === 'Bone') {
            g.springBones.push(new SpringBone(g, object3d as THREE.Bone));
          }
        });
      });
      g.sphereColliderGroups = boneGroup.colliderGroups.map(index => this.sphereColliderGroups[index]);
      return g;
    });
  }

  public reset(): VRMPhysics {
    this.springBoneGroups.forEach(g => {
      g.reset();
    });
    return this;
  }

  public update(delta: number): VRMPhysics {
    this.sphereColliderGroups.forEach(g => {
      g.update();
    });
    this.springBoneGroups.forEach(g => {
      g.update(delta);
    });
    return this;
  }
}

class SpringBoneGroup {
  public stiffnessForce: number;
  public gravityPower: number;
  public gravityDirection: THREE.Vector3;
  public dragForce: number;
  public center: THREE.Object3D;
  public hitRadius: number;
  public springBones: SpringBone[];
  public sphereColliderGroups: SphereColliderGroup[];

  constructor() {
    this.stiffnessForce = 1.0;
    this.gravityPower = 1.0;
    this.gravityDirection = new THREE.Vector3(0, -1, 0);
    this.dragForce = 0.4;
    this.hitRadius = 0.02;
    this.springBones = [];
    this.sphereColliderGroups = [];
  }

  public reset() {
    this.springBones.forEach(springBone => {
      springBone.reset();
    });
  }

  public update(delta: number) {
    this.springBones.forEach(springBone => {
      springBone.update(delta);
    });
  }
}

class SpringBone {
  public group: SpringBoneGroup;
  public bone: THREE.Bone;

  private initialQuaternion: THREE.Quaternion;
  private isWorldPositionInitialized: boolean;
  private previousTailWorldPosition: THREE.Vector3;
  private currentTailWorldPosition: THREE.Vector3;
  private length: number;
  private boneAxis: THREE.Vector3;

  constructor(group: SpringBoneGroup, bone: THREE.Bone) {
    this.group = group;
    this.bone = bone;

    this.initialQuaternion = bone.quaternion.clone();

    this.isWorldPositionInitialized = false;
    this.currentTailWorldPosition = new THREE.Vector3();
    this.previousTailWorldPosition = new THREE.Vector3();

    this.length = this.bone.userData[USERDATA_KEY_VRM].bone.length;
    this.boneAxis = this.bone.userData[USERDATA_KEY_VRM].bone.axis;

    // Debug
    // const geometry = new THREE.SphereGeometry(this.group.hitRadius, 16, 16);
    // const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    // const sphere = new THREE.Mesh(geometry, material);
    // sphere.position.copy(this.boneAxis.clone().multiplyScalar(this.length));
    // this.bone.add(sphere);
  }

  public reset() {
    this.bone.setRotationFromQuaternion(this.initialQuaternion);

    this.isWorldPositionInitialized = false;
  }

  public update(delta: number) {
    if (!this.isWorldPositionInitialized) {
      const childWorldPosition = this.bone.localToWorld(this.boneAxis.clone().multiplyScalar(this.length));
      this.currentTailWorldPosition.copy(
        this.group.center ? this.group.center.worldToLocal(childWorldPosition) : childWorldPosition
      );
      this.previousTailWorldPosition.copy(this.currentTailWorldPosition);

      this.isWorldPositionInitialized = true;
    }

    const previousTail = this.group.center
      ? this.group.center.localToWorld(this.previousTailWorldPosition)
      : this.previousTailWorldPosition;
    const currentTail = this.group.center
      ? this.group.center.localToWorld(this.currentTailWorldPosition)
      : this.currentTailWorldPosition;

    // Calculate next position by Verlet integration.
    const nextTail = currentTail.clone();
    nextTail.add(
      currentTail
        .clone()
        .sub(previousTail)
        .multiplyScalar(1 - this.group.dragForce)
    );
    nextTail.add(
      this.boneAxis
        .clone()
        .applyQuaternion(this.bone.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(this.initialQuaternion))
        .multiplyScalar(delta * this.group.stiffnessForce)
    );
    nextTail.add(this.group.gravityDirection.clone().multiplyScalar(delta * this.group.gravityPower));

    // Fix the bone length.
    const worldPosition = this.bone.getWorldPosition(new THREE.Vector3());
    nextTail
      .sub(worldPosition)
      .normalize()
      .multiplyScalar(this.length)
      .add(worldPosition);

    // Move by colliders.
    this.group.sphereColliderGroups.forEach(sphereColliderGroup => {
      sphereColliderGroup.colliders.forEach(collider => {
        const r = this.group.hitRadius + collider.radius;
        const v = nextTail.clone().sub(collider.worldPosition);
        if (v.lengthSq() <= r * r) {
          v.normalize()
            .multiplyScalar(r)
            .add(collider.worldPosition);
          nextTail.set(v.x, v.y, v.z);
          // Fix the bone length.
          const wp = this.bone.getWorldPosition(new THREE.Vector3());
          nextTail
            .sub(wp)
            .normalize()
            .multiplyScalar(this.length)
            .add(wp);
        }
      });
    });

    this.previousTailWorldPosition = this.group.center ? this.group.center.worldToLocal(currentTail) : currentTail;
    this.currentTailWorldPosition = this.group.center ? this.group.center.worldToLocal(nextTail) : nextTail;

    // Apply rotation.
    this.bone.setRotationFromQuaternion(this.tailPositionToQuaternion(nextTail));
  }

  private tailPositionToQuaternion(tailWorldPosition: THREE.Vector3): THREE.Quaternion {
    const q = this.bone.parent.getWorldQuaternion(new THREE.Quaternion()).multiply(this.initialQuaternion);
    const vFrom = this.boneAxis
      .clone()
      .applyQuaternion(q)
      .normalize();
    const vTo = tailWorldPosition
      .clone()
      .sub(this.bone.getWorldPosition(new THREE.Vector3()))
      .normalize();
    return new THREE.Quaternion()
      .setFromUnitVectors(vFrom, vTo)
      .multiply(q)
      .premultiply(q.inverse());
  }
}

class SphereColliderGroup {
  public object3d: THREE.Object3D;
  public colliders: SphereCollider[];

  constructor(object3d: THREE.Object3D) {
    this.object3d = object3d;
    this.colliders = [];
  }

  public createSphereCollider(offset: THREE.Vector3, radius: number) {
    this.colliders.push(new SphereCollider(this, offset, radius));

    // Debug
    // const geometry = new THREE.SphereGeometry(radius, 16, 16);
    // const material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    // const sphere = new THREE.Mesh(geometry, material);
    // sphere.position.copy(offset);
    // this.object3d.add(sphere);
  }

  public update() {
    this.colliders.forEach(collider => {
      collider.update();
    });
  }
}

class SphereCollider {
  public offset: THREE.Vector3;
  public radius: number;
  public worldPosition: THREE.Vector3;
  private group: SphereColliderGroup;

  constructor(group: SphereColliderGroup, offset: THREE.Vector3, radius: number) {
    this.group = group;
    this.offset = offset.clone();
    this.radius = radius;
    this.worldPosition = new THREE.Vector3();
    this.update();
  }

  public update() {
    this.worldPosition = this.group.object3d.localToWorld(this.offset.clone());
  }
}
