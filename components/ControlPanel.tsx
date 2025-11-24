import React, { useState, useRef } from 'react';
import { VisualConfig, ProcessedData } from '../types';
import { parseTSV, generateDefaultData } from '../utils/dataHelpers';

interface ControlPanelProps {
  config: VisualConfig;
  setConfig: React.Dispatch<React.SetStateAction<VisualConfig>>;
  onDataLoaded: (data: ProcessedData, label: string) => void;
  dataLabel: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  config,
  setConfig,
  onDataLoaded,
  dataLabel,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        let data: ProcessedData | null = null;

        if (file.name.toLowerCase().endsWith('.json')) {
          data = JSON.parse(content);
        } else {
          data = parseTSV(content);
        }

        if (data) {
          onDataLoaded(data, `自定义 (${data.nodes.length} 节点)`);
        } else {
          alert('数据解析失败: 未找到节点数据');
        }
      } catch (error) {
        console.error(error);
        alert('文件解析错误');
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReset = () => {
    const data = generateDefaultData(200);
    onDataLoaded(data, '默认演示 (200 节点)');
  };

  const updateColor = (key: keyof VisualConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className={`absolute top-6 left-6 bg-white border-[3px] border-neutral-800 rounded-2xl shadow-cartoon-panel text-neutral-800 z-10 transition-all duration-300 overflow-hidden font-comic ${
        collapsed ? 'w-auto h-auto p-3 rounded-[30px]' : 'w-80 p-6 max-h-[calc(100vh-48px)] overflow-y-auto'
      }`}
    >
      <div className={`flex justify-between items-center ${collapsed ? 'mb-0' : 'mb-5'}`}>
        {!collapsed && <h1 className="m-0 text-xl font-black text-black">"Project uTs"</h1>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="bg-transparent border-none text-2xl font-black text-neutral-800 cursor-pointer w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform"
          title={collapsed ? '展开' : '折叠'}
        >
          {collapsed ? '+' : '_'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-bold">
            当前模式: <span className="text-black">{dataLabel}</span>
          </p>

          <div className="flex gap-2">
            <div className="relative flex-2 bg-neutral-800 text-white border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer overflow-hidden">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.tsv,.txt"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="px-4 py-2 text-xs font-bold text-center">📂 上传数据</div>
            </div>
            <button
              onClick={handleReset}
              className="flex-1 bg-white text-neutral-800 border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] hover:bg-gray-50 active:translate-y-[2px] active:shadow-none transition-all px-4 py-2 text-xs font-bold"
            >
              ↺ 重置
            </button>
          </div>

          {/* Layout Mode removed from here, moved to NavBar */}

          <div>
            <h2 className="text-xs text-gray-500 uppercase font-extrabold tracking-wider mb-3 mt-4">外观风格</h2>
            
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-neutral-800">核心节点</span>
                <span className="text-[10px] text-gray-500">关键枢纽 (Top 10%)</span>
              </div>
              <div className="flex items-center bg-white p-1 rounded-md border-2 border-gray-200">
                <span className="font-mono text-xs font-bold mr-2 w-14 text-center">{config.topNodeColor}</span>
                <input
                  type="color"
                  value={config.topNodeColor}
                  onChange={(e) => updateColor('topNodeColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-neutral-800">普通节点</span>
                <span className="text-[10px] text-gray-500">常规外围节点</span>
              </div>
              <div className="flex items-center bg-white p-1 rounded-md border-2 border-gray-200">
                <span className="font-mono text-xs font-bold mr-2 w-14 text-center">{config.normalNodeColor}</span>
                <input
                  type="color"
                  value={config.normalNodeColor}
                  onChange={(e) => updateColor('normalNodeColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-neutral-800">连线颜色</span>
                <span className="text-[10px] text-gray-500">连接强度可视化</span>
              </div>
              <div className="flex items-center bg-white p-1 rounded-md border-2 border-gray-200">
                <span className="font-mono text-xs font-bold mr-2 w-14 text-center">{config.lineColor}</span>
                <input
                  type="color"
                  value={config.lineColor}
                  onChange={(e) => updateColor('lineColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0"
                />
              </div>
            </div>
          </div>

          <div className="border-t-2 border-dashed border-gray-300 pt-4 mt-4">
            <p className="text-[10px] text-gray-600 font-bold mb-2">数据格式支持 (TSV/JSON):</p>
            <div className="bg-gray-50 border-2 border-gray-200 rounded p-2 font-mono text-[10px] text-gray-700 overflow-x-auto">
              Source	Target	Score<br/>
              TP53	MDM2	0.95<br/>
              EGFR	KRAS	0.82
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
