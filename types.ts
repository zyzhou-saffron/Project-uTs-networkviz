import * as THREE from 'three';

export interface RawNode {
  id: string;
  name: string;
  val?: number;
}

export interface RawLink {
  source: string;
  target: string;
  score?: number;
}

export interface ProcessedData {
  nodes: RawNode[];
  links: RawLink[];
}

export type LayoutMode = 'sphere' | 'core';

export interface VisualConfig {
  topNodeColor: string;
  normalNodeColor: string;
  lineColor: string;
  hoverColor: string;
  layoutMode: LayoutMode;
}

export interface SimulationNode extends RawNode {
  index: number;
  score: number;
  isTop: boolean;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  baseColor: THREE.Color;
  currentScale: number;
}

export interface TooltipConnection {
  sourceName: string;
  targetName: string;
  score: number;
}

export interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  name?: string;
  id?: string;
  score?: number;
  type?: 'hub' | 'normal';
  sourceName?: string;
  targetName?: string;
  connections?: TooltipConnection[];
}