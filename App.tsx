import React, { useState, useEffect } from 'react';
import { GeneCanvas } from './components/GeneCanvas';
import { ControlPanel } from './components/ControlPanel';
import { NavBar } from './components/NavBar';
import { Tooltip } from './components/Tooltip';
import { ProcessedData, VisualConfig, TooltipData } from './types';
import { generateDefaultData } from './utils/dataHelpers';

const App: React.FC = () => {
  // --- Gene Data State ---
  const [data, setData] = useState<ProcessedData | null>(null);
  const [dataLabel, setDataLabel] = useState<string>('初始化中...');
  const [tooltipData, setTooltipData] = useState<TooltipData>({ visible: false, x: 0, y: 0 });
  
  const [config, setConfig] = useState<VisualConfig>({
    topNodeColor: '#e5767f',
    normalNodeColor: '#ffffff',
    lineColor: '#f0f0f0',       
    hoverColor: '#FF4757',      
    layoutMode: 'sphere'
  });

  // Initial Load
  useEffect(() => {
    const initialData = generateDefaultData(200);
    setData(initialData);
    setDataLabel('默认演示 (200 节点)');
  }, []);

  const handleDataLoaded = (newData: ProcessedData, label: string) => {
    setData(newData);
    setDataLabel(label);
  };

  return (
    <div className="relative w-screen h-screen font-comic overflow-hidden bg-[#f0f4f8]">
      <NavBar config={config} setConfig={setConfig} />

      {data && (
        <GeneCanvas 
          data={data} 
          config={config} 
          onTooltipUpdate={setTooltipData}
        />
      )}
      
      <ControlPanel 
        config={config} 
        setConfig={setConfig} 
        onDataLoaded={handleDataLoaded} 
        dataLabel={dataLabel}
      />
      
      <Tooltip data={tooltipData} />
    </div>
  );
};

export default App;