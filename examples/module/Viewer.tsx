import * as React from 'react';
import DatGui, { DatBoolean, DatButton, DatColor, DatFolder, DatNumber } from 'react-dat-gui';
import 'react-dat-gui/build/react-dat-gui.css';
import * as THREE from 'three';
import OrbitControls from 'three-orbitcontrols';
import { VRM, VRMAnimationClip, VRMAnimationMixer, VRMVMD } from '../../src';

interface Props {
  vrm?: VRM;
  vmd?: VRMVMD;
  width: number;
  height: number;
}

interface State {
  isInitialized: boolean;
  isBusy: boolean;
  progress: number;
  data: any;
}

export default class Viewer extends React.Component<Props, State> {
  private requestID: number;
  private clock: THREE.Clock;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: THREE.OrbitControls;
  private helpers: THREE.Group;
  private vrm: VRM;
  private vmd: VRMVMD;
  private clip: VRMAnimationClip;
  private mixer: VRMAnimationMixer;
  private actions: THREE.AnimationAction[];

  constructor(props: Props) {
    super(props);
    this.state = {
      isInitialized: false,
      isBusy: false,
      progress: 0,
      data: { background: '#212121', isAxesVisible: true, timeScale: 1 },
    };

    this.clock = new THREE.Clock();

    this.onDataUpdate = this.onDataUpdate.bind(this);
    this.update = this.update.bind(this);
    this.restartAnimation = this.restartAnimation.bind(this);
  }

  public componentDidMount() {
    this.initScene();
    this.update();
  }

  public componentWillUnmount() {
    window.cancelAnimationFrame(this.requestID);
  }

  public componentDidUpdate(prevProps: Props) {
    // On screen resized.
    if (prevProps.width !== this.props.width || prevProps.height !== this.props.height) {
      console.log('Resize', 'width', this.props.width, 'height', this.props.height);

      if (this.renderer) {
        this.renderer.setSize(this.props.width, this.props.height);
      }

      if (this.camera) {
        this.camera.aspect = this.props.width / this.props.height;
        this.camera.updateProjectionMatrix();
      }
    }

    let shouldUpdateAnimation = false;

    // On model changed.
    if (prevProps.vrm !== this.props.vrm) {
      if (this.vrm) {
        this.scene.remove(this.vrm.model);
      }
      this.vrm = this.props.vrm;
      this.scene.add(this.vrm.model);

      // console.log(this.vrm.humanoid.humanBones.map(e => [e.bone, this.vrm.getNode(e.node).type]));

      const headY = 1.5;
      this.camera.position.set(0, headY, -headY);
      this.controls.target.set(0, 0.75 * headY, 0);

      const data = this.state.data;
      this.vrm.blendShapeMaster.blendShapeGroups.forEach(e => {
        data['blendShape' + e.name] = 0;
      });
      this.setState({ data });

      if (this.mixer) {
        this.mixer.stopAllAction();
      }
      this.mixer = new VRMAnimationMixer(this.vrm);

      shouldUpdateAnimation = true;
    }

    // On motion changed.
    if (prevProps.vmd !== this.props.vmd) {
      this.vmd = this.props.vmd;

      shouldUpdateAnimation = true;
    }

    if (shouldUpdateAnimation && this.vrm && this.mixer && this.vmd) {
      this.clip = this.vmd.toAnimationClip(this.vrm);
      this.actions = this.mixer.clipAction(this.clip);
      this.actions.forEach(e => {
        e.play();
      });
    }

    this.renderScene();
  }

  public render() {
    return (
      <>
        <div style={{ width: this.props.width, height: this.props.height, margin: 0, padding: 0, cursor: 'move' }}>
          <canvas
            ref={c => {
              if (!c) {
                return;
              }

              if (this.renderer && c === this.renderer.domElement) {
                const size = this.renderer.getSize();
                if (this.props.width !== size.width || this.props.height !== size.height) {
                  this.renderer.setSize(this.props.width, this.props.height);
                }
                return;
              }

              this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true });
              this.renderer.setPixelRatio(window.devicePixelRatio);
              this.renderer.setSize(this.props.width, this.props.height);
            }}
            style={{ width: '100%', height: '100%', margin: 0, padding: 0 }}
          />
        </div>
        {this.state.isBusy && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'rgba(255, 255, 255, 0.5)',
              fontWeight: 'bold',
            }}
          >
            {`${Math.round(100 * this.state.progress)} %`}
          </div>
        )}
        {this.state.isInitialized && this.vrm && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, margin: '1rem', color: 'rgba(255, 255, 255, 0.5)' }}>
            {this.vrm.meta.contactInformation ? (
              <a href={this.vrm.meta.contactInformation}>{this.vrm.meta.title}</a>
            ) : (
              this.vrm.meta.title
            )}
            {' by '}
            {this.vrm.meta.author}
          </div>
        )}
        <DatGui data={this.state.data} onUpdate={this.onDataUpdate}>
          <DatFolder title="Environment" closed={true}>
            <DatColor path="background" label="Background" />
            <DatBoolean path="isAxesVisible" label="Axes" />
            <DatNumber path={'timeScale'} label={'Time Scale'} min={0} max={2} step={0.01} />
          </DatFolder>
          <DatFolder title="Blend Shape Group" closed={true}>
            {this.vrm &&
              this.vrm.blendShapeMaster.blendShapeGroups.map((e, i) => (
                <DatNumber key={i} path={'blendShape' + e.name} label={e.name} min={0} max={1} step={0.01} />
              ))}
          </DatFolder>
          <DatFolder title="Animation" closed={true}>
            <DatButton label={'Restart'} onClick={this.restartAnimation} />
          </DatFolder>
        </DatGui>
      </>
    );
  }

  private onDataUpdate(data: any) {
    if (!this.state.isInitialized) {
      return;
    }

    if (data.background !== this.state.data.background) {
      this.scene.background = new THREE.Color(data.background);
    }

    if (data.isAxesVisible !== this.state.data.isAxesVisible) {
      this.helpers.visible = data.isAxesVisible;
    }

    this.vrm.blendShapeMaster.blendShapeGroups.forEach((e, i) => {
      if (data['blendShape' + e.name] !== this.state.data['blendShape' + e.name]) {
        this.vrm.setBlendShapeGroupWeight(i, data['blendShape' + e.name]);
      }
    });

    this.setState({ data });
  }

  private update() {
    this.requestID = window.requestAnimationFrame(this.update);
    const delta = this.clock.getDelta();

    if (this.mixer) {
      this.mixer.update(this.state.data.timeScale * delta);
    }

    this.renderScene();
  }

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.state.data.background);

    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(0, 1, -2);
    this.scene.add(directionalLight);

    this.helpers = new THREE.Group();
    const gridHelper = new THREE.GridHelper(10, 10);
    const axesHelper = new THREE.AxesHelper(5);
    gridHelper.visible = this.state.data.isAxesVisible;
    axesHelper.visible = this.state.data.isAxesVisible;
    this.helpers.add(gridHelper);
    this.helpers.add(axesHelper);
    this.scene.add(this.helpers);

    this.camera = new THREE.PerspectiveCamera(50, this.props.width / this.props.height, 0.01);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement) as THREE.OrbitControls;
    (this.controls as any).screenSpacePanning = true;
    this.controls.target.set(0, 1, 0);

    this.setState({ isInitialized: true });
  }

  private renderScene() {
    if (!this.state.isInitialized) {
      return;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private restartAnimation() {
    (this.actions || []).forEach(e => {
      e.reset();
    });
  }
}
