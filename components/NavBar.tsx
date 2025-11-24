import React from 'react';
import { VisualConfig, LayoutMode } from '../types';

interface NavBarProps {
  config: VisualConfig;
  setConfig: React.Dispatch<React.SetStateAction<VisualConfig>>;
}

export const NavBar: React.FC<NavBarProps> = ({ config, setConfig }) => {
  const modes: { id: LayoutMode; label: string }[] = [
    { id: 'sphere', label: '均匀模式' },
    { id: 'core', label: '核心模式' },
  ];

  return (
    <div className="absolute top-6 left-0 w-full flex justify-center pointer-events-none z-20">
      <div className="pointer-events-auto bg-white border-[3px] border-neutral-800 rounded-xl shadow-cartoon-panel p-1.5 flex gap-2 font-comic transform transition-transform hover:scale-105">
        {modes.map((mode) => {
          const isActive = config.layoutMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setConfig((prev) => ({ ...prev, layoutMode: mode.id }))}
              className={`
                px-6 py-2 rounded-lg text-sm font-black transition-all duration-200 cursor-pointer border-2
                ${
                  isActive
                    ? 'bg-yellow-300 text-neutral-900 border-neutral-900 shadow-[2px_2px_0px_#000] -translate-y-0.5'
                    : 'bg-transparent text-neutral-500 border-transparent hover:bg-gray-100'
                }
              `}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};