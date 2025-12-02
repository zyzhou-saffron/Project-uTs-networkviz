import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ProcessedData, VisualConfig, SimulationNode, TooltipData } from '../types';

interface GeneCanvasProps {
  data: ProcessedData;
  config: VisualConfig;
  onTooltipUpdate: (tooltip: TooltipData) => void;
}

interface ActiveLabel {
    nodeIndex: number;
    sprite: THREE.Sprite;
}

interface ExtendedSimulationNode extends SimulationNode {
    currentScale: number; // For smooth animation
}

export const GeneCanvas: React.FC<GeneCanvasProps> = ({ data, config, onTooltipUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  
  // --- 1. Refs & State ---
  const isActiveRef = useRef<boolean>(true);  // 控制动画循环是否活跃
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const networkGroupRef = useRef<THREE.Group | null>(null);
  const labelGroupRef = useRef<THREE.Group | null>(null);
  
  // Meshes
  const nodeMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const nodeOutlineMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const edgeMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const arrowMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const innerEdgeMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const coreArrowMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const hitEdgeMeshRef = useRef<THREE.InstancedMesh | null>(null);
  
  // Highlight Refs
  const highlightMeshRef = useRef<THREE.Mesh | null>(null);
  const highlightMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const geneNodesRef = useRef<ExtendedSimulationNode[]>([]);
  const geneMapRef = useRef<Record<string, number>>({});
  const activeLabelsRef = useRef<ActiveLabel[]>([]);
  const reqIdRef = useRef<number | null>(null);
  
  // Interaction state
  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0, y: 0 });
  const currentRotationRef = useRef({ x: 0, y: 0 });
  
  const intersectedNodeIndexRef = useRef<number | null>(null);
  const intersectedEdgeIndexRef = useRef<number | null>(null);
  
  const isTransitioningRef = useRef(false);

  // Data Refs (for access inside closures)
  const configRef = useRef(config);
  const dataRef = useRef(data);

  // --- 2. Sync Effects ---
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { dataRef.current = data; }, [data]);

  // --- 3. Constants ---
  const CONSTANTS = {
    radius: 45,
    radiusCore: 15,
    radiusOuter: 65,
    baseSizeNormal: 1.5,
    baseSizeTop: 3.5,
    minThickness: 0.05,
    maxThickness: 0.4,
    topPercent: 0.10,
    hoverScaleMult: 1.3, // UPDATED: Changed to 1.20x as requested
    hitEdgeThickness: 1.5, 
    arrowLength: 0.75, 
    arrowAngle: Math.PI / 6, 
  };

  // --- 4. Helper Functions (Defined BEFORE usage) ---

  const createToonGradient = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (context) {
        context.fillStyle = '#cfcfcf'; 
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = '#ececec';
        context.fillRect(1, 0, 1, 1);
        context.fillStyle = '#ffffff';
        context.fillRect(2, 0, 2, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
  };

  const updateInstanceMatrices = () => {
    const dummy = new THREE.Object3D();
    const currentData = dataRef.current;
    const currentConfig = configRef.current;

    // Update Nodes
    if (nodeMeshRef.current && nodeOutlineMeshRef.current) {
        geneNodesRef.current.forEach((node, i) => {
          dummy.position.copy(node.position);
          dummy.rotation.set(0,0,0);
          dummy.scale.set(node.currentScale, node.currentScale, node.currentScale);
          dummy.updateMatrix();
          nodeMeshRef.current!.setMatrixAt(i, dummy.matrix);

          const outlineScale = node.currentScale * 1.05; 
          dummy.scale.set(outlineScale, outlineScale, outlineScale);
          dummy.updateMatrix();
          nodeOutlineMeshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        nodeMeshRef.current.instanceMatrix.needsUpdate = true;
        nodeOutlineMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Hide highlight initially
    if (highlightMeshRef.current) {
        highlightMeshRef.current.visible = false;
    }

    // Update Edges
    if (edgeMeshRef.current && hitEdgeMeshRef.current && arrowMeshRef.current) {
        let idx = 0;
        const lineDir = new THREE.Vector3();
        
        currentData.links.forEach(link => {
            const sIdx = geneMapRef.current[link.source];
            const tIdx = geneMapRef.current[link.target];
            
            if (sIdx !== undefined && tIdx !== undefined) {
                const sNode = geneNodesRef.current[sIdx];
                const tNode = geneNodesRef.current[tIdx];
                const start = sNode.position;
                const end = tNode.position;
                
                const dist = start.distanceTo(end);
                const score = link.score || 0.1;
                
                const sRad = sNode.currentScale;
                const tRad = tNode.currentScale;
                
                const isCore = sNode.isTop || tNode.isTop;

                lineDir.subVectors(end, start).normalize();
                
                // 1. Visual Line (Faint)
                dummy.position.copy(start);
                dummy.lookAt(end);
                const thickness = CONSTANTS.minThickness + score * (CONSTANTS.maxThickness - CONSTANTS.minThickness);
                
                dummy.scale.set(thickness, thickness, dist - (sRad + tRad) * 0.5);
                dummy.updateMatrix();
                edgeMeshRef.current!.setMatrixAt(idx, dummy.matrix);
                
                const lineQuaternion = dummy.quaternion.clone();

                // 2. Hit Line (For Interaction)
                if (currentConfig.layoutMode === 'core' && !isCore) {
                    dummy.scale.set(0, 0, 0); 
                } else {
                    dummy.position.copy(start);
                    dummy.lookAt(end);
                    dummy.scale.set(CONSTANTS.hitEdgeThickness, CONSTANTS.hitEdgeThickness, dist);
                }
                dummy.updateMatrix();
                hitEdgeMeshRef.current!.setMatrixAt(idx, dummy.matrix);

                // 3. Faint Arrows
                const startTip = start.clone().add(lineDir.clone().multiplyScalar(sRad));
                const endTip = end.clone().sub(lineDir.clone().multiplyScalar(tRad));

                const updateArrowStick = (instanceIdx: number, tip: THREE.Vector3, forward: THREE.Vector3, angle: number) => {
                     const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
                     if (right.lengthSq() === 0) right.set(1, 0, 0);
                     const stickDir = forward.clone().applyAxisAngle(right, angle);
                     dummy.position.copy(tip);
                     dummy.lookAt(tip.clone().add(stickDir));
                     dummy.scale.set(thickness, thickness, CONSTANTS.arrowLength);
                     dummy.updateMatrix();
                     arrowMeshRef.current!.setMatrixAt(instanceIdx, dummy.matrix);
                };

                const arrowBaseIdx = idx * 4;
                updateArrowStick(arrowBaseIdx + 0, startTip, lineDir, CONSTANTS.arrowAngle);
                updateArrowStick(arrowBaseIdx + 1, startTip, lineDir, -CONSTANTS.arrowAngle);
                
                const backDir = lineDir.clone().negate();
                updateArrowStick(arrowBaseIdx + 2, endTip, backDir, CONSTANTS.arrowAngle);
                updateArrowStick(arrowBaseIdx + 3, endTip, backDir, -CONSTANTS.arrowAngle);

                // 4. Core Lines
                if (innerEdgeMeshRef.current && coreArrowMeshRef.current) {
                   if (isCore) {
                        dummy.position.copy(start);
                        dummy.lookAt(end);
                        dummy.scale.set(0.05, 0.05, dist - (sRad + tRad) * 0.5);
                        dummy.updateMatrix();
                        innerEdgeMeshRef.current!.setMatrixAt(idx, dummy.matrix);

                        const updateCoreArrowStick = (instanceIdx: number, tip: THREE.Vector3, forward: THREE.Vector3, angle: number) => {
                             const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
                             if (right.lengthSq() === 0) right.set(1, 0, 0);
                             const stickDir = forward.clone().applyAxisAngle(right, angle);
                             dummy.position.copy(tip);
                             dummy.lookAt(tip.clone().add(stickDir));
                             dummy.scale.set(0.08, 0.08, CONSTANTS.arrowLength);
                             dummy.updateMatrix();
                             coreArrowMeshRef.current!.setMatrixAt(instanceIdx, dummy.matrix);
                        };
                        
                        updateCoreArrowStick(arrowBaseIdx + 0, startTip, lineDir, CONSTANTS.arrowAngle);
                        updateCoreArrowStick(arrowBaseIdx + 1, startTip, lineDir, -CONSTANTS.arrowAngle);
                        updateCoreArrowStick(arrowBaseIdx + 2, endTip, backDir, CONSTANTS.arrowAngle);
                        updateCoreArrowStick(arrowBaseIdx + 3, endTip, backDir, -CONSTANTS.arrowAngle);

                   } else {
                        dummy.scale.set(0,0,0);
                        dummy.updateMatrix();
                        innerEdgeMeshRef.current!.setMatrixAt(idx, dummy.matrix);
                        for(let k=0; k<4; k++) coreArrowMeshRef.current!.setMatrixAt(arrowBaseIdx+k, dummy.matrix);
                   }
                }

                // 5. Highlight Mesh Update (Shader Based)
                if (intersectedEdgeIndexRef.current === idx && highlightMeshRef.current && highlightMaterialRef.current) {
                    highlightMeshRef.current.visible = true;
                    highlightMeshRef.current.position.copy(start);
                    highlightMeshRef.current.quaternion.copy(lineQuaternion);
                    
                    const visibleLength = dist; 
                    const baseRadius = thickness * 2; 
                    
                    highlightMaterialRef.current.uniforms.uTotalLength.value = visibleLength;
                    highlightMaterialRef.current.uniforms.uRadiusStart.value = sRad * 1.25; 
                    highlightMaterialRef.current.uniforms.uRadiusEnd.value = tRad * 1.25; 
                    highlightMaterialRef.current.uniforms.uBaseRadius.value = baseRadius;

                    highlightMeshRef.current.scale.set(1, 1, visibleLength);
                }

                idx++;
            }
        });
        
        edgeMeshRef.current.instanceMatrix.needsUpdate = true;
        arrowMeshRef.current.instanceMatrix.needsUpdate = true;
        hitEdgeMeshRef.current.instanceMatrix.needsUpdate = true;
        if (innerEdgeMeshRef.current) innerEdgeMeshRef.current.instanceMatrix.needsUpdate = true;
        if (coreArrowMeshRef.current) coreArrowMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  };

  const clearIntersection = () => {
    let needsUpdate = false;
    
    if (intersectedNodeIndexRef.current !== null) {
        intersectedNodeIndexRef.current = null;
        geneNodesRef.current.forEach((node, i) => {
          nodeMeshRef.current!.setColorAt(i, node.baseColor);
        });
        if(nodeMeshRef.current!.instanceColor) nodeMeshRef.current!.instanceColor!.needsUpdate = true;
        needsUpdate = true;
    }

    if (intersectedEdgeIndexRef.current !== null) {
        intersectedEdgeIndexRef.current = null;
        if(highlightMeshRef.current) highlightMeshRef.current.visible = false;
        needsUpdate = true;
    }

    if (needsUpdate) {
        if(containerRef.current) containerRef.current.style.cursor = 'default';
        onTooltipUpdate({ visible: false, x: 0, y: 0 });
    }
  };

  const checkIntersection = (clientX: number, clientY: number) => {
      if (!nodeMeshRef.current || !sceneRef.current || !cameraRef.current) return;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      // 1. Check Nodes
      const nodeIntersects = raycasterRef.current.intersectObject(nodeMeshRef.current);

      if (nodeIntersects.length > 0) {
          if (intersectedEdgeIndexRef.current !== null) {
              intersectedEdgeIndexRef.current = null;
              if(highlightMeshRef.current) highlightMeshRef.current.visible = false;
          }

          const index = nodeIntersects[0].instanceId!;
          
          if (intersectedNodeIndexRef.current !== index) {
              intersectedNodeIndexRef.current = index;
              
              const hoverCol = new THREE.Color(configRef.current.hoverColor);
              geneNodesRef.current.forEach((node, i) => {
                  nodeMeshRef.current!.setColorAt(i, node.baseColor);
              });
              nodeMeshRef.current.setColorAt(index, hoverCol);
              nodeMeshRef.current.instanceColor!.needsUpdate = true;
              
              if(containerRef.current) containerRef.current.style.cursor = 'pointer';
          }

          const node = geneNodesRef.current[index];
          onTooltipUpdate({
              visible: true,
              x: clientX + 15,
              y: clientY + 15,
              name: node.name,
              id: node.id,
              score: node.score,
              type: node.isTop ? 'hub' : 'normal'
          });
          return;
      }

      // 2. Check Edges
      if (hitEdgeMeshRef.current) {
          const edgeIntersects = raycasterRef.current.intersectObject(hitEdgeMeshRef.current);
          if (edgeIntersects.length > 0) {
              if (intersectedNodeIndexRef.current !== null) {
                  intersectedNodeIndexRef.current = null;
                   geneNodesRef.current.forEach((node, i) => {
                      nodeMeshRef.current!.setColorAt(i, node.baseColor);
                  });
                  if(nodeMeshRef.current.instanceColor) nodeMeshRef.current.instanceColor.needsUpdate = true;
              }

              const index = edgeIntersects[0].instanceId!;
              if (intersectedEdgeIndexRef.current !== index) {
                  intersectedEdgeIndexRef.current = index;
                  if(containerRef.current) containerRef.current.style.cursor = 'pointer';
                  updateInstanceMatrices();
              }

              // Use current data from ref to find the correct link
              const link = dataRef.current.links[index];
              if (link) {
                  const sNode = geneNodesRef.current[geneMapRef.current[link.source]];
                  const tNode = geneNodesRef.current[geneMapRef.current[link.target]];

                  // Find ALL matching links between these two nodes (bidirectional)
                  const relatedLinks = dataRef.current.links.filter(l => 
                    (l.source === link.source && l.target === link.target) ||
                    (l.source === link.target && l.target === link.source)
                  );

                  // Map to TooltipConnection format
                  const connections = relatedLinks.map(l => {
                      const sn = geneNodesRef.current[geneMapRef.current[l.source]];
                      const tn = geneNodesRef.current[geneMapRef.current[l.target]];
                      return {
                          sourceName: sn ? sn.name : l.source,
                          targetName: tn ? tn.name : l.target,
                          score: l.score || 0.1
                      };
                  });

                  // Calculate total score if needed, or use the hit link's score
                  // The UI displays the breakdown, so we pass the breakdown 'connections'
                  onTooltipUpdate({
                      visible: true,
                      x: clientX + 15,
                      y: clientY + 15,
                      score: link.score || 0.1, // Keep legacy score just in case
                      sourceName: sNode ? sNode.name : link.source,
                      targetName: tNode ? tNode.name : link.target,
                      connections: connections
                  });
              }
              return;
          }
      }

      clearIntersection();
  };

  // --- 5. Event Handlers (Defined AFTER helpers, BEFORE usage) ---

  const handleResize = () => {
    if (cameraRef.current && rendererRef.current) {
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      const deltaX = e.clientX - prevMousePosRef.current.x;
      const deltaY = e.clientY - prevMousePosRef.current.y;
      targetRotationRef.current.y += deltaX * 0.005;
      targetRotationRef.current.x += deltaY * 0.005;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      return; 
    }
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (e.target === rendererRef.current?.domElement) {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
      checkIntersection(e.clientX, e.clientY);
    } else {
      if (intersectedNodeIndexRef.current !== null || intersectedEdgeIndexRef.current !== null) {
        clearIntersection();
      }
    }
  };

  const handleMouseDown = () => { isDraggingRef.current = true; };
  const handleMouseUp = () => { isDraggingRef.current = false; };
  
  const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if(cameraRef.current) {
           cameraRef.current.position.z += e.deltaY * 0.05;
           cameraRef.current.position.z = Math.max(20, Math.min(cameraRef.current.position.z, 400));
      }
  };

  // --- 6. Animation Loop ---
  const animate = () => {
    if (!isActiveRef.current) return;  // 如果不活跃，停止循环
    reqIdRef.current = requestAnimationFrame(animate);
    let needsMatrixUpdate = false;

    // 1. Layout Transition
    if (isTransitioningRef.current) {
      let stillMoving = false;
      const lerpSpeed = 0.05;
      const epsilon = 0.1;

      for (let i = 0; i < geneNodesRef.current.length; i++) {
        const node = geneNodesRef.current[i];
        if (node.position.distanceTo(node.targetPosition) > epsilon) {
          node.position.lerp(node.targetPosition, lerpSpeed);
          stillMoving = true;
          needsMatrixUpdate = true;
        } else {
          node.position.copy(node.targetPosition);
        }
      }
      if (!stillMoving) isTransitioningRef.current = false;
    }

    // 2. Smooth Scale Animation
    const scaleLerpSpeed = 0.2;
    const scaleEpsilon = 0.001;
    
    // Determine nodes to highlight from Edge Selection
    let edgeStartIdx = -1;
    let edgeEndIdx = -1;
    
    if (intersectedEdgeIndexRef.current !== null) {
        const link = dataRef.current.links[intersectedEdgeIndexRef.current];
        if (link) {
            edgeStartIdx = geneMapRef.current[link.source];
            edgeEndIdx = geneMapRef.current[link.target];
        }
    }

    geneNodesRef.current.forEach((node, i) => {
        // Highlight if directly hovered OR if part of the hovered edge
        const isHovered = (intersectedNodeIndexRef.current === i) || (i === edgeStartIdx) || (i === edgeEndIdx);
        
        const base = node.isTop ? CONSTANTS.baseSizeTop : CONSTANTS.baseSizeNormal;
        const target = isHovered ? base * CONSTANTS.hoverScaleMult : base;
        
        if (Math.abs(node.currentScale - target) > scaleEpsilon) {
            node.currentScale += (target - node.currentScale) * scaleLerpSpeed;
            needsMatrixUpdate = true;
        }
    });

    if (needsMatrixUpdate) {
        updateInstanceMatrices();
    }

    // 3. Rotation
    if (networkGroupRef.current) {
      if (!isDraggingRef.current && intersectedNodeIndexRef.current === null && intersectedEdgeIndexRef.current === null) {
        targetRotationRef.current.y += 0.001;
      }
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.1;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.1;

      networkGroupRef.current.rotation.x = currentRotationRef.current.x;
      networkGroupRef.current.rotation.y = currentRotationRef.current.y;
      networkGroupRef.current.updateMatrixWorld();
    }

    // 4. Label Position
    if (labelGroupRef.current && activeLabelsRef.current.length > 0 && networkGroupRef.current && cameraRef.current) {
       const camPos = cameraRef.current.position;
       const vector = new THREE.Vector3();
       const dir = new THREE.Vector3();
       
       activeLabelsRef.current.forEach(item => {
           const node = geneNodesRef.current[item.nodeIndex];
           if (!node) return;
           
           vector.copy(node.position).applyMatrix4(networkGroupRef.current!.matrixWorld);
           dir.subVectors(camPos, vector).normalize();
           const scaleRatio = node.currentScale / CONSTANTS.baseSizeTop;
           const spriteHalfHeight = (4 * scaleRatio) / 2;
           
           const verticalOffset = node.currentScale + spriteHalfHeight + 1.5; 
           
           item.sprite.position.copy(vector)
              .add(new THREE.Vector3(0, verticalOffset, 0))
              .add(dir.multiplyScalar(2.0)); 

           item.sprite.scale.set(16 * scaleRatio, 4 * scaleRatio, 1);
       });
    }

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  // --- 7. Initialize Three.js (Effect) ---
  useEffect(() => {
    if (!containerRef.current) return;

    // 确保动画循环是活跃的
    isActiveRef.current = true;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f4f8);  // 浅灰背景
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.z = 140;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(100, 100, 100);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-100, -50, -100);
    scene.add(fillLight);


    
    // Groups
    const labelGroup = new THREE.Group();
    scene.add(labelGroup);
    labelGroupRef.current = labelGroup;

    // Add Highlight Mesh (Dynamic Liquid Shader)
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(config.topNodeColor) }, // UPDATED: Use topNodeColor
            uTotalLength: { value: 1.0 },
            uRadiusStart: { value: 1.0 },
            uRadiusEnd: { value: 1.0 },
            uBaseRadius: { value: 0.5 }
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        vertexShader: `
          varying vec2 vUv;
          uniform float uTotalLength;
          uniform float uRadiusStart;
          uniform float uRadiusEnd;
          uniform float uBaseRadius;
          
          void main() {
              vUv = uv;
              vec3 pos = position;
              
              // uv.y goes 0->1 along length.
              float distFromStart = vUv.y * uTotalLength;
              float distFromEnd = (1.0 - vUv.y) * uTotalLength;
              
              // Exponential flare function
              float flareStart = exp(-distFromStart * 1.0 / uRadiusStart);
              float flareEnd = exp(-distFromEnd * 1.0 / uRadiusEnd);
              
              // Interpolate radius
              float currentRadius = uBaseRadius + (uRadiusStart - uBaseRadius) * flareStart + (uRadiusEnd - uBaseRadius) * flareEnd;
              
              // Apply scaling
              pos.x *= currentRadius;
              pos.y *= currentRadius;
              
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float uTotalLength;
          uniform float uRadiusStart;
          uniform float uRadiusEnd;
          varying vec2 vUv;
          
          void main() {
              float distFromStart = vUv.y * uTotalLength;
              float distFromEnd = (1.0 - vUv.y) * uTotalLength;
              
              // Fade out when inside the node
              float alphaStart = smoothstep(uRadiusStart * 0.1, uRadiusStart * 2.3, distFromStart);
              float alphaEnd = smoothstep(uRadiusEnd * 0.1, uRadiusEnd * 2.3, distFromEnd);
              
              // Combined alpha
              float alpha = min(alphaStart, alphaEnd);
              
              gl_FragColor = vec4(color, alpha * 0.85);
          }
        `
    });
    highlightMaterialRef.current = material;

    const geo = new THREE.CylinderGeometry(1, 1, 1, 32, 32, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2);

    const mesh = new THREE.Mesh(geo, material);
    mesh.renderOrder = 9999;
    mesh.visible = false;
    highlightMeshRef.current = mesh;
    
    // Mark scene as ready
    setSceneReady(true);

    // --- Event Listeners ---
    window.addEventListener('resize', handleResize);
    const canvasEl = renderer.domElement;
    canvasEl.addEventListener('mousedown', handleMouseDown);
    canvasEl.addEventListener('wheel', handleWheel);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Start Loop
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (canvasEl) {
          canvasEl.removeEventListener('mousedown', handleMouseDown);
          canvasEl.removeEventListener('wheel', handleWheel);
      }
      isActiveRef.current = false;  // 停止动画循环
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        containerRef.current?.removeChild(rendererRef.current.domElement);
      }
      material.dispose();
      geo.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 8. Data & Mesh Generation Effect ---
  useEffect(() => {
      if (!sceneRef.current || !sceneReady) return;

      console.log('Creating network with', data.nodes.length, 'nodes and', data.links.length, 'links');

      if (networkGroupRef.current) sceneRef.current.remove(networkGroupRef.current);
      if (labelGroupRef.current) labelGroupRef.current.clear();
      activeLabelsRef.current = [];

      networkGroupRef.current = new THREE.Group();
      sceneRef.current.add(networkGroupRef.current);

      // Re-add Highlight Mesh
      if (highlightMeshRef.current) {
          networkGroupRef.current.add(highlightMeshRef.current);
      }

      const nodeScoreMap: Record<string, number> = {};
      data.nodes.forEach(n => nodeScoreMap[n.id] = 0);
      data.links.forEach(link => {
          const s = link.score || 0.1;
          if (nodeScoreMap[link.source] !== undefined) nodeScoreMap[link.source] += s;
          if (nodeScoreMap[link.target] !== undefined) nodeScoreMap[link.target] += s;
      });

      const sortedScores = Object.values(nodeScoreMap).sort((a, b) => b - a);
      const thresholdIndex = Math.floor(sortedScores.length * CONSTANTS.topPercent);
      const scoreThreshold = sortedScores[thresholdIndex] || 0;
      
      const count = data.nodes.length;
      const phi = Math.PI * (3 - Math.sqrt(5));
      
      geneNodesRef.current = [];
      geneMapRef.current = {};

      data.nodes.forEach((nodeData, i) => {
          const y = 1 - (i / (count - 1)) * 2;
          const radiusAtY = Math.sqrt(1 - y * y);
          const theta = phi * i;
          const x = Math.cos(theta) * radiusAtY;
          const z = Math.sin(theta) * radiusAtY;
          const pos = new THREE.Vector3(x, y, z).multiplyScalar(CONSTANTS.radius);

          const totalScore = nodeScoreMap[nodeData.id] || 0;
          const isTop = totalScore >= scoreThreshold && totalScore > 0;
          const baseSize = isTop ? CONSTANTS.baseSizeTop : CONSTANTS.baseSizeNormal;

          const simNode: ExtendedSimulationNode = {
              ...nodeData,
              index: i,
              score: totalScore,
              isTop,
              position: pos.clone(),
              targetPosition: pos.clone(),
              baseColor: new THREE.Color(isTop ? config.topNodeColor : config.normalNodeColor),
              currentScale: baseSize
          };
          
          geneNodesRef.current.push(simNode);
          geneMapRef.current[nodeData.id] = i;

          // Create Label
          if (isTop && labelGroupRef.current) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if(ctx) {
                canvas.width = 256;
                canvas.height = 64;
                ctx.font = "Bold 32px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
                ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";
                ctx.lineWidth = 6;
                ctx.strokeText(simNode.name, 128, 32);
                ctx.fillText(simNode.name, 128, 32);
            }
            const texture = new THREE.CanvasTexture(canvas);
            texture.minFilter = THREE.LinearFilter;
            const spriteMat = new THREE.SpriteMaterial({ 
                map: texture, 
                depthTest: true, 
                depthWrite: false,
                transparent: true
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(16, 4, 1);
            
            labelGroupRef.current.add(sprite);
            activeLabelsRef.current.push({ nodeIndex: i, sprite });
          }
      });

      const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
      const toonGradient = createToonGradient();
      const sphereMat = new THREE.MeshToonMaterial({
          color: 0xffffff,
          gradientMap: toonGradient
      });
      
      nodeMeshRef.current = new THREE.InstancedMesh(sphereGeo, sphereMat, count);
      nodeMeshRef.current.frustumCulled = false; // 禁用视锥裁剪
      
      const initDummy = new THREE.Object3D();
      geneNodesRef.current.forEach((node, i) => {
        initDummy.position.copy(node.position);
        initDummy.scale.set(node.currentScale, node.currentScale, node.currentScale);
        initDummy.updateMatrix();
        nodeMeshRef.current!.setMatrixAt(i, initDummy.matrix);
        nodeMeshRef.current!.setColorAt(i, node.baseColor);
      });
      nodeMeshRef.current.instanceMatrix.needsUpdate = true;
      if (nodeMeshRef.current.instanceColor) nodeMeshRef.current.instanceColor.needsUpdate = true;
      
      networkGroupRef.current.add(nodeMeshRef.current);

      const outlineMat = new THREE.MeshBasicMaterial({
          color: 0x000000,
          side: THREE.BackSide,
      });
      nodeOutlineMeshRef.current = new THREE.InstancedMesh(sphereGeo, outlineMat, count);
      nodeOutlineMeshRef.current.frustumCulled = false; // 禁用视锥裁剪
      networkGroupRef.current.add(nodeOutlineMeshRef.current);


      if (data.links.length > 0) {
          const lineGeo = new THREE.CylinderGeometry(1, 1, 1, 4, 1);
          lineGeo.translate(0, 0.5, 0);
          lineGeo.rotateX(Math.PI / 2);

          // 1. Faint Visual Lines
          const lineMat = new THREE.MeshBasicMaterial({
              color: 0xffffff, 
              transparent: true,
              opacity: 0.1, 
              depthWrite: false
          });
          edgeMeshRef.current = new THREE.InstancedMesh(lineGeo, lineMat, data.links.length);
          const edgeCol = new THREE.Color(config.lineColor);
          for(let i=0; i<data.links.length; i++) {
              edgeMeshRef.current.setColorAt(i, edgeCol);
          }
          networkGroupRef.current.add(edgeMeshRef.current);

          // New: Faint Arrows (4 parts per link)
          arrowMeshRef.current = new THREE.InstancedMesh(lineGeo, lineMat, data.links.length * 4);
          for(let i=0; i<data.links.length * 4; i++) arrowMeshRef.current.setColorAt(i, edgeCol);
          networkGroupRef.current.add(arrowMeshRef.current);


          // 2. Invisible Thick Hit Lines
          const invisibleMat = new THREE.MeshBasicMaterial({
             color: 0xff0000,
             transparent: true,
             opacity: 0,
             depthWrite: false
          });
          hitEdgeMeshRef.current = new THREE.InstancedMesh(lineGeo, invisibleMat, data.links.length);
          networkGroupRef.current.add(hitEdgeMeshRef.current);

          // 4. Inner Core Lines & Arrows
          const innerLineMat = new THREE.MeshToonMaterial({
              color: config.topNodeColor,
              gradientMap: toonGradient
          });
          innerEdgeMeshRef.current = new THREE.InstancedMesh(lineGeo, innerLineMat, data.links.length);
          networkGroupRef.current.add(innerEdgeMeshRef.current);

          // New: Core Arrows
          coreArrowMeshRef.current = new THREE.InstancedMesh(lineGeo, innerLineMat, data.links.length * 4);
          networkGroupRef.current.add(coreArrowMeshRef.current);
      }

      console.log('Calling updateInstanceMatrices, nodes:', geneNodesRef.current.length, 'nodeMesh:', !!nodeMeshRef.current);
      if (geneNodesRef.current.length > 0) {
          console.log('First node position:', geneNodesRef.current[0].position);
      }
      console.log('Scene children after network creation:', sceneRef.current?.children.length);
      console.log('Network group children:', networkGroupRef.current?.children.length);
      updateInstanceMatrices();
      isTransitioningRef.current = true;
      
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sceneReady]);

  // --- 9. Layout Mode Effect ---
  useEffect(() => {
      if (geneNodesRef.current.length === 0) return;

      isTransitioningRef.current = true;
      const mode = config.layoutMode;
      const count = geneNodesRef.current.length;
      const phi = Math.PI * (3 - Math.sqrt(5));

      if (mode === 'sphere') {
        for (let i = 0; i < count; i++) {
            const y = 1 - (i / (count - 1)) * 2;
            const radiusAtY = Math.sqrt(1 - y * y);
            const theta = phi * i;
            const x = Math.cos(theta) * radiusAtY;
            const z = Math.sin(theta) * radiusAtY;
            geneNodesRef.current[i].targetPosition.set(x, y, z).multiplyScalar(CONSTANTS.radius);
        }
      } else if (mode === 'core') {
        const topNodes = geneNodesRef.current.filter(n => n.isTop);
        const normalNodes = geneNodesRef.current.filter(n => !n.isTop);

        topNodes.forEach((node, i) => {
            const y = 1 - (i / (topNodes.length - 1)) * 2;
            const radiusAtY = Math.sqrt(1 - y * y);
            const theta = phi * i;
            const x = Math.cos(theta) * radiusAtY;
            const z = Math.sin(theta) * radiusAtY;
            node.targetPosition.set(x, y, z).multiplyScalar(CONSTANTS.radiusCore);
        });

        normalNodes.forEach((node, i) => {
            const y = 1 - (i / (normalNodes.length - 1)) * 2;
            const radiusAtY = Math.sqrt(1 - y * y);
            const theta = phi * i;
            const x = Math.cos(theta) * radiusAtY;
            const z = Math.sin(theta) * radiusAtY;
            node.targetPosition.set(x, y, z).multiplyScalar(CONSTANTS.radiusOuter);
        });
      }
      
      updateInstanceMatrices();

  }, [config.layoutMode]);

  // --- 10. Color Config Effect ---
  useEffect(() => {
      if(!nodeMeshRef.current) return;
      
      const topCol = new THREE.Color(config.topNodeColor);
      const normalCol = new THREE.Color(config.normalNodeColor);
      const lineCol = new THREE.Color(config.lineColor);
      const hoverCol = new THREE.Color(config.hoverColor);

      geneNodesRef.current.forEach((node, i) => {
          node.baseColor.copy(node.isTop ? topCol : normalCol);
          nodeMeshRef.current!.setColorAt(i, node.baseColor);
      });
      nodeMeshRef.current.instanceColor!.needsUpdate = true;

      if (edgeMeshRef.current && arrowMeshRef.current) {
          for (let i = 0; i < edgeMeshRef.current.count; i++) {
              edgeMeshRef.current.setColorAt(i, lineCol);
          }
          for (let i = 0; i < arrowMeshRef.current.count; i++) {
              arrowMeshRef.current.setColorAt(i, lineCol);
          }
          edgeMeshRef.current.instanceColor!.needsUpdate = true;
          arrowMeshRef.current.instanceColor!.needsUpdate = true;
      }

      if (innerEdgeMeshRef.current && coreArrowMeshRef.current) {
          (innerEdgeMeshRef.current.material as THREE.MeshToonMaterial).color.set(topCol);
          (coreArrowMeshRef.current.material as THREE.MeshToonMaterial).color.set(topCol);
      }

      if (highlightMaterialRef.current) {
          // UPDATED: Use topNodeColor for highlight instead of hoverColor
          highlightMaterialRef.current.uniforms.color.value.copy(topCol);
      }

  }, [config.topNodeColor, config.normalNodeColor, config.lineColor, config.hoverColor]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
};